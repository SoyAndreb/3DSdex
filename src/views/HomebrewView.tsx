import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSd } from '../state/SdContext';
import { ChangePreview } from '../components/ChangePreview';
import { buildWritePlan, type ChangePlan } from '../lib/changePlan';
import { useT } from '../i18n';
import {
  crossReferenceApps,
  downloadAndInstallHomebrew,
  loadUniversalDbCatalog,
  scanInstalledHomebrew,
  type CrossReferencedApp,
  type UniversalDbDownload,
} from '../lib/universalDb';

export function HomebrewView() {
  const { root, fsMode, notifyCompatWrite, notePlan } = useSd();
  const t = useT();
  const [apps, setApps] = useState<CrossReferencedApp[]>([]);
  const [source, setSource] = useState<'live' | 'cache' | 'fallback' | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [onlyInstalled, setOnlyInstalled] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingInstall, setPendingInstall] = useState<{
    app: CrossReferencedApp;
    download: UniversalDbDownload;
    plan: ChangePlan;
  } | null>(null);

  const loadAll = useCallback(
    async (forceRefresh = false) => {
      if (!root) return;
      setLoading(true);
      setErrorMsg(null);
      try {
        const [{ apps: catalog, source: catSource }, installed] = await Promise.all([
          loadUniversalDbCatalog({ forceRefresh }),
          scanInstalledHomebrew(root),
        ]);
        setSource(catSource);
        setApps(crossReferenceApps(catalog, installed));
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [root],
  );

  useEffect(() => {
    void loadAll(false);
  }, [loadAll]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const app of apps) {
      for (const c of app.categories) set.add(c);
    }
    return ['all', ...Array.from(set).sort()];
  }, [apps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter((app) => {
      if (onlyInstalled && !app.installed) return false;
      if (category !== 'all' && !app.categories.includes(category)) return false;
      if (!q) return true;
      return (
        app.title.toLowerCase().includes(q) ||
        app.author.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q)
      );
    });
  }, [apps, query, category, onlyInstalled]);

  const handleInstall = async (app: CrossReferencedApp, dl: UniversalDbDownload) => {
    if (!root) return;
    setBusyId(app.id);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      notePlan(buildWritePlan([...dl.targetSegments, dl.fileName].join('/'), 'homebrew'));
      const res = await downloadAndInstallHomebrew(root, dl);
      notifyCompatWrite();
      setStatusMsg(
        res.backedUpPath
          ? `${app.title} → /${res.writtenPath} (respaldo en /${res.backedUpPath})`
          : `${app.title} → /${res.writtenPath}`,
      );
      await loadAll(false);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  if (!root) return null;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{t.dex3ds.homebrewTitle}</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            {t.dex3ds.homebrewIntro}
            {source ? ` (${source})` : ''}
          </p>
        </div>
        <button type="button" onClick={() => void loadAll(true)} disabled={loading}>
          {loading ? t.app.reloading : t.dex3ds.homebrewRefresh}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          placeholder={t.dex3ds.homebrewSearch}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minWidth: '220px', flex: '1 1 220px' }}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? t.dex3ds.homebrewAllCategories : c}
            </option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={onlyInstalled}
            onChange={(e) => setOnlyInstalled(e.target.checked)}
          />
          {t.dex3ds.homebrewOnlyInstalled}
        </label>
      </div>

      {statusMsg && (
        <p
          style={{
            margin: 0,
            padding: '0.6rem 0.85rem',
            borderRadius: 'var(--radius)',
            background: 'var(--ok-soft)',
            color: 'var(--ok)',
            fontSize: '0.9rem',
          }}
        >
          {statusMsg}
        </p>
      )}
      {errorMsg && <p className="app__error">{errorMsg}</p>}
      {pendingInstall !== null && (
        <ChangePreview
          plan={pendingInstall.plan}
          mode={fsMode}
          busy={busyId === pendingInstall.app.id}
          actionLabel={t.dex3ds.installBtn}
          onConfirm={() => {
            const { app, download } = pendingInstall;
            setPendingInstall(null);
            void handleInstall(app, download);
          }}
          onCancel={() => setPendingInstall(null)}
        />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: '0.85rem',
        }}
      >
        {filtered.slice(0, 60).map((app) => (
          <article
            key={app.id}
            className="card"
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                {app.icon && (
                  <img
                    src={app.icon}
                    alt=""
                    width={36}
                    height={36}
                    style={{ borderRadius: '6px', objectFit: 'cover', background: 'var(--well)' }}
                    loading="lazy"
                  />
                )}
                <div>
                  <strong style={{ fontSize: '1rem' }}>{app.title}</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    {app.author} {app.version ? `· ${app.version}` : ''}
                  </div>
                </div>
              </div>
              {app.installed && (
                <span
                  style={{
                    alignSelf: 'flex-start',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    background: 'var(--ok-soft)',
                    color: 'var(--ok)',
                  }}
                >
                  {t.dex3ds.installedBadge}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-dim)' }}>
              {app.description}
            </p>
            {app.installedAt && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                <code>{app.installedAt}</code>
              </div>
            )}
            {app.primaryDownload && (
              <div style={{ marginTop: 'auto', paddingTop: '0.35rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="primary"
                  disabled={busyId === app.id}
                  onClick={() =>
                    setPendingInstall({
                      app,
                      download: app.primaryDownload!,
                      plan: buildWritePlan(
                        [...app.primaryDownload!.targetSegments, app.primaryDownload!.fileName].join('/'),
                        'homebrew',
                      ),
                    })
                  }
                >
                  {busyId === app.id
                    ? t.dex3ds.installing
                    : app.installed
                      ? `${t.dex3ds.updateBtn} (${app.primaryDownload.kind})`
                      : `${t.dex3ds.installBtn} (${app.primaryDownload.kind})`}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
