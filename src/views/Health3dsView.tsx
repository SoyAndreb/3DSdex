import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSd, type SdMessage } from '../state/SdContext';
import { fsMessage } from '../state/fsMessage';
import { useT } from '../i18n';
import { resolveSdMessage } from '../i18n/messages';
import { audit3dsCard, type Audit3dsResult, type MisplacedFile } from '../lib/sdAudit';
import { inspectBootLayout, type BootCheckResult } from '../lib/bootCheck';
import {
  group3dsFindings,
  scan3dsApps,
  type App3dsFinding,
  type App3dsReport,
} from '../lib/app3dsAudit';
import {
  buildCleanupPlan,
  buildMovePlan,
  buildOrphanPlan,
  type ChangePlan,
} from '../lib/changePlan';
import { isCriticalSystemPath } from '../lib/criticalPaths';
import { getDir, readFileBytes, removeFromPath, writeFileBytes } from '../lib/sdcard';
import { ChangePreview } from '../components/ChangePreview';
import './Health3dsView.css';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sectionClass(ok: boolean): string {
  return `health3ds__section health3ds__section--${ok ? 'ok' : 'warn'}`;
}

const emptyAppsReport: App3dsReport = {
  findings: [],
  appFolders: 0,
  rootLaunchers: 0,
  emptyFolders: 0,
  filesSeen: 0,
};

