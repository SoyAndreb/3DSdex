import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { fsMessage } from './fsMessage';
import type { ReactNode } from 'react';
import { forgetCard, loadLastCard, rememberCard } from '../lib/lastCard';
import {
  serializeGameData,
  setGameStats,
  toggleFlag,
  type GameData,
  type GameStats,
} from '../lib/gamedata';
import type { LoaderLists } from '../lib/loaderlists';
import type { ParsedSettings, SettingsProblem } from '../lib/settings';
import {
  createCompatRootFromFiles,
  type CompatChangeSummary,
  type CompatRootState,
  type FsMode,
} from '../lib/compatFs';
import type { ChangePlan } from '../lib/changePlan';
import {
  inspect3dsCardOverview,
  looksLike3dsSd,
  type Card3dsInfo,
} from '../lib/sd3ds';
import {
  GAMEDATA_FILE,
  PICO_DIR,
  getDir,
  pickSdRoot,
  ensureReadWritePermission,
  writeFileText,
  type LibraryFile,
} from '../lib/sdcard';

/** Launcher/loader components detected on the card. */
export interface CardInfo {
  /** Banner title of `_picoboot.nds`, or `null` when absent/invalid. */
  launcherTitle: string | null;
  /** Last-modified time of `_picoboot.nds` (ms epoch), or `null`. */
  launcherModified: number | null;
  /** Pico Loader ABI version from `picoLoader7.bin`, or `null`. */
  loaderApiVersion: number | null;
  /** True when `_picoboot.nds` is the Pico Launcher Enhanced fork (banner marker). */
  isEnhancedFork: boolean;
  /**
   * True when `/_pico/screenshots` exists. Only the fork can write there, and
   * only once someone has held START, so the gallery hides itself rather than
   * offering an empty tab to every stock card.
   */
  hasScreenshots: boolean;
}

/**
 * Names present in each cover folder, lowercased, extension included. The
 * icon and banner folders (`/_pico/icons`, `/_pico/banners`) share the layout,
 * so `iconIndex` and `bannerIndex` reuse it.
 */
export interface CoverIndex {
  nds: Set<string>;
  gba: Set<string>;
  user: Set<string>;
}

/**
 * A user-facing progress or error message, as a descriptor rather than a
 * string: the context has no business knowing the active language, so it
 * records WHAT happened and the UI renders it through the dictionary
 * (see src/i18n/messages.ts). `raw` carries texts we do not own, like a
 * DOMException message, shown as-is.
 */
export type SdMessage =
  | { key: 'scanningLibrary' }
  | { key: 'scanningLibraryCount'; count: number }
  | { key: 'readingCovers' }
  | { key: 'readingLauncherData' }
  | { key: 'waitingAccess' }
  | { key: 'needsAccess'; name: string }
  | { key: 'noPicoAnymore' }
  | { key: 'noPicoPickRoot' }
  | { key: 'noPicoOnCard' }
  | { key: 'not3dsAnymore' }
  | { key: 'not3dsPickRoot' }
  | { key: 'fsDenied' }
  | { key: 'fsNotFound' }
  | { key: 'raw'; text: string };

