/**
 * TWiLight Menu++ (TM++) detection, version check, and automatic boxart cover
 * downloader reusing PicoDex's libretro-thumbnails catalog + No-Intro matcher.
 */

import {
  CFW_MANIFEST,
  extractVersionFromBytes,
  identifyCfwComponent,
  type CfwComponentCheck,
} from './cfwManifest.ts';
import { isCriticalSystemPath } from './criticalPaths.ts';
import { sha256Hex } from './loaderScan.ts';
import { DEFAULT_REGION_PREFS, pickBoxart } from './matching.ts';
import {
  getDir,
  isAccessError,
  listEntries,
  MAX_SCAN_DEPTH,
  readFileBytes,
  readFileText,
  writeFileBytes,
  type LibraryFile,
} from './sdcard.ts';
import { SYSTEMS, type System } from './systems.ts';
import { boxartUrl, fetchCatalog, type CatalogFetch } from './thumbnails.ts';

export const TM_BOXART_DIR = ['_nds', 'TWiLightMenu', 'boxart'] as const;
export const TM_BASE_DIR = ['_nds', 'TWiLightMenu'] as const;

const SKIP_SCAN_ROOT_DIRS = new Set([
  'nintendo 3ds',
  'boot9strap',
  'luma',
  'gm9',
  '_nds',
  '_pico',
  'fbi',
  'nsa',
  '3ds',
  'cias',
]);

export interface TwilightStatus {
  installed: boolean;
  hasBootNds: boolean;
  hasMainSrldr: boolean;
  hasBoxartDir: boolean;
  bootstrapVer: string | null;
  versionCheck: CfwComponentCheck;
}

export interface TwilightGameCoverItem {
  game: LibraryFile;
  coverFileName: string;
  hasCover: boolean;
}

/**
 * Inspects TWiLight Menu++ installation and checks `BOOT.NDS` against `CFW_MANIFEST`.
 */
export async function inspectTwilightMenu(
  root: FileSystemDirectoryHandle,
  liveLatestTag: string | null = null,
): Promise<TwilightStatus> {
  const tmDir = await getDir(root, TM_BASE_DIR);
  const ndsDir = await getDir(root, ['_nds']);
  const boxartDir = await getDir(root, TM_BOXART_DIR);

  const bootNdsBytes = await readFileBytes(root, 'BOOT.NDS');
  const mainSrldrBytes = tmDir ? await readFileBytes(tmDir, 'main.srldr') : null;
  const bootstrapVer = ndsDir ? await readFileText(ndsDir, 'release-bootstrap.ver') : null;

  const sha = bootNdsBytes ? await sha256Hex(bootNdsBytes) : null;
  // `bootstrapVer` belongs to nds-bootstrap, a different component. TWiLight's
  // version may only come from its own files (checked by identifyCfwComponent)
  // or its own binaries; a v2.x bootstrap string is never used here.
  const binaryVersion =
    extractVersionFromBytes(bootNdsBytes ?? new Uint8Array(), 'twilight') ??
    extractVersionFromBytes(mainSrldrBytes ?? new Uint8Array(), 'twilight');
  const versionEvidence =
    binaryVersion !== null ? { version: binaryVersion, source: 'binary' as const } : null;
  const versionCheck = identifyCfwComponent(
    CFW_MANIFEST,
    'twilight',
    sha,
    bootNdsBytes?.length ?? null,
    liveLatestTag,
    versionEvidence,
  );

  return {
    installed: tmDir !== null || bootNdsBytes !== null,
    hasBootNds: bootNdsBytes !== null,
    hasMainSrldr: mainSrldrBytes !== null,
    hasBoxartDir: boxartDir !== null,
    bootstrapVer: bootstrapVer?.trim() ?? null,
    versionCheck,
  };
}

/**
 * Scans ROMs usable by TWiLight Menu++ (NDS, GBA, GB, GBC, NES, SNES, etc.)
 * outside protected 3DS system folders, and checks `/_nds/TWiLightMenu/boxart/`
 * for existing `<fileName>.png` covers.
 */
