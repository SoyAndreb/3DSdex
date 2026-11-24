import { useCallback, useEffect, useState } from 'react';
import { useSd, type SdMessage } from '../state/SdContext';
import { fsMessage } from '../state/fsMessage';
import { useT } from '../i18n';
import { resolveSdMessage } from '../i18n/messages';
import { audit3dsCard, type Audit3dsResult, type MisplacedFile } from '../lib/sdAudit';
import { getDir, readFileBytes, writeFileBytes } from '../lib/sdcard';
import './Health3dsView.css';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sectionClass(ok: boolean): string {
  return `health3ds__section health3ds__section--${ok ? 'ok' : 'warn'}`;
}

export function Health3dsView() {
  const { root, loading, notifyCompatWrite } = useSd();
  const t = useT();
  const [scanning, setScanning] = useState(false);
  const [filesSeen, setFilesSeen] = useState(0);
  const [audit, setAudit] = useState<Audit3dsResult | null>(null);
  const [scanError, setScanError] = useState<SdMessage | null>(null);

  const [junkConfirm, setJunkConfirm] = useState(false);
  const [junkBusy, setJunkBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [movingBusy, setMovingBusy] = useState(false);

  const runScan = useCallback(async () => {
    if (!root) return;
    setScanning(true);
    setFilesSeen(0);
    setScanError(null);
    setJunkConfirm(false);
    try {
      const res = await audit3dsCard(root, (n) => setFilesSeen(n));
      setAudit(res);
    } catch (e) {
      setScanError(fsMessage(e));
    } finally {
      setScanning(false);
    }
  }, [root]);

  useEffect(() => {
    void runScan();
  }, [runScan]);

  const handleCleanJunk = async () => {
    if (!root || !audit) return;
    setJunkBusy(true);
    setActionMsg(null);
    try {
      for (const jf of audit.junkFiles) {
        const dir = await getDir(root, jf.path);
        if (dir) {
          await dir.removeEntry(jf.name);
        }
      }
      for (const jd of audit.junkDirs) {
        if (jd.preventionOnly) continue;
        await root.removeEntry(jd.name, { recursive: true });
      }
      notifyCompatWrite();
      setJunkConfirm(false);
      await runScan();
    } catch (e) {
      setScanError(fsMessage(e));
    } finally {
      setJunkBusy(false);
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
        const targetDir = await getDir(root, [item.suggestedDir], true);
        if (!targetDir) continue;
        await writeFileBytes(targetDir, item.name, bytes);
        // Verify written size before removing source file
        const writtenBytes = await readFileBytes(targetDir, item.name);
        if (writtenBytes && writtenBytes.length === bytes.length) {
          await root.removeEntry(item.name);
          moved += 1;
        }
      }
      notifyCompatWrite();
      setActionMsg(t.dex3ds.movedCount(moved));
      await runScan();
    } catch (e) {
      setScanError(fsMessage(e));
    } finally {
      setMovingBusy(false);
    }
  };

  if (!root) {
    return <p className="health3ds__empty">{t.health.openCard}</p>;
  }

  const removableJunkCount = audit
    ? audit.junkFiles.length + audit.junkDirs.filter((d) => !d.preventionOnly).length
    : 0;
  const criticalOk = audit ? audit.hasBootFirm && audit.hasBoot3dsx : false;

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

      <p className="health3ds__protected">{t.dex3ds.protectedNote}</p>

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

          {/* Misplaced .cia / .3dsx files at root */}
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
                      <code>/{f.name}</code> → <code>/{f.suggestedDir}/</code> ({formatSize(f.size)})
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={movingBusy || scanning}
                  onClick={() => void handleMoveMisplaced(audit.misplacedFiles)}
                >
                  {movingBusy ? t.dex3ds.moving : t.dex3ds.moveToSuggested}
                </button>
              </>
            )}
          </div>

          {/* OS Junk & Leftovers */}
          <div className={sectionClass(removableJunkCount === 0)}>
            <h3 className="section-title">{t.dex3ds.junkTitle}</h3>
            {removableJunkCount === 0 ? (
              <p className="health3ds__ok">✓ {t.dex3ds.junkNone}</p>
            ) : (
              <>
                <ul className="health3ds__list">
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
                {!junkConfirm ? (
                  <button
                    type="button"
                    className="health3ds__danger"
                    disabled={junkBusy || scanning}
                    onClick={() => setJunkConfirm(true)}
                  >
                    {t.dex3ds.junkClean} ({removableJunkCount})
                  </button>
                ) : (
                  <div className="health3ds__confirm" role="alert">
                    <span>{t.dex3ds.junkConfirm(removableJunkCount)}</span>
                    <button
                      type="button"
                      className="health3ds__danger"
                      disabled={junkBusy}
                      onClick={() => void handleCleanJunk()}
                    >
                      {junkBusy ? t.health.deleting : t.health.yesDelete}
                    </button>
                    <button type="button" disabled={junkBusy} onClick={() => setJunkConfirm(false)}>
                      {t.health.no}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
