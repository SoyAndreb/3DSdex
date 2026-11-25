/**
 * Informational report on `/3ds/`.
 *
 * Nintendo 3DS accepts `homebrew.3dsx` files directly at the root of `/3ds/`;
 * that layout works as-is and is NOT a problem. App folders are only reported
 * when they are genuinely EMPTY (no files and no subfolders at all): a folder
 * holding saves, config, caches, icons or logs is perfectly normal even if it
 * has no `.3dsx` of its own (e.g. `/3ds/Checkpoint`).
 *
 * Nothing here deletes, moves or renames anything. A finding becomes a
 * `PlannedChange` only after the user explicitly selects it and reviews the
 * dry-run preview.
 */

import { isCriticalSystemPath } from './criticalPaths.ts';
import { DIR_3DS } from './sd3ds.ts';
import { getDir, listEntries } from './sdcard.ts';

export type App3dsFindingKind = 'empty-folder' | 'duplicate' | 'heavy-file';

export interface App3dsFinding {
  id: string;
  kind: App3dsFindingKind;
  /** SD-relative path of the entry. */
  path: readonly string[];
  name: string;
  size: number;
}

export interface App3dsReport {
  findings: App3dsFinding[];
  /** Directories at /3ds/ root. */
  appFolders: number;
  /** `.3dsx` directly at /3ds/ root: normal on 3DS, never a finding. */
  rootLaunchers: number;
  /** Directories at /3ds/ root with zero children of any kind. */
  emptyFolders: number;
  filesSeen: number;
}

/** Loose files above 32 MB at `/3ds/` root are worth a second look. */
export const HEAVY_FILE_BYTES = 32 * 1024 * 1024;

export const APP3DS_FINDING_KINDS: readonly App3dsFindingKind[] = [
  'empty-folder',
  'duplicate',
  'heavy-file',
];

/**
 * Pure grouping for the card UI: one group per kind, with at most `limit`
 * visible rows. The "show all" button simply raises the limit.
 */
export interface FindingGroup {
  kind: App3dsFindingKind;
  visible: readonly App3dsFinding[];
  hidden: number;
  total: number;
}

export function group3dsFindings(report: App3dsReport, limit = 4): FindingGroup[] {
  return APP3DS_FINDING_KINDS.map((kind) => {
    const all = report.findings.filter((finding) => finding.kind === kind);
    return {
      kind,
      visible: all.slice(0, limit),
      hidden: Math.max(0, all.length - limit),
      total: all.length,
    };
  }).filter((group) => group.total > 0);
}

/**
 * Reads one level of `/3ds/` plus the immediate contents of each app folder.
 * Critical system paths are always skipped, even through an unusual case
 * variant. The returned report is read-only data.
 */
export async function scan3dsApps(root: FileSystemDirectoryHandle): Promise<App3dsReport> {
  const report: App3dsReport = {
    findings: [],
    appFolders: 0,
    rootLaunchers: 0,
    emptyFolders: 0,
    filesSeen: 0,
  };
  const dir = await getDir(root, [DIR_3DS]);
  if (dir === null || isCriticalSystemPath([DIR_3DS])) return report;

  const entries = await listEntries(dir);
  const byLowerName = new Map<string, number>();

  for (const entry of entries) {
    const path = [DIR_3DS, entry.name] as const;
    if (isCriticalSystemPath(path)) continue;
    const lower = entry.name.toLowerCase();
    byLowerName.set(lower, (byLowerName.get(lower) ?? 0) + 1);
    if (entry.kind === 'file' && lower.endsWith('.3dsx')) report.rootLaunchers += 1;
  }

  for (const entry of entries) {
    const path = [DIR_3DS, entry.name] as const;
    if (isCriticalSystemPath(path)) continue;

    if (entry.kind === 'directory') {
      report.appFolders += 1;
      const folder = await dir.getDirectoryHandle(entry.name);
      // One child of any kind is enough: the folder is in use. An unreadable
      // folder is never claimed to be empty.
      let hasChildren = false;
      try {
        for await (const child of folder.values()) {
          hasChildren = true;
          void child;
          break;
        }
      } catch {
        hasChildren = true;
      }
      if (!hasChildren) {
        report.emptyFolders += 1;
        report.findings.push({
          id: `folder:${entry.name}`,
          kind: 'empty-folder',
          path,
          name: entry.name,
          size: 0,
        });
      }
      continue;
    }

    report.filesSeen += 1;
    let size = 0;
    try {
      size = (await (await dir.getFileHandle(entry.name)).getFile()).size;
    } catch {
      // unreadable size: report the name without a size claim
    }
    if (size > HEAVY_FILE_BYTES) {
      report.findings.push({
        id: `file:${entry.name}`,
        kind: 'heavy-file',
        path,
        name: entry.name,
        size,
      });
    }
  }

  for (const [lower, count] of byLowerName) {
    if (count < 2) continue;
    const original = entries.find((entry) => entry.name.toLowerCase() === lower);
    if (original === undefined) continue;
    report.findings.push({
      id: `duplicate:${lower}`,
      kind: 'duplicate',
      path: [DIR_3DS, original.name],
      name: original.name,
      size: 0,
    });
  }
  return report;
}
