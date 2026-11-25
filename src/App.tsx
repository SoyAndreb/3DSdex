import { useRef, useState, type ChangeEvent, type ComponentType } from 'react';
import { ProgressBar } from './components/ProgressBar';
import { isFileSystemAccessSupported } from './lib/sdcard';
import { SdProvider, useSd } from './state/SdContext';
import { useTheme } from './state/theme';
import { LANGUAGES, LanguageProvider, useLang, useT, type Lang } from './i18n';
import { resolveSdMessage } from './i18n/messages';
import type { Dict } from './i18n/en';
import { BackupsView } from './views/BackupsView';
import { CfwOverviewView } from './views/CfwOverviewView';
import { Health3dsView } from './views/Health3dsView';
import { HomebrewView } from './views/HomebrewView';
import { TwilightView } from './views/TwilightView';
import { Changelog } from './components/Changelog';
import { RepoCard } from './components/RepoCard';
import {
  IconArchive,
  IconChart,
  IconFolder,
  IconGrid,
  IconImage,
  IconLink,
  IconPulse,
  IconThemeDark,
  IconThemeLight,
  IconThemeSystem,
  type IconProps,
} from './components/icons';
import { nextThemePick, type ThemePick } from './lib/theme';
import './App.css';

type Tab = 'health' | 'cfw' | 'homebrew' | 'twilight' | 'backups';

type IconComponent = ComponentType<{ className?: string }>;

const TABS: { id: Tab; label: (t: Dict) => string; Icon: IconComponent }[] = [
  { id: 'health', label: (t) => t.app.tabs.health, Icon: IconPulse },
  { id: 'cfw', label: (t) => t.app.tabs.library, Icon: IconGrid },
  { id: 'homebrew', label: (t) => t.dex3ds.tabHomebrew, Icon: IconFolder },
  { id: 'twilight', label: (t) => t.dex3ds.tabTwilight, Icon: IconImage },
  { id: 'backups', label: (t) => t.dex3ds.tabBackups, Icon: IconArchive },
];

const FEATURES: {
  title: (t: Dict) => string;
  body: (t: Dict) => string;
  Icon: IconComponent;
}[] = [
  {
    title: (t) => t.welcome.features.boxArtTitle,
    body: (t) => t.welcome.features.boxArtBody,
    Icon: IconImage,
  },
  {
    title: (t) => t.welcome.features.libraryTitle,
    body: (t) => t.welcome.features.libraryBody,
    Icon: IconGrid,
  },
  {
    title: (t) => t.welcome.features.statsTitle,
    body: (t) => t.welcome.features.statsBody,
    Icon: IconChart,
  },
  {
    title: (t) => t.welcome.features.healthTitle,
    body: (t) => t.welcome.features.healthBody,
    Icon: IconPulse,
  },
  {
    title: (t) => t.welcome.features.bannersTitle,
    body: (t) => t.welcome.features.bannersBody,
    Icon: IconFolder,
  },
  {
    title: (t) => t.welcome.features.associationsTitle,
    body: (t) => t.welcome.features.associationsBody,
    Icon: IconLink,
  },
];

/** Small cartridge mark that echoes the favicon. */
function Cartridge() {
  return (
    <svg className="app__mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="6" fill="var(--bg-raised)" />
      <rect x="7" y="8" width="18" height="12" rx="2" fill="var(--accent)" />
      <rect x="10" y="11" width="12" height="6" rx="1" fill="var(--bg)" />
      <circle cx="11" cy="24" r="2" fill="var(--accent)" />
      <circle cx="21" cy="24" r="2" fill="var(--text-dim)" />
    </svg>
  );
}

/** The name in one element: as loose text "Pico" becomes its own flex item
 *  next to "Dex", and the parent's gap splits it into "Pico Dex". */
function BrandName() {
  return (
    <span>
      3DS<span className="app__brand-accent">dex</span>
    </span>
  );
}

function Wordmark() {
  return (
    <span className="app__logo">
      <Cartridge />
      <BrandName />
    </span>
  );
}

