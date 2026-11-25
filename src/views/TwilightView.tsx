import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSd } from '../state/SdContext';
import { useT } from '../i18n';
import { fetchLatestGithubTag } from '../lib/cfwScan';
import { createChangePlan } from '../lib/changePlan';
import { TM_BOXART_DIR } from '../lib/twilightMenu';
import { ChangePreview } from '../components/ChangePreview';
import { PostUpdateChecklist } from '../components/PostUpdateChecklist';
import {
  downloadMissingTwilightCovers,
  inspectTwilightMenu,
  scanTwilightGamesAndCovers,
  type AutoCoverResult,
  type TwilightGameCoverItem,
  type TwilightStatus,
} from '../lib/twilightMenu';

export function TwilightView() {
  const { root, fsMode, notifyCompatWrite, notePlan } = useSd();
  const t = useT();
  const [status, setStatus] = useState<TwilightStatus | null>(null);
  const [games, setGames] = useState<TwilightGameCoverItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [result, setResult] = useState<AutoCoverResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);

  const scan = useCallback(async () => {
    if (!root) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [tmStatus, tmGames] = await Promise.all([
        inspectTwilightMenu(root),
        scanTwilightGamesAndCovers(root),
      ]);
      setStatus(tmStatus);
      setGames(tmGames);
      void fetchLatestGithubTag('DS-Homebrew/TWiLightMenu').then(async (tag) => {
        if (tag && root) {
          setStatus(await inspectTwilightMenu(root, tag));
        }
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    void scan();
  }, [scan]);

  const coverPlan = useMemo(
    () =>
      createChangePlan(
        games
          .filter((g) => !g.hasCover && g.game.system.libretroRepo !== null)
          .map((g) => ({
            kind: 'create' as const,
            path: [...TM_BOXART_DIR, g.coverFileName].join('/'),
            reason: 'cover' as const,
          })),
      ),
    [games],
  );

  useEffect(() => {
    notePlan(showPreview ? coverPlan : { changes: [], blocked: [] });
  }, [showPreview, coverPlan, notePlan]);

  const handleDownloadCovers = async () => {
    if (!root) return;
    setDownloading(true);
    setResult(null);
    setErrorMsg(null);
    try {
      const res = await downloadMissingTwilightCovers(root, games, {
        onProgress: (done, total, title) => {
          setProgressText(`${done}/${total}${title ? ` · ${title}` : ''}`);
        },
      });
      notifyCompatWrite();
      setResult(res);
      setShowPreview(false);
      await scan();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
      setProgressText(null);
    }
  };

  if (!root) return null;

  const missingCount = games.filter((g) => !g.hasCover).length;
  const coveredCount = games.length - missingCount;

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
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{t.dex3ds.tmTitle}</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            {t.dex3ds.tmIntro}
          </p>
        </div>
        <button type="button" onClick={() => void scan()} disabled={loading || downloading}>
          {loading ? t.app.reloading : t.dex3ds.rescan}
        </button>
      </div>

      {errorMsg && <p className="app__error">{errorMsg}</p>}

      {status && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h3 className="section-title">{t.dex3ds.tmStatusTitle}</h3>
          <ul
            style={{
              margin: 0,
              paddingLeft: '1.1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
              fontSize: '0.9rem',
            }}
          >
            <li>
              <code>/BOOT.NDS</code>: {status.hasBootNds ? '✓' : '✗'} ·{' '}
              <code>/_nds/TWiLightMenu/main.srldr</code>: {status.hasMainSrldr ? '✓' : '✗'}
            </li>
            <li>
              {t.dex3ds.versionLabel}:{' '}
              <strong>
                {status.versionCheck.status === 'up-to-date' &&
                  `${t.dex3ds.statusUpToDate} (${status.versionCheck.detectedVersion})`}
                {status.versionCheck.status === 'outdated' &&
                  `${t.dex3ds.statusOutdated} (${status.versionCheck.detectedVersion} → ${status.versionCheck.latestVersion})`}
                {(status.versionCheck.status === 'unrecognised' ||
                  status.versionCheck.status === 'unknown-version') &&
                  `${t.dex3ds.statusUnknownVersion} (${t.dex3ds.latestLabel}: ${status.versionCheck.latestVersion})`}
                {status.versionCheck.status === 'missing' && t.dex3ds.statusMissing}
              </strong>
            </li>
            {status.bootstrapVer && (
              <li>
                <code>nds-bootstrap</code>: <code>{status.bootstrapVer}</code>
              </li>
            )}
          </ul>
          <button type="button" onClick={() => setShowChecklist(true)}>
            {t.dex3ds.checklistTitle}
          </button>
        </div>
      )}

      {showChecklist && (
        <PostUpdateChecklist
          components={['twilight']}
          mode={fsMode}
          onClose={() => setShowChecklist(false)}
        />
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <h3 className="section-title">{t.dex3ds.tmCoversTitle}</h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'var(--text-dim)' }}>
              {t.dex3ds.tmCoversSummary(games.length, coveredCount, missingCount)}
            </p>
          </div>
          <button
            type="button"
            className="primary"
            disabled={downloading || missingCount === 0}
            onClick={() => setShowPreview(true)}
          >
            {downloading
              ? (progressText ?? t.dex3ds.tmDownloading)
              : t.dex3ds.tmDownloadMissing(missingCount)}
          </button>
        </div>

        {showPreview && (
          <ChangePreview
            plan={coverPlan}
            mode={fsMode}
            busy={downloading}
            actionLabel={t.dex3ds.tmDownloadMissing(missingCount)}
            onConfirm={() => void handleDownloadCovers()}
            onCancel={() => setShowPreview(false)}
          />
        )}

        {result && (
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
            {t.dex3ds.tmDownloadResult(result.downloaded, result.notFound, result.errors)}
          </p>
        )}

        {games.length > 0 && (
          <ul
            style={{
              margin: 0,
              paddingLeft: '1.1rem',
              maxHeight: '260px',
              overflowY: 'auto',
              fontSize: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            {games.slice(0, 100).map((item) => (
              <li key={`${item.game.path.join('/')}/${item.game.fileName}`}>
                <span style={{ color: item.hasCover ? 'var(--ok)' : 'var(--warn)' }}>
                  {item.hasCover ? '✓ ' : '○ '}
                </span>
                <strong>{item.game.fileName}</strong>{' '}
                <span style={{ color: 'var(--text-dim)' }}>
                  ({item.game.system.id.toUpperCase()}) →{' '}
                  <code>/_nds/TWiLightMenu/boxart/{item.coverFileName}</code>
                </span>
              </li>
            ))}
            {games.length > 100 && (
              <li style={{ color: 'var(--text-dim)' }}>+{games.length - 100} …</li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
