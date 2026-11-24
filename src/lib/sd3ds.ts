/**
 * Nintendo 3DS SD card layout constants, validation, and protected-path rules
 * aligned with https://3ds.hacks.guide/ and real-world Old 3DS XL CFW cards.
 */

import { getDir, fileExists, listEntries } from './sdcard.ts';

/** Critical CFW / Homebrew files at the SD card root. */
export const CRITICAL_ROOT_FILES = ['boot.firm', 'boot.3dsx'] as const;

/** Standard 3DS CFW & homebrew directory names (case-insensitive on FAT32). */
export const DIR_LUMA = 'luma';
export const DIR_LUMA_PAYLOADS = ['luma', 'payloads'] as const;
export const DIR_LUMA_SCREENSHOTS = ['luma', 'screenshots'] as const;
export const DIR_LUMA_BACKUPS = ['luma', 'backups'] as const;
export const DIR_3DS = '3ds';
export const DIR_CIAS = 'cias';
export const DIR_GM9 = 'gm9';
export const DIR_GM9_OUT = ['gm9', 'out'] as const;
export const DIR_NINTENDO_3DS = 'Nintendo 3DS';
export const DIR_BOOT9STRAP = 'boot9strap';
export const DIR_FBI = 'fbi';
export const DIR_NSA = 'nsa';

/**
 * Directories that contain console-specific encrypted data or B9S keys.
 * 3DSdex never modifies, cleans, or deletes inside these paths.
 */
export const PROTECTED_ROOT_DIRS: readonly string[] = [DIR_NINTENDO_3DS, DIR_BOOT9STRAP];

/** Common 3DS SD indicators used to validate a picked SD card or local backup folder. */
const INDICATOR_FILES = ['boot.firm', 'boot.3dsx', 'BOOT.NDS'] as const;
const INDICATOR_DIRS = [
  DIR_NINTENDO_3DS,
  DIR_LUMA,
  DIR_3DS,
  DIR_GM9,
  DIR_CIAS,
  DIR_FBI,
  DIR_NSA,
  DIR_BOOT9STRAP,
] as const;

/**
 * Checks whether a picked directory looks like a Nintendo 3DS SD card or a
 * local working/backup copy of one. Accepts partially cluttered or incomplete
 * folders as long as at least one standard 3DS/CFW marker is present.
 */
export async function looksLike3dsSd(root: FileSystemDirectoryHandle): Promise<boolean> {
  const entries = await listEntries(root);
  const entryMap = new Map(entries.map((e) => [e.name.toLowerCase(), e.kind]));

  for (const file of INDICATOR_FILES) {
    if (entryMap.get(file.toLowerCase()) === 'file') {
      return true;
    }
  }
  for (const dir of INDICATOR_DIRS) {
    if (entryMap.get(dir.toLowerCase()) === 'directory') {
      return true;
    }
  }
  return false;
}

/** High-level inventory of a 3DS SD card detected on open. */
export interface Card3dsInfo {
  hasBootFirm: boolean;
  bootFirmSize: number | null;
  hasBoot3dsx: boolean;
  hasLumaDir: boolean;
  hasLumaConfig: boolean;
  hasGodMode9Payload: boolean;
  hasLumaScreenshots: boolean;
  hasNintendo3dsDir: boolean;
  hasGm9Dir: boolean;
  has3dsDir: boolean;
  hasCiasDir: boolean;
  hasFbiDir: boolean;
  hasNsaDir: boolean;
}

/** Reads top-level and `/luma` indicators without doing a full recursive walk. */
export async function inspect3dsCardOverview(
  root: FileSystemDirectoryHandle,
): Promise<Card3dsInfo> {
  const entries = await listEntries(root);
  const byName = new Map(entries.map((e) => [e.name.toLowerCase(), e]));

  const hasDir = (name: string) => byName.get(name.toLowerCase())?.kind === 'directory';
  const hasFile = (name: string) => byName.get(name.toLowerCase())?.kind === 'file';

  let bootFirmSize: number | null = null;
  if (hasFile('boot.firm')) {
    try {
      const fh = await root.getFileHandle(byName.get('boot.firm')!.name);
      bootFirmSize = (await fh.getFile()).size;
    } catch {
      bootFirmSize = null;
    }
  }

  const lumaDir = await getDir(root, [DIR_LUMA]);
  let hasLumaConfig = false;
  let hasGodMode9Payload = false;
  let hasLumaScreenshots = false;

  if (lumaDir !== null) {
    hasLumaConfig = await fileExists(lumaDir, 'config.ini');
    const payloadsDir = await getDir(lumaDir, ['payloads']);
    if (payloadsDir !== null) {
      const payloadEntries = await listEntries(payloadsDir);
      hasGodMode9Payload = payloadEntries.some(
        (e) => e.kind === 'file' && e.name.toLowerCase().includes('godmode9') && e.name.toLowerCase().endsWith('.firm'),
      );
    }
    hasLumaScreenshots = (await getDir(lumaDir, ['screenshots'])) !== null;
  }

  return {
    hasBootFirm: hasFile('boot.firm'),
    bootFirmSize,
    hasBoot3dsx: hasFile('boot.3dsx'),
    hasLumaDir: lumaDir !== null,
    hasLumaConfig,
    hasGodMode9Payload,
    hasLumaScreenshots,
    hasNintendo3dsDir: hasDir(DIR_NINTENDO_3DS),
    hasGm9Dir: hasDir(DIR_GM9),
    has3dsDir: hasDir(DIR_3DS),
    hasCiasDir: hasDir(DIR_CIAS),
    hasFbiDir: hasDir(DIR_FBI),
    hasNsaDir: hasDir(DIR_NSA),
  };
}