/** Landing hero shown before an SD card or local folder is opened. */
function Welcome({ onWhatsNew }: { onWhatsNew: () => void }) {
  const {
    openSd,
    openCompatFiles,
    lastCard,
    openLastCard,
    dismissLastCard,
    loading,
    progress,
    error,
  } = useSd();
  const t = useT();
  const supported = isFileSystemAccessSupported();
  const pickButton = useRef<HTMLButtonElement>(null);
  const compatInputRef = useRef<HTMLInputElement>(null);

  const handleDismiss = () => {
    dismissLastCard();
    requestAnimationFrame(() => pickButton.current?.focus());
  };

  const handleCompatChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void openCompatFiles(files);
    }
    e.target.value = '';
  };

  return (
    <div className="app__welcome">
      <h1 className="app__welcome-title">
        <Cartridge />
        <BrandName />
      </h1>
      <p className="app__tagline">{t.welcome.tagline}</p>
      <input
        ref={compatInputRef}
        type="file"
        multiple
        // @ts-expect-error webkitdirectory is supported in Firefox, Chrome, Safari, Edge
        webkitdirectory=""
        style={{ display: 'none' }}
        onChange={handleCompatChange}
      />
      {supported && lastCard != null && (
        <div className="app__last-card">
          <button
            className="primary app__cta"
            onClick={() => void openLastCard()}
            disabled={loading}
          >
            {loading ? t.welcome.opening : t.welcome.openLast(lastCard.name)}
          </button>
          <p className="app__last-card-note">
            {lastCard.ready ? t.welcome.lastCardReady : t.welcome.lastCardAskAgain}
          </p>
          <button className="app__last-card-forget" onClick={handleDismiss} disabled={loading}>
            {t.welcome.pickDifferent}
          </button>
        </div>
      )}
      {!supported ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
          <button
            className="primary app__cta"
            onClick={() => compatInputRef.current?.click()}
            disabled={loading}
          >
            {loading ? t.welcome.opening : t.welcome.openSd}
          </button>
          <p className="app__unsupported">{t.welcome.unsupported}</p>
        </div>
      ) : lastCard === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
          <button
            ref={pickButton}
            className="primary app__cta"
            onClick={() => void openSd()}
            disabled={loading}
          >
            {loading ? t.welcome.opening : t.welcome.openSd}
          </button>
          <button
            type="button"
            className="app__last-card-forget"
            onClick={() => compatInputRef.current?.click()}
            disabled={loading}
          >
            {t.dex3ds.compatOpenBtn}
          </button>
        </div>
      ) : null}
      {loading && (
        <span className="app__loading" role="status">
          <ProgressBar />
          <span className="app__loading-text">
            {progress ? resolveSdMessage(t, progress) : t.welcome.waitingForFolder}
          </span>
        </span>
      )}
      {error && <p className="app__error">{resolveSdMessage(t, error)}</p>}
      <ul className="app__features">
        {FEATURES.map(({ title, body, Icon }) => (
          <li key={title(t)}>
            <Icon className="app__feature-icon" />
            <span className="app__feature-title">{title(t)}</span>
            {body(t)}
          </li>
        ))}
      </ul>
      <button type="button" className="app__whatsnew" onClick={onWhatsNew}>
        {t.welcome.whatsNewButton}
      </button>
    </div>
  );
}

/** Tabbed workspace shown once an SD card or local folder is open. */
function Workspace() {
  const { root, error, refresh, loading, progress, fsMode, compatChanges, exportCompatZip } =
    useSd();
  const t = useT();
  const [tab, setTab] = useState<Tab>('health');
  const activeTab = TABS.some((tabDef) => tabDef.id === tab) ? tab : 'health';
  const pendingCount = compatChanges
    ? compatChanges.written.length + compatChanges.deleted.length
    : 0;

  return (
    <>
      <nav className="app__tabs" aria-label={t.app.sections}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={activeTab === id ? 'app__tab app__tab--active' : 'app__tab'}
            aria-current={activeTab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <Icon className="app__tab-icon" />
            {label(t)}
          </button>
        ))}
        <span className="app__sd-name" title={t.app.openSdFolder}>
          <span className="app__sd-dot" aria-hidden="true" />
          {root?.name}
        </span>
        {fsMode === 'direct' && (
          <button className="app__reload" onClick={() => void refresh()} disabled={loading}>
            {loading ? t.app.reloading : t.app.reload}
          </button>
        )}
      </nav>
      {fsMode === 'compat' && (
        <div
          className="card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.9rem' }}>{t.dex3ds.compatBanner}</span>
            {compatChanges && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                {t.dex3ds.compatPending(compatChanges.written.length, compatChanges.deleted.length)}
                {compatChanges.blocked.length > 0 &&
                  ` · ${t.dex3ds.previewBlocked(compatChanges.blocked.length)}`}
              </span>
            )}
          </div>
          <button
            type="button"
            className="primary"
            disabled={pendingCount === 0}
            onClick={() => void exportCompatZip()}
          >
            {t.dex3ds.compatExportBtn(pendingCount)}
          </button>
        </div>
      )}
      {loading && (
        <span className="app__loading" role="status">
          <ProgressBar />
          <span className="app__loading-text">
            {progress ? resolveSdMessage(t, progress) : t.app.reloading}
          </span>
        </span>
      )}
      {error && <p className="app__error">{resolveSdMessage(t, error)}</p>}
      <main className="app__content">
        {activeTab === 'health' && <Health3dsView />}
        {activeTab === 'cfw' && <CfwOverviewView />}
        {activeTab === 'homebrew' && <HomebrewView />}
        {activeTab === 'twilight' && <TwilightView />}
        {activeTab === 'backups' && <BackupsView />}
      </main>
    </>
  );
}

