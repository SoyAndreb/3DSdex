/**
 * Universal-DB / Universal-Updater catalog integration for 3DSdex.
 *
 * Fetches `https://db.universal-team.net/data/full.json`, caches in
 * localStorage, and falls back to `src/data/universalDbFallback.json` when
 * offline. Cross-references apps against `/3ds/`, `/cias/`, `/luma/payloads/`,
 * `/fbi/`, and `/nsa/`.
 */

import fallbackApps from '../data/universalDbFallback.json';
import { compareTags } from './cfwManifest.ts';
import { safeOverwriteFile, type SafeWriteResult } from './safeBackup.ts';
import { DIR_3DS, DIR_CIAS, DIR_FBI, DIR_LUMA_PAYLOADS, DIR_NSA } from './sd3ds.ts';
import { getDir, listEntries } from './sdcard.ts';

export const UNIVERSAL_DB_URL = 'https://db.universal-team.net/data/full.json';
const CACHE_KEY = '3dsdex-universal-db-v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

export interface UniversalDbDownload {
  fileName: string;
  url: string;
  kind: '3dsx' | 'cia' | 'firm' | 'other';
  targetSegments: readonly string[];
}

export interface UniversalDbApp {
  id: string;
  title: string;
  author: string;
  description: string;
  version: string;
  categories: string[];
  icon: string | null;
  github: string | null;
  downloads: UniversalDbDownload[];
}

export interface InstalledHomebrewIndex {
  files3ds: Set<string>;
  dirs3ds: Set<string>;
  cias: Set<string>;
  payloads: Set<string>;
  hasFbiDir: boolean;
  hasNsaDir: boolean;
}

export interface CrossReferencedApp extends UniversalDbApp {
  installed: boolean;
  installedAt: string | null;
  primaryDownload: UniversalDbDownload | null;
}

function classifyDownload(fileName: string): {
  kind: UniversalDbDownload['kind'];
  targetSegments: readonly string[];
} {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.3dsx')) return { kind: '3dsx', targetSegments: [DIR_3DS] };
  if (lower.endsWith('.cia')) return { kind: 'cia', targetSegments: [DIR_CIAS] };
  if (lower.endsWith('.firm')) return { kind: 'firm', targetSegments: DIR_LUMA_PAYLOADS };
  return { kind: 'other', targetSegments: [DIR_3DS] };
}

/** Normalizes raw Universal-DB JSON entries to 3DS apps. */
export function parseUniversalDbEntries(raw: unknown): UniversalDbApp[] {
  if (!Array.isArray(raw)) return [];
  const out: UniversalDbApp[] = [];

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const obj = item as Record<string, unknown>;
    const systems = Array.isArray(obj.systems)
      ? obj.systems.filter((s): s is string => typeof s === 'string')
      : ['3DS'];
    if (systems.length > 0 && !systems.some((s) => s.toUpperCase() === '3DS')) {
      continue;
    }

    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    if (!title) continue;

    const downloads: UniversalDbDownload[] = [];
    if (typeof obj.downloads === 'object' && obj.downloads !== null) {
      for (const [fileName, meta] of Object.entries(obj.downloads as Record<string, unknown>)) {
        if (typeof meta === 'object' && meta !== null && 'url' in meta) {
          const url = (meta as { url?: unknown }).url;
          if (typeof url === 'string' && url.startsWith('http')) {
            const { kind, targetSegments } = classifyDownload(fileName);
            downloads.push({ fileName, url, kind, targetSegments });
          }
        }
      }
    }

    out.push({
      id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title,
      author: typeof obj.author === 'string' ? obj.author : 'Unknown',
      description: typeof obj.description === 'string' ? obj.description : '',
      version: typeof obj.version === 'string' ? obj.version : '',
      categories: Array.isArray(obj.categories)
        ? obj.categories.filter((c): c is string => typeof c === 'string')
        : [],
      icon: typeof obj.icon === 'string' ? obj.icon : typeof obj.image === 'string' ? obj.image : null,
      github: typeof obj.github === 'string' ? obj.github : null,
      downloads,
    });
  }

  return out;
}

