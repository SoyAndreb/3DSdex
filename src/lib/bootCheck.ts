/**
 * Read-only boot layout inspection for 3DSdex: `boot.firm`, `boot.3dsx`,
 * `/luma/payloads/*.firm` and `/luma/config.ini`.
 *
 * Everything here is informational. Nothing writes, renames or rewrites a
 * payload or a Luma config: an unusual setting is reported so the user can
 * decide on the console, never changed from the browser.
 */

import { CFW_MANIFEST } from './cfwManifest.ts';
import { sha256Hex } from './loaderScan.ts';
import { DIR_LUMA_PAYLOADS } from './sd3ds.ts';
import { fileExists, getDir, listEntries, readFileText } from './sdcard.ts';

export interface BootFileStatus {
  present: boolean;
  size: number | null;
}

export interface PayloadFinding {
  name: string;
  size: number;
  modified: number | null;
  /** Normalized name shared with another payload (case/extension/copy suffix). */
  duplicateGroup: string | null;
  /** Hash matches a known older release rather than the latest one. */
  outdatedTag: string | null;
}

export interface BootCheckResult {
  bootFirm: BootFileStatus;
  boot3dsx: BootFileStatus;
  payloads: PayloadFinding[];
  duplicatePayloads: number;
  outdatedPayloads: number;
  lumaConfig: LumaConfigReport;
}

/** Codes the UI translates; the library stays language-agnostic. */
export type ConfigFindingCode =
  | 'missing-meta'
  | 'missing-version'
  | 'unknown-version'
  | 'autoboot-emunand'
  | 'autoboot-mode'
  | 'pin-lock'
  | 'game-patching-off'
  | 'external-firm-off'
  | 'new3ds-cpu'
  | 'dev-unitinfo';

export interface ConfigFinding {
  code: ConfigFindingCode;
  key: string;
  value: string | null;
}

export interface ParsedLumaConfig {
  sections: Set<string>;
  values: Map<string, string>;
}

export interface LumaConfigReport {
  status: 'present' | 'missing' | 'unreadable';
  version: string | null;
  findings: ConfigFinding[];
}

/**
 * Parses the INI subset Luma3DS writes: `;` comments, `[sections]` and
 * `key = value`. Keys are lowercased (FAT32/INI keys are case-insensitive in
 * practice) and only the first occurrence wins, which is how Luma reads them.
 */
export function parseLumaConfig(text: string): ParsedLumaConfig {
  const sections = new Set<string>();
  const values = new Map<string, string>();
  let currentSection = '';
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith(';') || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1).trim().toLowerCase();
      sections.add(currentSection);
      continue;
    }
    const equals = line.indexOf('=');
    if (equals < 0) continue;
    const key = line.slice(0, equals).trim().toLowerCase();
    const value = line.slice(equals + 1).trim();
    if (key === '' || values.has(key)) continue;
    values.set(currentSection === '' ? key : `${currentSection}.${key}`, value);
  }
  return { sections, values };
}

/** Expected shape: `[meta] config_version_major = 3, config_version_minor = N`. */
export function evaluateLumaConfig(parsed: ParsedLumaConfig): ConfigFinding[] {
  const findings: ConfigFinding[] = [];
  const get = (key: string): string | null => parsed.values.get(key) ?? null;
  const add = (code: ConfigFindingCode, key: string, value: string | null) =>
    findings.push({ code, key, value });

  if (!parsed.sections.has('meta')) {
    add('missing-meta', 'meta', null);
  } else {
    const major = get('meta.config_version_major');
    const minor = get('meta.config_version_minor');
    if (major === null && minor === null) {
      add('missing-version', 'meta.config_version_*', null);
    } else if (major !== '3' || minor === null || !/^\d{1,3}$/.test(minor)) {
      add('unknown-version', 'meta.config_version_*', `${major}/${minor}`);
    }
  }

  // Luma writes `0` for some switches and `off` for others; both mean normal.
  const expectOff = (key: string, code: ConfigFindingCode) => {
    const value = get(key);
    if (value !== null && value !== '0' && value !== 'off') add(code, key, value);
  };
  expectOff('boot.autoboot_emunand', 'autoboot-emunand');
  expectOff('boot.autoboot_mode', 'autoboot-mode');
  expectOff('boot.pin_lock_num_digits', 'pin-lock');
  expectOff('boot.app_launch_new_3ds_cpu', 'new3ds-cpu');
  expectOff('boot.use_dev_unitinfo', 'dev-unitinfo');

  const patching = get('boot.enable_game_patching');
  if (patching !== null && patching !== '1') add('game-patching-off', 'boot.enable_game_patching', patching);
  const external = get('boot.enable_external_firm_and_modules');
  if (external !== null && external !== '1') {
    add('external-firm-off', 'boot.enable_external_firm_and_modules', external);
  }
  return findings;
}