export async function scanTwilightGamesAndCovers(
  root: FileSystemDirectoryHandle,
  systems: readonly System[] = SYSTEMS,
): Promise<TwilightGameCoverItem[]> {
  const extToSystem = new Map<string, System>();
  for (const sys of systems) {
    for (const ext of sys.extensions) {
      extToSystem.set(ext.toLowerCase(), sys);
    }
  }

  const boxartDir = await getDir(root, TM_BOXART_DIR);
  const existingCovers = new Set<string>();
  if (boxartDir) {
    for (const e of await listEntries(boxartDir)) {
      if (e.kind === 'file' && e.name.toLowerCase().endsWith('.png')) {
        existingCovers.add(e.name.toLowerCase());
      }
    }
  }

  const games: LibraryFile[] = [];

  async function walk(dir: FileSystemDirectoryHandle, path: readonly string[]): Promise<void> {
    for await (const handle of dir.values()) {
      if (handle.name.startsWith('.')) continue;

      if (handle.kind === 'directory') {
        if (isCriticalSystemPath([...path, handle.name])) continue;
        if (path.length === 0 && SKIP_SCAN_ROOT_DIRS.has(handle.name.toLowerCase())) {
          continue;
        }
        if (path.length < MAX_SCAN_DEPTH) {
          try {
            await walk(handle, [...path, handle.name]);
          } catch (e) {
            if (!isAccessError(e)) throw e;
          }
        }
        continue;
      }

      if (path.length === 0 && handle.name.toUpperCase() === 'BOOT.NDS') continue;
      const dot = handle.name.lastIndexOf('.');
      if (dot <= 0) continue;
      const system = extToSystem.get(handle.name.slice(dot).toLowerCase());
      if (!system) continue;

      let size = 0;
      try {
        size = (await handle.getFile()).size;
      } catch {
        continue;
      }
      games.push({ system, fileName: handle.name, size, path });
    }
  }

  await walk(root, []);

  return games.map((game) => {
    const coverFileName = `${game.fileName}.png`;
    const basePng = `${game.fileName.replace(/\.[^.]+$/, '')}.png`.toLowerCase();
    const hasCover = existingCovers.has(coverFileName.toLowerCase()) || existingCovers.has(basePng);
    return { game, coverFileName, hasCover };
  });
}

export interface AutoCoverResult {
  totalMissing: number;
  downloaded: number;
  notFound: number;
  errors: number;
}

/**
 * Matches and downloads missing covers for TWiLight Menu++ using PicoDex's
 * `libretro-thumbnails` catalog & matcher, saving PNGs directly into
 * `/_nds/TWiLightMenu/boxart/<romFileName>.png`.
 */
export async function downloadMissingTwilightCovers(
  root: FileSystemDirectoryHandle,
  items: readonly TwilightGameCoverItem[],
  options: {
    fetcher?: typeof fetch;
    onProgress?: (done: number, total: number, currentTitle: string) => void;
  } = {},
): Promise<AutoCoverResult> {
  const missing = items.filter((i) => !i.hasCover && i.game.system.libretroRepo !== null);
  if (missing.length === 0) {
    return { totalMissing: 0, downloaded: 0, notFound: 0, errors: 0 };
  }

  const boxartDir = await getDir(root, TM_BOXART_DIR, true);
  if (!boxartDir) {
    throw new Error('Could not create /_nds/TWiLightMenu/boxart/');
  }

  const fetcher = options.fetcher ?? fetch;
  const catalogCache = new Map<string, readonly string[]>();

  let downloaded = 0;
  let notFound = 0;
  let errors = 0;

  for (let idx = 0; idx < missing.length; idx++) {
    const item = missing[idx];
    const repo = item.game.system.libretroRepo!;
    options.onProgress?.(idx, missing.length, item.game.fileName);

    try {
      let catalog = catalogCache.get(repo);
      if (!catalog) {
        catalog = await fetchCatalog(repo, fetcher as unknown as CatalogFetch);
        catalogCache.set(repo, catalog);
      }

      const romTitle = item.game.fileName.replace(/\.[^.]+$/, '');
      const match = pickBoxart(romTitle, catalog, DEFAULT_REGION_PREFS);
      if (!match) {
        notFound += 1;
        continue;
      }

      const url = boxartUrl(repo, match);
      const res = await fetcher(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        errors += 1;
        continue;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      await writeFileBytes(boxartDir, item.coverFileName, bytes);
      downloaded += 1;
    } catch {
      errors += 1;
    }
  }

  options.onProgress?.(missing.length, missing.length, '');
  return {
    totalMissing: missing.length,
    downloaded,
    notFound,
    errors,
  };
}
