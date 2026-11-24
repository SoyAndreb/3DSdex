/**
 * Pure audit logic and card walker for 3DSdex Health & Maintenance.
 *
 * Inspects a 3DS SD card (or local working/backup copy) for:
 * - OS junk files/folders (macOS `._*`, `.DS_Store`, `.fseventsd` without `no_log`, etc.)
 * - Critical CFW/homebrew files (`boot.firm`, `boot.3dsx`, `/luma/payloads/GodMode9.firm`)
 * - Misplaced files at root (loose `.cia` -> `/cias/`, loose `.3dsx` -> `/3ds/`)
 * - FBI / NSA detection rule:
 *   - If NSA folder is detected -> NO recommendation/notice is shown (even if FBI is also present).
 *   - If FBI folder is detected and NSA is NOT detected -> recommend installing NSA.
 */

import {
  JUNK_DIR_NAMES,
  isJunkFileName,
  isPreventionOnlyFsevents,
} from './health.ts';
import {
  DIR_3DS,
  DIR_CIAS,
  DIR_FBI,
  DIR_NSA,
  PROTECTED_ROOT_DIRS,
} from './sd3ds.ts';
import { MAX_SCAN_DEPTH, isAccessError, listEntries } from './sdcard.ts';
import type { JunkDir, JunkFile } from './scan.ts';

export const NSA_REPO_URL = 'https://github.com/tinaut1986/NSA';

export type FbiNsaStatus = 'recommend-nsa' | 'ok-nsa' | 'none';

export interface FbiNsaEvaluation {
  status: FbiNsaStatus;
  recommendNsa: boolean;
  hasFbiDir: boolean;
  hasNsaDir: boolean;
  url: string | null;
}

/**
 * Evaluates the FBI / NSA detection rule:
 * - If `hasNsaDir` is true, never recommend NSA (even when `hasFbiDir` is also true).
 * - If `hasFbiDir` is true and `hasNsaDir` is false, recommend installing NSA.
 */
export function evaluateFbiNsaRule(input: {
  hasFbiDir: boolean;
  hasNsaDir: boolean;
}): FbiNsaEvaluation {
  if (input.hasNsaDir) {
    return {
      status: 'ok-nsa',
      recommendNsa: false,
      hasFbiDir: input.hasFbiDir,
      hasNsaDir: true,
      url: null,
    };
  }
  if (input.hasFbiDir) {
    return {
      status: 'recommend-nsa',
      recommendNsa: true,
      hasFbiDir: true,
      hasNsaDir: false,
      url: NSA_REPO_URL,
    };
  }
  return {
    status: 'none',
    recommendNsa: false,
    hasFbiDir: false,
    hasNsaDir: false,
    url: null,
  };
}

export interface MisplacedFile {
  name: string;
  size: number;
  kind: 'cia' | '3dsx';
  suggestedDir: string;
}

export interface Audit3dsResult {
  junkFiles: JunkFile[];
  junkDirs: JunkDir[];
  misplacedFiles: MisplacedFile[];
  hasBootFirm: boolean;
  hasBoot3dsx: boolean;
  hasGodMode9: boolean;
  hasLumaConfig: boolean;
  fbiNsa: FbiNsaEvaluation;
  skippedDirs: string[];
  filesSeen: number;
}

function isProtectedRootDir(name: string): boolean {
  const lower = name.toLowerCase();
  return PROTECTED_ROOT_DIRS.some((p) => p.toLowerCase() === lower);
}

async function isFseventsPreventionMarker(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    return isPreventionOnlyFsevents((await listEntries(handle)).map((e) => e.name));
  } catch {
    return false;
  }
}

/**
 * Walks the 3DS SD card safely:
 * - Never descends into `/Nintendo 3DS/` or `/boot9strap/` (protected system data).
 * - Never descends into OS junk dirs (`.Trashes`, `.Spotlight-V100`, etc.).
 * - Collects OS junk, misplaced root `.cia`/`.3dsx`, critical CFW files, and FBI/NSA folders.
 */