/** The language switch in the footer. The stored pick wins over the browser language. */
function LanguageToggle() {
  const { lang, setLang } = useLang();
  const t = useT();
  const option = (value: Lang, label: string) => (
    <button
      key={value}
      type="button"
      className={lang === value ? 'app__footer-link app__footer-link--active' : 'app__footer-link'}
      aria-pressed={lang === value}
      onClick={() => setLang(value)}
    >
      {label}
    </button>
  );
  return (
    <span className="app__lang-toggle" role="group" aria-label={t.app.language}>
      {LANGUAGES.map(({ code, label }) => option(code, label))}
    </span>
  );
}

const THEME_ICONS: Record<ThemePick, ComponentType<IconProps>> = {
  dark: IconThemeDark,
  light: IconThemeLight,
  system: IconThemeSystem,
};

/**
 * The theme button in the footer, next to the language switch: one icon that
 * shows the current pick, and each click moves to the next one (dark, light,
 * system). Its label and tooltip say both, since an icon alone does not.
 */
function ThemeToggle() {
  const [pick, setPick] = useTheme();
  const t = useT();
  const names: Record<ThemePick, string> = {
    dark: t.app.themeDark,
    light: t.app.themeLight,
    system: t.app.themeSystem,
  };
  const next = nextThemePick(pick);
  const label = t.app.themeButton(names[pick], names[next]);
  const Icon = THEME_ICONS[pick];
  return (
    <button
      type="button"
      className="app__footer-link app__theme-button"
      aria-label={label}
      title={label}
      onClick={() => setPick(next)}
    >
      <Icon className="app__theme-icon" />
    </button>
  );
}

function Shell() {
  const { root } = useSd();
  const t = useT();
  const [showChangelog, setShowChangelog] = useState(false);
  return (
    <div className="app">
      {/* the landing page has its own big title, so the header carries the
          wordmark only once a card is open; the repository card is on both */}
      <header className="app__header">
        {root && <Wordmark />}
        <RepoCard />
      </header>
      {root ? <Workspace /> : <Welcome onWhatsNew={() => setShowChangelog(true)} />}
      {/* three groups, each kept on one line; on narrow screens each group takes
          its own line and the separators between groups hide (see App.css) */}
      <footer className="app__footer">
        <span className="app__footer-group">
          <a href="https://github.com/SoyAndreb/3DSdex" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <span aria-hidden="true">·</span>
          <button type="button" className="app__footer-link" onClick={() => setShowChangelog(true)}>
            {t.app.whatsNew}
          </button>
        </span>
        <span className="app__footer-sep" aria-hidden="true">
          ·
        </span>
        <span className="app__footer-group">{t.app.footerLicense}</span>
        <span className="app__footer-sep" aria-hidden="true">
          ·
        </span>
        <span className="app__footer-group">
          <LanguageToggle />
          <span aria-hidden="true">·</span>
          <ThemeToggle />
        </span>
      </footer>
      {showChangelog && <Changelog onClose={() => setShowChangelog(false)} />}
    </div>
  );
}

/** PicoDex root component. */
export default function App() {
  return (
    <LanguageProvider>
      <SdProvider>
        <Shell />
      </SdProvider>
    </LanguageProvider>
  );
}