export function Health3dsView() {
  const { root, loading, fsMode, notifyCompatWrite, notePlan } = useSd();
  const t = useT();
  const [scanning, setScanning] = useState(false);
  const [filesSeen, setFilesSeen] = useState(0);
  const [audit, setAudit] = useState<Audit3dsResult | null>(null);
  const [scanError, setScanError] = useState<SdMessage | null>(null);

  const [junkBusy, setJunkBusy] = useState(false);
  const [selectedLeftovers, setSelectedLeftovers] = useState<ReadonlySet<string>>(new Set());
  const [leftoversBusy, setLeftoversBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [movingBusy, setMovingBusy] = useState(false);
  const [boot, setBoot] = useState<BootCheckResult | null>(null);
  const [apps, setApps] = useState<App3dsReport | null>(null);
  const [selectedApps, setSelectedApps] = useState<ReadonlySet<string>>(new Set());
  const [appsShowAll, setAppsShowAll] = useState(false);
  const [appsBusy, setAppsBusy] = useState(false);
  const [preview, setPreview] = useState<{
    kind: 'junk' | 'leftovers' | 'move' | 'orphans';
    plan: ChangePlan;
  } | null>(null);

  const runScan = useCallback(async () => {
    if (!root) return;
    setScanning(true);
    setFilesSeen(0);
    setScanError(null);
    setPreview(null);
    setSelectedLeftovers(new Set());
    setSelectedApps(new Set());
    setAppsShowAll(false);
    try {
      const res = await audit3dsCard(root, (n) => setFilesSeen(n));
      setAudit(res);
      // Read-only supporting scans: one failure must not hide the audit results.
      void inspectBootLayout(root).then(setBoot, () => setBoot(null));
      void scan3dsApps(root).then(setApps, () => setApps(null));
    } catch (e) {
      setScanError(fsMessage(e));
    } finally {
      setScanning(false);
    }
  }, [root]);

  useEffect(() => {
    void runScan();
  }, [runScan]);

  const totalJunkBytes = useMemo(() => {
    if (!audit) return 0;
    return audit.junkFiles.reduce((sum, f) => sum + f.size, 0);
  }, [audit]);

  const selectedLeftoverBytes = useMemo(() => {
    if (!audit) return 0;
    return audit.leftovers
      .filter((l) => selectedLeftovers.has(l.id))
      .reduce((sum, l) => sum + l.size, 0);
  }, [audit, selectedLeftovers]);

  const junkPlan = useMemo(
    () =>
      audit === null
        ? { changes: [], blocked: [] }
        : buildCleanupPlan({
            junkFiles: audit.junkFiles,
            junkDirs: audit.junkDirs,
            emptyLostDir: audit.emptyLostDir,
            leftovers: [],
            selectedLeftovers: new Set(),
          }),
    [audit],
  );

  const leftoversPlan = useMemo(
    () =>
      audit === null
        ? { changes: [], blocked: [] }
        : buildCleanupPlan({
            junkFiles: [],
            junkDirs: [],
            emptyLostDir: false,
            leftovers: audit.leftovers,
            selectedLeftovers,
          }),
    [audit, selectedLeftovers],
  );

  const movePlan = useMemo(
    () =>
      audit === null
        ? { changes: [], blocked: [] }
        : buildMovePlan(
            audit.misplacedFiles.map((f) => ({
              name: f.name,
              size: f.size,
              suggestedDir: f.suggestedDir,
            })),
          ),
    [audit],
  );

  // Only explicitly selected whole files can be planned for deletion. Root
  // launchers and app folders are never part of this plan.
  const orphanPlan = useMemo(
    () =>
      buildOrphanPlan(
        (apps?.findings ?? [])
          .filter(
            (finding: App3dsFinding) =>
              selectedApps.has(finding.id) && finding.kind === 'heavy-file',
          )
          .map((finding) => ({
            path: finding.path,
            name: finding.name,
            size: finding.size,
          })),
      ),
    [apps, selectedApps],
  );

  const appGroups = useMemo(
    () => group3dsFindings(apps ?? emptyAppsReport, appsShowAll ? Number.POSITIVE_INFINITY : 3),
    [apps, appsShowAll],
  );

  useEffect(() => {
    // The manifest must mirror the CURRENT preview. A cancelled preview (or a
    // rescan) notes an empty plan, so no stale deletes leak into the ZIP.
    notePlan(preview?.plan ?? { changes: [], blocked: [] });
  }, [preview, notePlan]);

  const handleCleanJunk = async () => {
    if (!root || !audit) return;
    setJunkBusy(true);
    setActionMsg(null);
    try {
      for (const jf of audit.junkFiles) {
        await removeFromPath(root, jf.path, jf.name);
      }
      for (const jd of audit.junkDirs) {
        if (jd.preventionOnly || isCriticalSystemPath(jd.name)) continue;
        await root.removeEntry(jd.name, { recursive: true });
      }
      if (audit.emptyLostDir) {
        await root.removeEntry('LOST.DIR', { recursive: true });
      }
      notifyCompatWrite();
      setPreview(null);
      setActionMsg(t.dex3ds.appsCleaned(junkPlan.changes.length));
      await runScan();
    } catch (e) {
      setScanError(fsMessage(e));
    } finally {
      setJunkBusy(false);
    }
  };

  const handleDeleteLeftovers = async () => {
    if (!root || !audit) return;
    setLeftoversBusy(true);
    setActionMsg(null);
    try {
      for (const item of audit.leftovers) {
        if (!selectedLeftovers.has(item.id)) continue;
        await removeFromPath(root, item.path, item.name);
      }
      notifyCompatWrite();
      setPreview(null);
      setActionMsg(t.dex3ds.appsCleaned(leftoversPlan.changes.length));
      await runScan();
    } catch (e) {
      setScanError(fsMessage(e));
    } finally {
      setLeftoversBusy(false);
    }
  };

  const handleMoveMisplaced = async (files: readonly MisplacedFile[]) => {
    if (!root || files.length === 0) return;
    setMovingBusy(true);
    setActionMsg(null);
    let moved = 0;
    try {
      for (const item of files) {
        const bytes = await readFileBytes(root, item.name);
        if (bytes === null) continue;
        const targetDir = await getDir(root, item.suggestedSegments, true);
        if (!targetDir) continue;
        await writeFileBytes(targetDir, item.name, bytes);
        const writtenBytes = await readFileBytes(targetDir, item.name);
        if (writtenBytes && writtenBytes.length === bytes.length) {
          await removeFromPath(root, [], item.name);
          moved += 1;
        }
      }
      notifyCompatWrite();
      setPreview(null);
      setActionMsg(t.dex3ds.movedCount(moved));
      await runScan();
    } catch (e) {
      setScanError(fsMessage(e));
    } finally {
      setMovingBusy(false);
    }
  };

  const toggleLeftover = (id: string) => {
    const next = new Set(selectedLeftovers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeftovers(next);
    setPreview(null);
  };

  const toggleApp = (id: string) => {
    const next = new Set(selectedApps);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedApps(next);
    setPreview(null);
  };

  const handleCleanOrphans = async () => {
    if (!root || apps === null || selectedApps.size === 0) return;
    setAppsBusy(true);
    setActionMsg(null);
    try {
      let removed = 0;
      for (const finding of apps.findings) {
        if (!selectedApps.has(finding.id)) continue;
        // Only explicitly selected heavy files at /3ds/ root are removable.
        // Launchers, folders and duplicates stay purely informational.
        if (finding.kind !== 'heavy-file') continue;
        await removeFromPath(root, finding.path, finding.name);
        removed += 1;
      }
      notifyCompatWrite();
      setPreview(null);
      setActionMsg(t.dex3ds.appsCleaned(removed));
      await runScan();
    } catch (e) {
      setScanError(fsMessage(e));
    } finally {
      setAppsBusy(false);
    }
  };

  if (!root) {
    return <p className="health3ds__empty">{t.health.openCard}</p>;
  }

  const removableJunkCount = audit
    ? audit.junkFiles.length +
      audit.junkDirs.filter((d) => !d.preventionOnly).length +
      (audit.emptyLostDir ? 1 : 0)
    : 0;
  const criticalOk = audit ? audit.hasBootFirm && audit.hasBoot3dsx : false;
  const totalFreeable = totalJunkBytes + selectedLeftoverBytes;

  return (
    <section className="health3ds">
      <div className="health3ds__header">
        <div>
          <h2 className="health3ds__title">{t.dex3ds.auditTitle}</h2>
          <p className="health3ds__intro">{t.dex3ds.auditIntro}</p>
        </div>
        <button
          type="button"
          className="primary"
          onClick={() => void runScan()}
          disabled={scanning || loading}
        >
          {scanning ? t.dex3ds.scanning(filesSeen) : t.dex3ds.rescan}
        </button>
      </div>

      <p className="health3ds__protected">
        {t.dex3ds.protectedNote}
        {audit && totalFreeable > 0 && (
          <>
            {' '}
            · <strong>{t.dex3ds.spaceToFree(formatSize(totalFreeable))}</strong>
          </>
        )}
      </p>

      {scanError && <p className="app__error">{resolveSdMessage(t, scanError)}</p>}
      {actionMsg && <p className="health3ds__notice">{actionMsg}</p>}

      {audit && (
        <div className="health3ds__grid">
          {/* Critical CFW & Boot files */}
          <div className={sectionClass(criticalOk)}>
            <h3 className="section-title">{t.dex3ds.criticalTitle}</h3>
            <ul className="health3ds__list">
              <li className={audit.hasBootFirm ? 'health3ds__ok' : 'health3ds__warn'}>
                {audit.hasBootFirm ? '✓ ' : '⚠ '}
                {audit.hasBootFirm ? t.dex3ds.bootFirmOk : t.dex3ds.bootFirmMissing}
              </li>
              <li className={audit.hasBoot3dsx ? 'health3ds__ok' : 'health3ds__warn'}>
                {audit.hasBoot3dsx ? '✓ ' : '⚠ '}
                {audit.hasBoot3dsx ? t.dex3ds.boot3dsxOk : t.dex3ds.boot3dsxMissing}
              </li>
              <li className={audit.hasGodMode9 ? 'health3ds__ok' : 'health3ds__warn'}>
                {audit.hasGodMode9 ? '✓ ' : '⚠ '}
                {audit.hasGodMode9 ? t.dex3ds.gm9Ok : t.dex3ds.gm9Missing}
              </li>
              <li className={audit.hasLumaConfig ? 'health3ds__ok' : 'health3ds__dim'}>
                {audit.hasLumaConfig ? '✓ ' : '• '}
                {audit.hasLumaConfig ? t.dex3ds.lumaConfigOk : t.dex3ds.lumaConfigMissing}
              </li>
            </ul>
          </div>

          {/* FBI / NSA Detection Rule: only shown when FBI is present and NSA is absent */}
          {audit.fbiNsa.recommendNsa && audit.fbiNsa.url && (
            <div className={sectionClass(false)}>
              <h3 className="section-title">{t.dex3ds.fbiNsaTitle}</h3>
              <p className="health3ds__body">{t.dex3ds.fbiNsaRecommend}</p>
              <a
                className="health3ds__ext-link"
                href={audit.fbiNsa.url}
                target="_blank"
                rel="noreferrer"
              >
                {t.dex3ds.fbiNsaLink} →
              </a>
            </div>
          )}

          {/* Category 1: OS Junk & Leftovers */}
          <div className={sectionClass(removableJunkCount === 0)}>
            <h3 className="section-title">
              {t.dex3ds.junkTitle} ({formatSize(totalJunkBytes)})
            </h3>
            {removableJunkCount === 0 ? (
              <p className="health3ds__ok">✓ {t.dex3ds.junkNone}</p>
            ) : (
              <>
                <ul className="health3ds__list">
                  {audit.emptyLostDir && (
                    <li className="health3ds__item">
                      <code>/LOST.DIR/</code> (empty)
                    </li>
                  )}
                  {audit.junkDirs
                    .filter((d) => !d.preventionOnly)
                    .map((d) => (
                      <li key={`dir-${d.name}`} className="health3ds__item">
                        <code>/{d.name}/</code>
                      </li>
                    ))}
                  {audit.junkFiles.slice(0, 20).map((f) => (
                    <li key={`file-${f.path.join('/')}/${f.name}`} className="health3ds__item">
                      <code>
                        {f.path.length > 0 ? `/${f.path.join('/')}` : ''}/{f.name}
                      </code>{' '}
                      ({formatSize(f.size)})
                    </li>
                  ))}
                  {audit.junkFiles.length > 20 && (
                    <li className="health3ds__dim">+{audit.junkFiles.length - 20} …</li>
                  )}
                </ul>
                <button
                  type="button"
                  className="health3ds__danger"
                  disabled={junkBusy || scanning}
                  onClick={() => setPreview({ kind: 'junk', plan: junkPlan })}
                >
                  {t.dex3ds.junkClean} ({removableJunkCount})
                </button>
                {preview?.kind === 'junk' && (
                  <ChangePreview
                    plan={junkPlan}
                    mode={fsMode}
                    busy={junkBusy}
                    actionLabel={t.dex3ds.junkClean}
                    onConfirm={() => void handleCleanJunk()}
                    onCancel={() => setPreview(null)}
                  />
                )}
              </>
            )}
          </div>

          {/* Category 2: Misplaced .cia / .3dsx / .firm files at root */}
          <div className={sectionClass(audit.misplacedFiles.length === 0)}>
            <h3 className="section-title">{t.dex3ds.misplacedTitle}</h3>
            {audit.misplacedFiles.length === 0 ? (
              <p className="health3ds__ok">✓ {t.dex3ds.misplacedNone}</p>
            ) : (
              <>
                <p className="health3ds__body">{t.dex3ds.misplacedHint}</p>
                <ul className="health3ds__list">
                  {audit.misplacedFiles.map((f) => (
                    <li key={f.name} className="health3ds__item">
                      <code>/{f.name}</code> → <code>/{f.suggestedDir}/</code> ({formatSize(f.size)}
                      )
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={movingBusy || scanning}
                  onClick={() => setPreview({ kind: 'move', plan: movePlan })}
                >
                  {movingBusy ? t.dex3ds.moving : t.dex3ds.moveToSuggested}
                </button>
                {preview?.kind === 'move' && (
                  <ChangePreview
                    plan={movePlan}
                    mode={fsMode}
                    busy={movingBusy}
                    actionLabel={t.dex3ds.moveToSuggested}
                    onConfirm={() => void handleMoveMisplaced(audit.misplacedFiles)}
                    onCancel={() => setPreview(null)}
                  />
                )}
              </>
            )}
          </div>

          {/* Category 3: Optional Leftovers (.bak, logs, .cia installers) */}
          <div className={sectionClass(audit.leftovers.length === 0)}>
            <h3 className="section-title">{t.dex3ds.leftoversTitle}</h3>
            {audit.leftovers.length === 0 ? (
              <p className="health3ds__ok">✓ {t.dex3ds.leftoversNone}</p>
            ) : (
              <>
                <p className="health3ds__body">{t.dex3ds.leftoversHint}</p>
                <ul className="health3ds__list" style={{ listStyle: 'none', paddingLeft: 0 }}>
                  {audit.leftovers.map((item) => (
                    <li key={item.id} className="health3ds__item">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <input
                          type="checkbox"
                          checked={selectedLeftovers.has(item.id)}
                          onChange={() => toggleLeftover(item.id)}
                        />
                        <code>{item.id}</code> ({formatSize(item.size)})
                      </label>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="health3ds__danger"
                  disabled={leftoversBusy || selectedLeftovers.size === 0}
                  onClick={() => setPreview({ kind: 'leftovers', plan: leftoversPlan })}
                >
                  {t.dex3ds.deleteSelected(
                    selectedLeftovers.size,
                    formatSize(selectedLeftoverBytes),
                  )}
                </button>
                {preview?.kind === 'leftovers' && (
                  <ChangePreview
                    plan={leftoversPlan}
                    mode={fsMode}
                    busy={leftoversBusy}
                    actionLabel={t.dex3ds.deleteSelected(
                      selectedLeftovers.size,
                      formatSize(selectedLeftoverBytes),
                    )}
                    onConfirm={() => void handleDeleteLeftovers()}
                    onCancel={() => setPreview(null)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {(boot !== null || apps !== null) && (
        <div className="health3ds__grid">
          {boot !== null && (
            <div
              className={sectionClass(
                boot.bootFirm.present &&
                  boot.boot3dsx.present &&
                  boot.lumaConfig.status === 'present' &&
                  boot.lumaConfig.findings.length === 0,
              )}
            >
              <h3 className="section-title">{t.dex3ds.bootTitle}</h3>
              <p className="health3ds__body">{t.dex3ds.bootIntro}</p>
              <ul className="health3ds__list">
                <li className={boot.bootFirm.present ? 'health3ds__ok' : 'health3ds__warn'}>
                  {boot.bootFirm.present
                    ? t.dex3ds.bootBootFirm(formatSize(boot.bootFirm.size ?? 0))
                    : t.dex3ds.bootFirmMissing}
                </li>
                <li className={boot.boot3dsx.present ? 'health3ds__ok' : 'health3ds__warn'}>
                  {boot.boot3dsx.present
                    ? t.dex3ds.bootBoot3dsx(formatSize(boot.boot3dsx.size ?? 0))
                    : t.dex3ds.boot3dsxMissing}
                </li>
                <li className={boot.payloads.length > 0 ? 'health3ds__ok' : 'health3ds__dim'}>
                  {boot.payloads.length > 0
                    ? t.dex3ds.bootPayloads(boot.payloads.length)
                    : t.dex3ds.bootPayloadNone}
                </li>
                {boot.duplicatePayloads > 0 && (
                  <li className="health3ds__warn">
                    {t.dex3ds.bootDuplicates(boot.duplicatePayloads)}
                  </li>
                )}
                {boot.outdatedPayloads > 0 && (
                  <li className="health3ds__warn">
                    {t.dex3ds.bootOutdated(boot.outdatedPayloads)}
                  </li>
                )}
                <li
                  className={
                    boot.lumaConfig.status === 'present' && boot.lumaConfig.findings.length === 0
                      ? 'health3ds__ok'
                      : boot.lumaConfig.status === 'missing'
                        ? 'health3ds__dim'
                        : 'health3ds__warn'
                  }
                >
                  {boot.lumaConfig.status === 'present'
                    ? t.dex3ds.bootConfigOk(boot.lumaConfig.version ?? '?')
                    : boot.lumaConfig.status === 'missing'
                      ? t.dex3ds.bootConfigMissing
                      : t.dex3ds.bootConfigUnreadable}
                </li>
                {boot.lumaConfig.findings.length > 0 && (
                  <li className="health3ds__warn">
                    {t.dex3ds.bootConfigFindings(boot.lumaConfig.findings.length)}
                    <ul className="health3ds__list">
                      {boot.lumaConfig.findings.slice(0, 6).map((finding) => (
                        <li key={finding.code}>
                          {t.dex3ds.bootConfigFinding[finding.code]}
                          {finding.value ?? ''}
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
                {boot.lumaConfig.status === 'present' && boot.lumaConfig.findings.length === 0 && (
                  <li className="health3ds__dim">{t.dex3ds.bootConfigClean}</li>
                )}
              </ul>
            </div>
          )}

          {apps !== null && (
            <div className={sectionClass(apps.findings.length === 0)}>
              <h3 className="section-title">{t.dex3ds.appsTitle}</h3>
              <p className="health3ds__body">{t.dex3ds.appsIntro}</p>
              <div className="health3ds__badges">
                <span className="health3ds__badge">{t.dex3ds.appsAppFolders(apps.appFolders)}</span>
                <span className="health3ds__badge">
                  {t.dex3ds.appsRootLaunchers(apps.rootLaunchers)}
                </span>
                {apps.emptyFolders > 0 && (
                  <span className="health3ds__badge">
                    {t.dex3ds.appsEmptyFolders(apps.emptyFolders)}
                  </span>
                )}
                <span
                  className={`health3ds__badge ${apps.findings.length === 0 ? 'health3ds__badge--ok' : 'health3ds__badge--warn'}`}
                >
                  {t.dex3ds.appsFindingsCount(apps.findings.length)}
                </span>
              </div>
              {apps.findings.length === 0 ? (
                <p className="health3ds__ok">{t.dex3ds.appsNone}</p>
              ) : (
                <div className="health3ds__groups">
                  {appGroups.map((group) => (
                    <details key={group.kind} className="health3ds__group" open>
                      <summary className="health3ds__groupSummary">
                        <span>{t.dex3ds.appsFinding[group.kind]}</span>
                        <span className="health3ds__badge">{group.total}</span>
                      </summary>
                      <ul className="health3ds__list">
                        {group.visible.map((finding) => (
                          <li key={finding.id} className="health3ds__item health3ds__appItem">
                            {finding.kind === 'heavy-file' ? (
                              <label className="health3ds__check">
                                <input
                                  type="checkbox"
                                  checked={selectedApps.has(finding.id)}
                                  onChange={() => toggleApp(finding.id)}
                                />
                                <code>/{finding.path.join('/')}</code>
                              </label>
                            ) : (
                              <code>/{finding.path.join('/')}</code>
                            )}
                            {finding.size > 0 && <span> · {formatSize(finding.size)}</span>}
                          </li>
                        ))}
                      </ul>
                      {group.hidden > 0 && (
                        <button
                          type="button"
                          className="health3ds__linkButton"
                          onClick={() => setAppsShowAll(true)}
                        >
                          {t.dex3ds.appsShowAll} (+{group.hidden})
                        </button>
                      )}
                    </details>
                  ))}
                  {appsShowAll && (
                    <button
                      type="button"
                      className="health3ds__linkButton"
                      onClick={() => setAppsShowAll(false)}
                    >
                      {t.dex3ds.appsShowLess}
                    </button>
                  )}
                </div>
              )}
              {selectedApps.size > 0 && (
                <button
                  type="button"
                  className="health3ds__danger"
                  disabled={appsBusy || scanning}
                  onClick={() => setPreview({ kind: 'orphans', plan: orphanPlan })}
                >
                  {t.dex3ds.appsReview(selectedApps.size)}
                </button>
              )}
              {preview?.kind === 'orphans' && (
                <ChangePreview
                  plan={orphanPlan}
                  mode={fsMode}
                  busy={appsBusy}
                  actionLabel={t.dex3ds.appsReview(selectedApps.size)}
                  onConfirm={() => void handleCleanOrphans()}
                  onCancel={() => setPreview(null)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
