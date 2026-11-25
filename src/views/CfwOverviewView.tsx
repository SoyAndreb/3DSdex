import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useSd } from '../state/SdContext';
import { useT } from '../i18n';
import {
  CFW_MANIFEST,
  type CfwComponentCheck,
  type CfwComponentId,
  type CfwComponentStatus,
} from '../lib/cfwManifest';
import { fetchLatestGithubTag, scanCfwAndUtilities, type CfwScanResult } from '../lib/cfwScan';
import { buildWritePlan, type ChangePlan } from '../lib/changePlan';
import { safeOverwriteFile } from '../lib/safeBackup';
import { DIR_LUMA_PAYLOADS } from '../lib/sd3ds';
import { ChangePreview } from '../components/ChangePreview';
import { PostUpdateChecklist } from '../components/PostUpdateChecklist';
import './CfwOverviewView.css';

export function CfwOverviewView() {
  const { root, fsMode, notifyCompatWrite, notePlan } = useSd();
  const t = useT();
  const [scan, setScan] = useState<CfwScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingTarget, setPendingTarget] = useState<CfwComponentCheck | null>(null);
  const [pendingWrite, setPendingWrite] = useState<{
    target: CfwComponentCheck;
    segments: readonly string[];
    fileName: string;
    bytes: Uint8Array<ArrayBuffer>;
    plan: ChangePlan;
  } | null>(null);
  const [checklist, setChecklist] = useState<CfwComponentId[] | null>(null);

  const runScan = useCallback(async () => {
    if (!root) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const initial = await scanCfwAndUtilities(root);
      setScan(initial);

      // Non-blocking GitHub Releases latest tag check
      const tagEntries = await Promise.all(
        initial.components.map(
          async (component) => [component.id, await fetchLatestGithubTag(component.repo)] as const,
        ),
      );
      const liveTags: Partial<Record<CfwComponentId, string | null>> =
        Object.fromEntries(tagEntries);
      const bootstrapTag = await fetchLatestGithubTag(CFW_MANIFEST.standalone.ndsBootstrap.repo);
      if (root) {
        setScan(await scanCfwAndUtilities(root, liveTags, bootstrapTag));
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    void runScan();
  }, [runScan]);

  const handlePickReplacement = (component: CfwComponentCheck) => {
    setPendingTarget(component);
    fileInputRef.current?.click();
  };

  const handleFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !root || !pendingTarget) return;
    setErrorMsg(null);
    setBackupMsg(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer()) as Uint8Array<ArrayBuffer>;
      const parts = pendingTarget.targetPath.split('/');
      const fileName = parts[parts.length - 1] ?? pendingTarget.targetPath;
      const segments = pendingTarget.id === 'godmode9' ? DIR_LUMA_PAYLOADS : parts.slice(0, -1);
      const writtenPath = [...segments, fileName].join('/');
      const backupPath =
        pendingTarget.status === 'missing'
          ? null
          : `luma/backups/3dsdex/<timestamp>/${writtenPath}`;
      setPendingWrite({
        target: pendingTarget,
        segments,
        fileName,
        bytes,
        plan: buildWritePlan(writtenPath, 'critical-update', bytes.length, backupPath),
      });
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingTarget(null);
    }
  };

  const applyWrite = async () => {
    if (!root || pendingWrite === null) return;
    const { target, segments, fileName, bytes, plan } = pendingWrite;
    setErrorMsg(null);
    try {
      notePlan(plan);
      const result = await safeOverwriteFile(root, segments, fileName, bytes);
      notifyCompatWrite();
      setBackupMsg(
        result.backedUpPath
          ? t.dex3ds.safeBackupDone(result.writtenPath, result.backedUpPath)
          : t.dex3ds.safeWriteDone(result.writtenPath),
      );
      setChecklist([target.id]);
      setPendingWrite(null);
      await runScan();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
      setPendingWrite(null);
    }
  };

  const statusLabel = (status: CfwComponentStatus): string => {
    switch (status) {
      case 'up-to-date':
        return t.dex3ds.statusUpToDate;
      case 'outdated':
        return t.dex3ds.statusOutdated;
      case 'missing':
        return t.dex3ds.statusMissing;
      default:
        return t.dex3ds.statusUnknownVersion;
    }
  };

  const sourceLabel = (component: CfwComponentCheck): string | null => {
    switch (component.versionSource) {
      case 'hash':
        return t.dex3ds.versionSourceHash;
      case 'binary':
        return t.dex3ds.versionSourceBinary;
      case 'file':
        return t.dex3ds.versionSourceFile;
      default:
        return null;
    }
  };

  if (!root) return null;

  return (
    <section className="cfw-overview">
      <div className="health3ds__header">
        <div>
          <h2 className="health3ds__title">{t.dex3ds.cfwPreviewTitle}</h2>
          <p className="health3ds__intro">{t.dex3ds.cfwPreviewBody}</p>
        </div>
        <button type="button" onClick={() => void runScan()} disabled={loading}>
          {loading ? t.app.reloading : t.dex3ds.rescan}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".firm,.3dsx,.nds"
        style={{ display: 'none' }}
        onChange={(event) => void handleFileChosen(event)}
      />

      {backupMsg && <p className="health3ds__notice">{backupMsg}</p>}
      {errorMsg && <p className="app__error">{errorMsg}</p>}
      {pendingWrite !== null && (
        <ChangePreview
          plan={pendingWrite.plan}
          mode={fsMode}
          actionLabel={t.dex3ds.replaceWithBackup}
          onConfirm={() => void applyWrite()}
          onCancel={() => {
            setPendingWrite(null);
            notePlan({ changes: [], blocked: [] });
          }}
        />
      )}
      {checklist !== null && (
        <PostUpdateChecklist
          components={checklist}
          mode={fsMode}
          onClose={() => setChecklist(null)}
        />
      )}

      {scan && (
        <>
          <div className="cfw-grid">
            {scan.components.map((component) => {
              const source = sourceLabel(component);
              return (
                <article key={component.id} className="card cfw-card">
                  <div className="cfw-card__head">
                    <strong className="cfw-card__name">{component.name}</strong>
                    <span className={`cfw-card__badge cfw-card__badge--${component.status}`}>
                      {statusLabel(component.status)}
                    </span>
                  </div>
                  <div className="cfw-card__meta">
                    <code>/{component.targetPath}</code>
                    {component.fileSize !== null && (
                      <span> · {component.fileSize.toLocaleString()} B</span>
                    )}
                  </div>
                  <div className="cfw-card__versions">
                    <span className="cfw-card__version">
                      <span className="cfw-card__label">{t.dex3ds.installedLabel}:</span>{' '}
                      <strong>{component.detectedVersion ?? t.dex3ds.statusUnknownVersion}</strong>
                    </span>
                    <span className="cfw-card__version">
                      <span className="cfw-card__label">{t.dex3ds.latestLabel}:</span>{' '}
                      <strong>{component.latestVersion}</strong>
                    </span>
                  </div>
                  {source !== null && <p className="cfw-card__source">{source}</p>}
                  {component.sha256 !== null && (
                    <p className="cfw-card__hash">
                      SHA-256: <code>{component.sha256.slice(0, 16)}…</code>
                    </p>
                  )}
                  <div className="cfw-card__actions">
                    <button
                      type="button"
                      className="cfw-card__button"
                      onClick={() => handlePickReplacement(component)}
                    >
                      {t.dex3ds.replaceWithBackup}
                    </button>
                    <a
                      className="cfw-card__link"
                      href={`https://github.com/${component.repo}/releases`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      GitHub →
                    </a>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="card cfw-bootstrap">
            <div className="cfw-bootstrap__head">
              <strong>{t.dex3ds.bootstrapTitle}</strong>
              <span className={`cfw-card__badge cfw-card__badge--${scan.bootstrap.status}`}>
                {statusLabel(scan.bootstrap.status)}
              </span>
            </div>
            <div className="cfw-bootstrap__versions">
              <span>
                <span className="cfw-card__label">{t.dex3ds.installedLabel}:</span>{' '}
                <strong>{scan.bootstrap.detectedVersion ?? t.dex3ds.statusUnknownVersion}</strong>
              </span>
              <span>
                <span className="cfw-card__label">{t.dex3ds.latestLabel}:</span>{' '}
                <strong>{scan.bootstrap.latestVersion}</strong>
              </span>
            </div>
            <p className="cfw-card__source">{t.dex3ds.bootstrapNote}</p>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h3 className="section-title">{t.dex3ds.utilitiesTitle}</h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                fontSize: '0.88rem',
              }}
            >
              {scan.utilities.map((utility) => (
                <li key={utility.name}>
                  <span style={{ color: utility.present ? 'var(--ok)' : 'var(--text-dim)' }}>
                    {utility.present ? '✓ ' : '— '}
                  </span>
                  <strong>{utility.name}</strong>
                  {utility.locations.length > 0 && (
                    <span style={{ color: 'var(--text-dim)' }}>
                      {' '}
                      ({utility.locations.join(', ')})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
