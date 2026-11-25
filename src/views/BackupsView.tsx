import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSd } from '../state/SdContext';
import { useT } from '../i18n';
import { buildBackupExportPlan } from '../lib/changePlan';
import {
  exportBackupPackages,
  scanBackups,
  type BackupPackage,
  type BackupSource,
} from '../lib/backupScan';
import { ChangePreview } from '../components/ChangePreview';
import './BackupsView.css';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ms: number): string {
  if (ms <= 0) return '—';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '—';
  }
}

const SOURCE_LABEL: Record<BackupSource, 'gm9' | 'jksv' | 'checkpoint' | '3dsdex'> = {
  gm9: 'gm9',
  jksv: 'jksv',
  checkpoint: 'checkpoint',
  '3dsdex': '3dsdex',
};

export function BackupsView() {
  const { root, fsMode, notePlan } = useSd();
  const t = useT();
  const [packages, setPackages] = useState<BackupPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    if (!root) return;
    setLoading(true);
    setError(null);
    setShowPreview(false);
    setSelected(new Set());
    try {
      setPackages(await scanBackups(root));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    void runScan();
  }, [runScan]);

  const selectedPackages = useMemo(
    () => packages.filter((pkg) => selected.has(pkg.id)),
    [packages, selected],
  );
  const plan = useMemo(
    () =>
      buildBackupExportPlan(
        selectedPackages.map((pkg) => ({ path: pkg.path, name: pkg.name, size: pkg.size })),
      ),
    [selectedPackages],
  );

  useEffect(() => {
    // Always mirror the selection, including an empty one: a cancelled or
    // cleared selection must not leave stale entries in the exported manifest.
    notePlan(plan);
  }, [plan, notePlan]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setShowPreview(false);
  };

  const handleConfirm = async () => {
    if (!root || selectedPackages.length === 0) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const bytes = await exportBackupPackages(root, selectedPackages);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `3dsdex-backups-${selectedPackages.length}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(t.dex3ds.backupsExported(selectedPackages.length));
      setShowPreview(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!root) return <p className="health3ds__empty">{t.health.openCard}</p>;

  const totalSize = packages.reduce((sum, pkg) => sum + pkg.size, 0);

  return (
    <section className="backups">
      <div className="backups__head">
        <div>
          <h2 className="health3ds__title">{t.dex3ds.backupsTitle}</h2>
          <p className="health3ds__intro">{t.dex3ds.backupsIntro}</p>
        </div>
        <button type="button" onClick={() => void runScan()} disabled={loading}>
          {loading ? t.dex3ds.backupsScanning : t.dex3ds.rescan}
        </button>
      </div>

      <p className="health3ds__protected">
        {t.dex3ds.backupsProtected} ·{' '}
        {t.dex3ds.backupsFound(packages.length, formatSize(totalSize))}
      </p>
      {message && <p className="health3ds__notice">{message}</p>}
      {error && <p className="app__error">{error}</p>}

      {packages.length === 0 ? (
        <p className="health3ds__ok">✓ {t.dex3ds.backupsNone}</p>
      ) : (
        <>
          <div className="backups__actions">
            <button
              type="button"
              onClick={() =>
                setSelected(
                  new Set(selected.size === packages.length ? [] : packages.map((p) => p.id)),
                )
              }
            >
              {selected.size === packages.length
                ? t.dex3ds.backupsUnselectAll
                : t.dex3ds.backupsSelectAll}
            </button>
            <button
              type="button"
              className="primary"
              disabled={selected.size === 0}
              onClick={() => setShowPreview(true)}
            >
              {t.dex3ds.backupsReview(selected.size)}
            </button>
          </div>

          <div className="backups__list">
            {packages.map((pkg) => (
              <label className="backups__item" key={pkg.id}>
                <input
                  type="checkbox"
                  checked={selected.has(pkg.id)}
                  onChange={() => toggle(pkg.id)}
                />
                <span className="backups__body">
                  <strong>{pkg.name}</strong>
                  <span className="backups__path">
                    <code>/{pkg.id}</code>
                  </span>
                  <span className="backups__meta">
                    {t.dex3ds.backupsSource[SOURCE_LABEL[pkg.source]]} · {formatSize(pkg.size)} ·{' '}
                    {t.dex3ds.backupsFiles(pkg.files)} ·{' '}
                    {t.dex3ds.backupsDate(formatDate(pkg.modified))}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {showPreview && (
            <ChangePreview
              plan={plan}
              mode={fsMode}
              busy={busy}
              actionLabel={t.dex3ds.backupsExport}
              onConfirm={() => void handleConfirm()}
              onCancel={() => setShowPreview(false)}
            />
          )}
        </>
      )}
    </section>
  );
}