export async function loadUniversalDbCatalog(options: {
  forceRefresh?: boolean;
  fetcher?: typeof fetch;
} = {}): Promise<{ apps: UniversalDbApp[]; source: 'live' | 'cache' | 'fallback' }> {
  if (!options.forceRefresh && typeof localStorage !== 'undefined') {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { savedAt: number; data: unknown };
        if (Date.now() - parsed.savedAt < CACHE_TTL_MS) {
          const apps = parseUniversalDbEntries(parsed.data);
          if (apps.length > 0) return { apps, source: 'cache' };
        }
      }
    } catch {
      // ignore broken cache
    }
  }

  const doFetch = options.fetcher ?? fetch;
  try {
    const res = await doFetch(UNIVERSAL_DB_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.ok) {
      const json: unknown = await res.json();
      const apps = parseUniversalDbEntries(json);
      if (apps.length > 0) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: json }));
        } catch {
          // quota exceeded
        }
        return { apps, source: 'live' };
      }
    }
  } catch {
    // offline or CORS/timeout -> fallback
  }

  return {
    apps: parseUniversalDbEntries(fallbackApps),
    source: 'fallback',
  };
}

/** Collects installed homebrew file/folder names from the SD card. */
export async function scanInstalledHomebrew(
  root: FileSystemDirectoryHandle,
): Promise<InstalledHomebrewIndex> {
  const rootEntries = await listEntries(root);
  const dir3ds = await getDir(root, [DIR_3DS]);
  const dirCias = await getDir(root, [DIR_CIAS]);
  const dirPayloads = await getDir(root, DIR_LUMA_PAYLOADS);

  const files3ds = new Set<string>();
  const dirs3ds = new Set<string>();
  if (dir3ds) {
    for (const e of await listEntries(dir3ds)) {
      if (e.kind === 'file') files3ds.add(e.name.toLowerCase());
      else dirs3ds.add(e.name.toLowerCase());
    }
  }

  const cias = new Set<string>();
  if (dirCias) {
    for (const e of await listEntries(dirCias)) {
      if (e.kind === 'file') cias.add(e.name.toLowerCase());
    }
  }

  const payloads = new Set<string>();
  if (dirPayloads) {
    for (const e of await listEntries(dirPayloads)) {
      if (e.kind === 'file') payloads.add(e.name.toLowerCase());
    }
  }

  return {
    files3ds,
    dirs3ds,
    cias,
    payloads,
    hasFbiDir: rootEntries.some((e) => e.kind === 'directory' && e.name.toLowerCase() === DIR_FBI),
    hasNsaDir: rootEntries.some((e) => e.kind === 'directory' && e.name.toLowerCase() === DIR_NSA),
  };
}

/**
 * Matches Universal-DB apps against what is installed on the SD card.
 */
export function crossReferenceApps(
  apps: readonly UniversalDbApp[],
  index: InstalledHomebrewIndex,
): CrossReferencedApp[] {
  return apps.map((app) => {
    const primaryDownload =
      app.downloads.find((d) => d.kind === '3dsx') ??
      app.downloads.find((d) => d.kind === 'cia') ??
      app.downloads.find((d) => d.kind === 'firm') ??
      app.downloads[0] ??
      null;

    const normTitle = app.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    let installedAt: string | null = null;

    if (normTitle === 'nsa' && index.hasNsaDir) {
      installedAt = '/nsa/';
    } else if (normTitle === 'fbi' && index.hasFbiDir) {
      installedAt = '/fbi/';
    }

    if (!installedAt) {
      for (const dl of app.downloads) {
        const lower = dl.fileName.toLowerCase();
        if (dl.kind === '3dsx' && index.files3ds.has(lower)) {
          installedAt = `/3ds/${dl.fileName}`;
          break;
        }
        if (dl.kind === 'cia' && index.cias.has(lower)) {
          installedAt = `/cias/${dl.fileName}`;
          break;
        }
        if (dl.kind === 'firm' && index.payloads.has(lower)) {
          installedAt = `/luma/payloads/${dl.fileName}`;
          break;
        }
      }
    }

    if (!installedAt) {
      for (const d of index.dirs3ds) {
        if (d.replace(/[^a-z0-9]/g, '') === normTitle) {
          installedAt = `/3ds/${d}/`;
          break;
        }
      }
    }

    return {
      ...app,
      installed: installedAt !== null,
      installedAt,
      primaryDownload,
    };
  });
}

/**
 * Downloads a `.3dsx`, `.cia`, or `.firm` asset and writes it safely to its
 * standard SD path (backing up any existing file first via `safeOverwriteFile`).
 */
export async function downloadAndInstallHomebrew(
  root: FileSystemDirectoryHandle,
  download: UniversalDbDownload,
  fetcher: typeof fetch = fetch,
): Promise<SafeWriteResult> {
  const res = await fetcher(download.url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}) for ${download.fileName}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return safeOverwriteFile(root, download.targetSegments, download.fileName, bytes);
}

export { compareTags };
