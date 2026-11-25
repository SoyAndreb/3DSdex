/**
 * Read-only viewer for local backup folders on a 3DS SD card:
 * `/gm9/out/`, `/JKSV/`, `/3ds/Checkpoint/` and `/luma/backups/3dsdex/`.
 *
 * A "package" is one backup unit: a single GodMode9 dump or one game/save
 * folder. Dates come from `File.lastModified`; sizes are summed from the file
 * sizes reported by the browser, without reading any bytes.
 */

import { isCriticalSystemPath } from './criticalPaths.ts';
import {
  DIR_3DS,
  DIR_GM9_OUT,
  DIR_LUMA_BACKUPS,
  formatSdPath,
} from './sd3ds.ts';
import { getDir, listEntries } from './sdcard.ts';
import { buildZip } from './zipExport.ts';

export type BackupSource = 'gm9' | 'jksv' | 'checkpoint' | '3dsdex';

export interface BackupPackage {
  /** Stable id: SD-relative path of the package. */
  id: string;
  source: BackupSource;
  /** SD-relative directory path containing this package. */
  path: readonly string[];
  name: string;
  size: number;
  files: number;
  /** Newest `lastModified` of the files inside, or `0` when unknown. */
  modified: number;
}

export interface BackupSourceSpec {
  id: BackupSource;
  path: readonly string[];
  /** `true` when each file, not each directory, is a package. */
  flat: boolean;
}

export const BACKUP_SOURCES: readonly BackupSourceSpec[] = [
  { id: 'gm9', path: DIR_GM9_OUT, flat: true },
  { id: 'jksv', path: ['JKSV'], flat: false },
  { id: 'checkpoint', path: [DIR_3DS, 'Checkpoint'], flat: false },
  { id: '3dsdex', path: [...DIR_LUMA_BACKUPS, '3dsdex'], flat: false },
];

const MAX_DEPTH = 6;

interface FolderStats {
  size: number;
  files: number;
  modified: number;
}

async function folderStats(dir: FileSystemDirectoryHandle, depth = 0): Promise<FolderStats> {
  const stats: FolderStats = { size: 0, files: 0, modified: 0 };
  if (depth > MAX_DEPTH) return stats;
  for await (const handle of dir.values()) {
    try {
      if (handle.kind === 'file') {
        const file = await handle.getFile();
        stats.size += file.size;
        stats.files += 1;
        stats.modified = Math.max(stats.modified, file.lastModified);
      } else if (depth < MAX_DEPTH) {
        const nested = await folderStats(handle, depth + 1);
        stats.size += nested.size;
        stats.files += nested.files;
        stats.modified = Math.max(stats.modified, nested.modified);
      }
    } catch {
      // One unreadable entry must not hide the rest of the backup set.
    }
  }
  return stats;
}

/** Lists backup packages grouped by source, newest first. */
export async function scanBackups(root: FileSystemDirectoryHandle): Promise<BackupPackage[]> {
  const packages: BackupPackage[] = [];
  for (const source of BACKUP_SOURCES) {
    if (isCriticalSystemPath(source.path)) continue;
    const dir = await getDir(root, source.path);
    if (dir === null) continue;
    const entries = await listEntries(dir);
    for (const entry of entries) {
      const fullPath = [...source.path, entry.name];
      if (isCriticalSystemPath(fullPath)) continue;
      let stats: FolderStats;
      if (entry.kind === 'file') {
        if (!source.flat) continue;
        try {
          const file = await (await dir.getFileHandle(entry.name)).getFile();
          stats = { size: file.size, files: 1, modified: file.lastModified };
        } catch {
          stats = { size: 0, files: 1, modified: 0 };
        }
      } else {
        const child = await dir.getDirectoryHandle(entry.name);
        stats = await folderStats(child);
      }
      packages.push({
        id: formatSdPath(fullPath),
        source: source.id,
        path: source.path,
        name: entry.name,
        size: stats.size,
        files: stats.files,
        modified: stats.modified,
      });
    }
  }
  return packages.sort((a, b) => b.modified - a.modified || a.id.localeCompare(b.id));
}

/**
 * Exports selected packages as a ZIP preserving their exact SD paths.
 * Only packages returned by {@link scanBackups} should be passed in.
 */
export async function exportBackupPackages(
  root: FileSystemDirectoryHandle,
  packages: readonly BackupPackage[],
): Promise<Uint8Array<ArrayBuffer>> {
  const entries: { path: string; data: Uint8Array; lastModified?: number }[] = [];

  async function collect(dir: FileSystemDirectoryHandle, path: readonly string[]): Promise<void> {
    if (isCriticalSystemPath(path)) return;
    for await (const handle of dir.values()) {
      const childPath = [...path, handle.name];
      if (isCriticalSystemPath(childPath)) continue;
      if (handle.kind === 'directory') {
        const child = await dir.getDirectoryHandle(handle.name);
        await collect(child, childPath);
      } else {
        const file = await (await dir.getFileHandle(handle.name)).getFile();
        entries.push({
          path: formatSdPath(childPath),
          data: new Uint8Array(await file.arrayBuffer()),
          lastModified: file.lastModified,
        });
      }
    }
  }

  for (const pkg of packages) {
    const fullPath = [...pkg.path, pkg.name];
    if (isCriticalSystemPath(fullPath)) continue;
    const dir = await getDir(root, fullPath);
    if (dir !== null) {
      await collect(dir, fullPath);
    } else {
      // Flat source (GodMode9 dumps): the package itself is a file.
      const parent = await getDir(root, pkg.path);
      if (parent === null) continue;
      try {
        const file = await (await parent.getFileHandle(pkg.name)).getFile();
        entries.push({
          path: formatSdPath(fullPath),
          data: new Uint8Array(await file.arrayBuffer()),
          lastModified: file.lastModified,
        });
      } catch {
        // Package vanished between the scan and the export: skip it.
      }
    }
  }
  return buildZip(entries);
}