export interface SdState {
  root: FileSystemDirectoryHandle | null;
  /** True while opening or rescanning. */
  loading: boolean;
  /** Human-readable description of the current loading phase, when any. */
  progress: SdMessage | null;
  error: SdMessage | null;
  games: LibraryFile[];
  coverIndex: CoverIndex;
  /** Custom icon files present in `/_pico/icons/{nds,gba,user}`. */
  iconIndex: CoverIndex;
  /** Per-game banner files present in `/_pico/banners/{nds,gba,user}`. */
  bannerIndex: CoverIndex;
  /** Parsed /_pico/gamedata.json, or null on stock launchers. */
  gameData: GameData | null;
  /** Parsed /_pico/settings.json, or null when missing/unreadable. */
  settings: ParsedSettings | null;
  /**
   * Why /_pico/settings.json cannot be used when the file is there, or null.
   * Tells an unusable file apart from a missing one: the advice for a missing
   * file (run the launcher once) would make the launcher replace this one.
   */
  settingsProblem: SettingsProblem | null;
  /**
   * Whether gamedata.json and settings.json have been read for the open card.
   * Until then, a null `settings` says nothing about whether the file is there.
   */
  launcherFilesRead: boolean;
  /** Launcher/loader component info detected on the card. */
  cardInfo: CardInfo;
  /** 3DS SD card overview detected on open. */
  card3dsInfo: Card3dsInfo | null;
  /** Active filesystem mode: direct (Chromium) or compat (Firefox / input fallback). */
  fsMode: FsMode;
  /** Pending changes in compat mode (written/deleted paths). */
  compatChanges: CompatChangeSummary | null;
  /** Refreshes `compatChanges` after a compat-mode write or delete. */
  notifyCompatWrite: () => void;
  /**
   * Records the last dry-run plan. In compatible mode it becomes the
   * `3DSDEX_CAMBIOS.txt` manifest inside the exported `.zip`.
   */
  notePlan: (plan: ChangePlan) => void;
  /** Opens a local folder / SD card in compat mode from a FileList. */
  openCompatFiles: (files: Iterable<File>) => Promise<void>;
  /** Downloads pending compat-mode changes as a `.zip` preserving SD paths. */
  exportCompatZip: () => Promise<void>;
  /**
   * Parsed loader compatibility lists (`/_pico/aplist.bin`, `savelist.bin`,
   * `patchlist.bin`), or `null` until a card is open. Once open, each per-list
   * field is `null` when its file is absent or unparseable.
   */
  loaderLists: LoaderLists | null;
  openSd: () => Promise<void>;
  /**
   * The card from the last visit, offered so a return visit skips the picker.
   * `undefined` while we are still looking, `null` when there is none or once
   * one has been opened or dismissed.
   */
  lastCard: { name: string; ready: boolean } | null | undefined;
  /**
   * Opens the remembered card. Asks for permission when it has lapsed, so call
   * this from a click. Forgets the card and resolves false if it is gone.
   */
  openLastCard: () => Promise<boolean>;
  /** Stops offering the remembered card, without touching the open one. */
  dismissLastCard: () => void;
  /**
   * Re-reads library, covers and launcher files from the open SD. Resolves
   * `false` when the re-read failed (the message lands in `error`) — callers
   * whose results depend on a current library must not proceed then.
   */
  refresh: () => Promise<boolean>;
  /**
   * Toggles a game's favorite flag and writes `/_pico/gamedata.json` back to
   * the card. No-op on stock launchers (`gameData === null`): PicoDex never
   * creates the file — a stock launcher would not read it and a stray file
   * would only confuse users. Concurrent calls queue behind each other; the
   * returned promise never rejects — write failures surface via `error`.
   */
  toggleFavorite(fileName: string, gameCode?: string | null): Promise<void>;
  /** Same contract as {@link toggleFavorite}, for the completed flag. */
  toggleCompleted(fileName: string, gameCode?: string | null): Promise<void>;
  /**
   * Overwrites a game's launch count and play time, same write contract as
   * {@link toggleFavorite} (queued, never rejects, no-op on stock launchers).
   */
  setStats(fileName: string, gameCode: string | null | undefined, stats: GameStats): Promise<void>;
}

const SdContext = createContext<SdState | null>(null);

const EMPTY_CARD_INFO: CardInfo = {
  launcherTitle: null,
  launcherModified: null,
  loaderApiVersion: null,
  isEnhancedFork: false,
  hasScreenshots: false,
};