/** Normalizes a payload name so copies like `godmode9 (1).firm` group together. */
function payloadGroup(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.(firm|bin)$/, '')
    .replace(/\s*\(\d+\)$/, '')
    .replace(/[_\s-]+/g, '')
    .trim();
}

async function fileStatus(
  root: FileSystemDirectoryHandle,
  name: string,
): Promise<BootFileStatus> {
  try {
    const handle = await root.getFileHandle(name);
    const file = await handle.getFile();
    return { present: true, size: file.size };
  } catch {
    return { present: false, size: null };
  }
}

/**
 * Inspects the boot layout in one shallow pass. Payload hashes are computed
 * only for `.firm` files in `/luma/payloads/` to flag known old releases.
 */
export async function inspectBootLayout(root: FileSystemDirectoryHandle): Promise<BootCheckResult> {
  const [bootFirm, boot3dsx] = await Promise.all([
    fileStatus(root, 'boot.firm'),
    fileStatus(root, 'boot.3dsx'),
  ]);

  const knownHashes = new Map(
    CFW_MANIFEST.components.godmode9.releases.map((release) => [release.sha256, release.tag]),
  );
  const latestTag = CFW_MANIFEST.components.godmode9.latestKnown;

  const payloads: PayloadFinding[] = [];
  const payloadsDir = await getDir(root, DIR_LUMA_PAYLOADS);
  if (payloadsDir !== null) {
    const entries = await listEntries(payloadsDir);
    for (const entry of entries) {
      if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith('.firm')) continue;
      let size = 0;
      let modified: number | null = null;
      let outdatedTag: string | null = null;
      try {
        const handle = await payloadsDir.getFileHandle(entry.name);
        const file = await handle.getFile();
        size = file.size;
        modified = file.lastModified;
        const tag =
          knownHashes.get(await sha256Hex(new Uint8Array(await file.arrayBuffer()))) ?? null;
        if (tag !== null && tag !== latestTag) outdatedTag = tag;
      } catch {
        // An unreadable payload is still listed, without a size or version claim.
      }
      payloads.push({
        name: entry.name,
        size,
        modified,
        duplicateGroup: null,
        outdatedTag,
      });
    }
  }

  const groups = new Map<string, number>();
  for (const payload of payloads) {
    const group = payloadGroup(payload.name);
    groups.set(group, (groups.get(group) ?? 0) + 1);
  }
  for (const payload of payloads) {
    const group = payloadGroup(payload.name);
    payload.duplicateGroup = (groups.get(group) ?? 0) > 1 ? group : null;
  }

  let lumaConfig: LumaConfigReport;
  const lumaDir = await getDir(root, ['luma']);
  if (lumaDir === null || !(await fileExists(lumaDir, 'config.ini'))) {
    lumaConfig = { status: 'missing', version: null, findings: [] };
  } else {
    try {
      const text = await readFileText(lumaDir, 'config.ini');
      if (text === null) throw new Error('config.ini unreadable');
      const parsed = parseLumaConfig(text);
      lumaConfig = {
        status: 'present',
        version: parsed.values.get('meta.config_version_minor') ?? null,
        findings: evaluateLumaConfig(parsed),
      };
    } catch {
      lumaConfig = { status: 'unreadable', version: null, findings: [] };
    }
  }

  return {
    bootFirm,
    boot3dsx,
    payloads,
    duplicatePayloads: new Set(payloads.filter((p) => p.duplicateGroup !== null).map((p) => p.duplicateGroup)).size,
    outdatedPayloads: payloads.filter((p) => p.outdatedTag !== null).length,
    lumaConfig,
  };
}