export async function audit3dsCard(
  root: FileSystemDirectoryHandle,
  onProgress?: (filesSeen: number) => void,
): Promise<Audit3dsResult> {
  const junkFiles: JunkFile[] = [];
  const junkDirs: JunkDir[] = [];
  const misplacedFiles: MisplacedFile[] = [];
  const skippedDirs: string[] = [];

  let filesSeen = 0;
  let hasBootFirm = false;
  let hasBoot3dsx = false;
  let hasGodMode9 = false;
  let hasLumaConfig = false;
  let hasFbiDir = false;
  let hasNsaDir = false;

  async function walk(dir: FileSystemDirectoryHandle, path: readonly string[]): Promise<void> {
    const isRoot = path.length === 0;
    const inLuma = path.length === 1 && path[0].toLowerCase() === 'luma';
    const inPayloads =
      path.length === 2 &&
      path[0].toLowerCase() === 'luma' &&
      path[1].toLowerCase() === 'payloads';
    const in3ds = path.length === 1 && path[0].toLowerCase() === DIR_3DS.toLowerCase();

    for await (const handle of dir.values()) {
      if (handle.kind === 'file') {
        filesSeen += 1;
        if (filesSeen % 50 === 0) {
          onProgress?.(filesSeen);
        }

        if (isJunkFileName(handle.name)) {
          let size = 0;
          try {
            size = (await handle.getFile()).size;
          } catch {
            // size is display-only
          }
          junkFiles.push({ path, name: handle.name, size });
          continue;
        }

        const lower = handle.name.toLowerCase();
        if (isRoot) {
          if (lower === 'boot.firm') hasBootFirm = true;
          else if (lower === 'boot.3dsx') hasBoot3dsx = true;
          else if (lower.endsWith('.cia')) {
            let size = 0;
            try {
              size = (await handle.getFile()).size;
            } catch {
              // display-only
            }
            misplacedFiles.push({
              name: handle.name,
              size,
              kind: 'cia',
              suggestedDir: DIR_CIAS,
            });
          } else if (lower.endsWith('.3dsx')) {
            let size = 0;
            try {
              size = (await handle.getFile()).size;
            } catch {
              // display-only
            }
            misplacedFiles.push({
              name: handle.name,
              size,
              kind: '3dsx',
              suggestedDir: DIR_3DS,
            });
          }
        } else if (inLuma && lower === 'config.ini') {
          hasLumaConfig = true;
        } else if (inPayloads && lower.includes('godmode9') && lower.endsWith('.firm')) {
          hasGodMode9 = true;
        }
        continue;
      }

      // Directory handling
      const lowerDir = handle.name.toLowerCase();

      if (JUNK_DIR_NAMES.some((j) => j.toLowerCase() === lowerDir)) {
        if (isRoot) {
          const preventionOnly =
            lowerDir === '.fseventsd' ? await isFseventsPreventionMarker(handle) : false;
          junkDirs.push({ name: handle.name, preventionOnly });
        }
        continue;
      }

      if (isRoot) {
        if (lowerDir === DIR_FBI) hasFbiDir = true;
        if (lowerDir === DIR_NSA) hasNsaDir = true;
        if (isProtectedRootDir(handle.name)) {
          // Never scan inside Nintendo 3DS or boot9strap
          continue;
        }
      } else if (in3ds && lowerDir.startsWith(DIR_FBI)) {
        hasFbiDir = true;
      }

      if (handle.name.startsWith('.')) {
        continue;
      }

      if (path.length < MAX_SCAN_DEPTH) {
        try {
          await walk(handle, [...path, handle.name]);
        } catch (error) {
          if (!isAccessError(error)) {
            throw error;
          }
          skippedDirs.push([...path, handle.name].join('/'));
        }
      }
    }
  }

  await walk(root, []);
  onProgress?.(filesSeen);

  return {
    junkFiles,
    junkDirs,
    misplacedFiles,
    hasBootFirm,
    hasBoot3dsx,
    hasGodMode9,
    hasLumaConfig,
    fbiNsa: evaluateFbiNsaRule({ hasFbiDir, hasNsaDir }),
    skippedDirs,
    filesSeen,
  };
}