export function SdProvider({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<FileSystemDirectoryHandle | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<SdMessage | null>(null);
  const [error, setError] = useState<SdMessage | null>(null);
  const [games] = useState<LibraryFile[]>([]);
  const [coverIndex] = useState<CoverIndex>({
    nds: new Set(),
    gba: new Set(),
    user: new Set(),
  });
  const [iconIndex] = useState<CoverIndex>({
    nds: new Set(),
    gba: new Set(),
    user: new Set(),
  });
  const [bannerIndex] = useState<CoverIndex>({
    nds: new Set(),
    gba: new Set(),
    user: new Set(),
  });
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [settings] = useState<ParsedSettings | null>(null);
  const [settingsProblem] = useState<SettingsProblem | null>(null);
  const [launcherFilesRead, setLauncherFilesRead] = useState(false);
  const [cardInfo] = useState<CardInfo>(EMPTY_CARD_INFO);
  const [card3dsInfo, setCard3dsInfo] = useState<Card3dsInfo | null>(null);
  const [fsMode, setFsMode] = useState<FsMode>('direct');
  const compatStateRef = useRef<CompatRootState | null>(null);
  const [compatChanges, setCompatChanges] = useState<CompatChangeSummary | null>(null);
  const [loaderLists] = useState<LoaderLists | null>(null);
  /**
   * Mirror of `gameData` for the write queue: a queued toggle must build on
   * the data of the toggle that just finished, not on the (possibly stale)
   * state its closure captured when the user clicked.
   */
  const gameDataRef = useRef<GameData | null>(null);
  /** Serializes gamedata.json writes: each toggle queues behind the last. */
  const writeChain = useRef<Promise<void>>(Promise.resolve());

  const loadFrom = useCallback(async (rootHandle: FileSystemDirectoryHandle) => {
    await writeChain.current;
    setProgress({ key: 'readingLauncherData' });
    setCard3dsInfo(await inspect3dsCardOverview(rootHandle));
    setLauncherFilesRead(true);
    setProgress(null);
  }, []);

  // Card from the last visit. Only a query, never a prompt, so this is safe on
  // load; opening it is a separate, user-initiated step. `undefined` while the
  // lookup is still running, so the welcome screen can wait rather than offer
  // the picker and swap it out from under the pointer a moment later.
  const [lastCardHandle, setLastCardHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [lastCard, setLastCard] = useState<{ name: string; ready: boolean } | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    void loadLastCard().then((remembered) => {
      if (cancelled) return;
      if (remembered === null) {
        setLastCard(null);
        return;
      }
      setLastCardHandle(remembered.handle);
      setLastCard({ name: remembered.handle.name, ready: remembered.ready });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissLastCard = useCallback(() => {
    setLastCard(null);
    setLastCardHandle(null);
    void forgetCard();
  }, []);

  const openLastCard = useCallback(async (): Promise<boolean> => {
    if (lastCardHandle === null) return false;
    setError(null);
    setLoading(true);
    try {
      setProgress({ key: 'waitingAccess' });
      if (!(await ensureReadWritePermission(lastCardHandle))) {
        // Denying the prompt is a choice, not a failure, but saying nothing
        // looks like a dead button. The card stays remembered so it can be
        // opened on the next try.
        setError({ key: 'needsAccess', name: lastCardHandle.name });
        return false;
      }
      if (!(await looksLike3dsSd(lastCardHandle))) {
        // the folder is still there but is not a 3DS card any more
        setError({ key: 'not3dsAnymore' });
        dismissLastCard();
        return false;
      }
      compatStateRef.current = null;
      setCompatChanges(null);
      setFsMode('direct');
      setRoot(lastCardHandle);
      setLastCard(null);
      await loadFrom(lastCardHandle);
      return true;
    } catch (e) {
      // Keep the card remembered: a read that failed once (a card pulled mid
      // scan, a locked file) says nothing about whether it will work next time,
      // and forgetting it would send the user back to the picker for good.
      setError(fsMessage(e));
      return false;
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [lastCardHandle, loadFrom, dismissLastCard]);

  const openSd = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const rootHandle = await pickSdRoot();
      if (!(await looksLike3dsSd(rootHandle))) {
        setError({ key: 'not3dsPickRoot' });
        return;
      }
      compatStateRef.current = null;
      setCompatChanges(null);
      setFsMode('direct');
      setRoot(rootHandle);
      setLastCard(null);
      void rememberCard(rootHandle);
      await loadFrom(rootHandle);
    } catch (e) {
      // user cancelling the picker is not an error
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(fsMessage(e));
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [loadFrom]);

  const notifyCompatWrite = useCallback(() => {
    if (compatStateRef.current) {
      setCompatChanges(compatStateRef.current.getChanges());
    }
  }, []);

  const notePlan = useCallback((plan: ChangePlan) => {
    compatStateRef.current?.notePlan(plan);
  }, []);

  const openCompatFiles = useCallback(
    async (files: Iterable<File>) => {
      setError(null);
      setLoading(true);
      try {
        const compat = createCompatRootFromFiles(files);
        if (!(await looksLike3dsSd(compat.handle))) {
          setError({ key: 'not3dsPickRoot' });
          return;
        }
        compatStateRef.current = compat;
        setCompatChanges(compat.getChanges());
        setFsMode('compat');
        setRoot(compat.handle);
        setLastCard(null);
        await loadFrom(compat.handle);
      } catch (e) {
        setError(fsMessage(e));
      } finally {
        setLoading(false);
        setProgress(null);
      }
    },
    [loadFrom],
  );

  const exportCompatZip = useCallback(async () => {
    if (!compatStateRef.current) return;
    const bytes = await compatStateRef.current.exportZip();
    const blob = new Blob([bytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `3dsdex-${compatStateRef.current.rootName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Tail of the rescan queue. Two rescans running at once would interleave
   * their state writes and the first to finish would hide the other's
   * progress, so a rescan requested during one QUEUES behind it rather than
   * joining it: a caller that has just written to the card must get a read
   * that postdates its write, and the scan already running does not.
   */
  const refreshQueue = useRef<Promise<unknown>>(Promise.resolve());

  const refresh = useCallback((): Promise<boolean> => {
    if (!root) return Promise.resolve(false);
    const rootHandle = root;
    async function run(): Promise<boolean> {
      setLoading(true);
      // a fresh read replaces whatever the last one reported
      setError(null);
      try {
        await loadFrom(rootHandle);
        return true;
      } catch (e) {
        setError(fsMessage(e));
        return false;
      } finally {
        setLoading(false);
        setProgress(null);
      }
    }
    const next = refreshQueue.current.then(run, run);
    // the queue must survive a rejected scan, and never leave one unhandled
    refreshQueue.current = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }, [root, loadFrom]);

  // Serialized gamedata.json write: applies `mutate` to the current data,
  // writes the result to the card, then commits it to state (write-then-state
  // so a failed write never desyncs us). Each call queues behind the last on
  // writeChain. Stock launcher (no gamedata.json) is a no-op: PicoDex never
  // creates the file (see the SdState doc above).
  const runGameDataWrite = useCallback(
    (mutate: (data: GameData) => GameData): Promise<void> => {
      const run = async (): Promise<void> => {
        if (root === null || gameDataRef.current === null) return;
        try {
          const next = mutate(gameDataRef.current);
          const text = serializeGameData(next);
          const picoDir = await getDir(root, [PICO_DIR]);
          if (picoDir === null) {
            setError({ key: 'noPicoOnCard' });
            return;
          }
          await writeFileText(picoDir, GAMEDATA_FILE, text);
          gameDataRef.current = next;
          setGameData(next);
        } catch (e) {
          setError(fsMessage(e));
        }
      };
      // queue, don't reject: `run` handles its own failures, so the chain
      // always settles and later writes still go through
      const queued = writeChain.current.then(run);
      writeChain.current = queued;
      return queued;
    },
    [root],
  );

  const toggleFavorite = useCallback(
    (fileName: string, gameCode?: string | null): Promise<void> =>
      runGameDataWrite((data) => toggleFlag(data, fileName, gameCode, 'favorite')),
    [runGameDataWrite],
  );

  const toggleCompleted = useCallback(
    (fileName: string, gameCode?: string | null): Promise<void> =>
      runGameDataWrite((data) => toggleFlag(data, fileName, gameCode, 'completed')),
    [runGameDataWrite],
  );

  const setStats = useCallback(
    (fileName: string, gameCode: string | null | undefined, stats: GameStats): Promise<void> =>
      runGameDataWrite((data) => setGameStats(data, fileName, gameCode, stats)),
    [runGameDataWrite],
  );

  const value = useMemo(
    () => ({
      root,
      loading,
      progress,
      error,
      games,
      coverIndex,
      iconIndex,
      bannerIndex,
      gameData,
      settings,
      settingsProblem,
      launcherFilesRead,
      cardInfo,
      card3dsInfo,
      fsMode,
      compatChanges,
      notifyCompatWrite,
      notePlan,
      openCompatFiles,
      exportCompatZip,
      loaderLists,
      openSd,
      lastCard,
      openLastCard,
      dismissLastCard,
      refresh,
      toggleFavorite,
      toggleCompleted,
      setStats,
    }),
    [
      root,
      loading,
      progress,
      error,
      games,
      coverIndex,
      iconIndex,
      bannerIndex,
      gameData,
      settings,
      settingsProblem,
      launcherFilesRead,
      cardInfo,
      card3dsInfo,
      fsMode,
      compatChanges,
      notifyCompatWrite,
      notePlan,
      openCompatFiles,
      exportCompatZip,
      loaderLists,
      openSd,
      lastCard,
      openLastCard,
      dismissLastCard,
      refresh,
      toggleFavorite,
      toggleCompleted,
      setStats,
    ],
  );

  return <SdContext.Provider value={value}>{children}</SdContext.Provider>;
}

/** Access the SD state; must be used under an SdProvider. */
// eslint-disable-next-line react-refresh/only-export-components -- context + hook is the idiomatic pairing
export function useSd(): SdState {
  const state = useContext(SdContext);
  if (!state) throw new Error('useSd must be used within SdProvider');
  return state;
}
