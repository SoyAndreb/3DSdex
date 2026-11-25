/**
 * SD card CFW & utility scanner: hashes critical 3DS files (`boot.firm`,
 * `boot.3dsx`, `/luma/payloads/*GodMode9*.firm`, `BOOT.NDS`), reads the version
 * strings embedded in those binaries and the version files TWiLight Menu++
 * leaves under `/_nds/TWiLightMenu/`, detects nds-bootstrap separately from
 * `/_nds/release-bootstrap.ver`, then detects installed homebrew utilities
 * (`Universal-Updater`, `Anemone3DS`, `Checkpoint`, `FBI`, `NSA`).
 */

import {
  CFW_MANIFEST,
  extractVersion,
  extractVersionFromBytes,
  identifyCfwComponent,
  identifyNdsBootstrap,
  normalizeVersion,
  type CfwComponentCheck,
  type CfwComponentId,
  type NdsBootstrapCheck,
  type VersionEvidence,
} from './cfwManifest.ts';
import { sha256Hex } from './loaderScan.ts';
import { DIR_3DS, DIR_CIAS, DIR_FBI, DIR_LUMA_PAYLOADS, DIR_NSA } from './sd3ds.ts';
import { getDir, listEntries, readFileBytes, readFileText } from './sdcard.ts';

export interface DetectedUtility {
  name: string;
  present: boolean;
  locations: string[];
}

export interface CfwScanResult {
  components: CfwComponentCheck[];
  /** Independent from TWiLight Menu++: never taken from its version files. */
  bootstrap: NdsBootstrapCheck;
  utilities: DetectedUtility[];
}

interface FileInfo {
  sha256: string;
  size: number;
  bytes: Uint8Array;
}

const GITHUB_TIMEOUT_MS = 5000;

export async function fetchLatestGithubTag(repo: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { tag_name?: unknown };
    return typeof body.tag_name === 'string' && body.tag_name.length > 0 ? body.tag_name : null;
  } catch {
    return null;
  }
}

async function inspectFileAt(
  dir: FileSystemDirectoryHandle | null,
  fileName: string,
): Promise<FileInfo | null> {
  if (!dir) return null;
  try {
    const bytes = await readFileBytes(dir, fileName);
    if (bytes === null) return null;
    return { sha256: await sha256Hex(bytes), size: bytes.length, bytes };
  } catch {
    return null;
  }
}

function binaryEvidence(file: FileInfo | null, id: CfwComponentId): VersionEvidence | null {
  if (file === null) return null;
  const version = extractVersionFromBytes(file.bytes, id);
  return version === null ? null : { version, source: 'binary' };
}

/** Reads the first version file present under the SD root (e.g. `/_nds/`). */
async function versionFileEvidence(
  root: FileSystemDirectoryHandle,
  id: CfwComponentId,
): Promise<VersionEvidence | null> {
  for (const relPath of CFW_MANIFEST.components[id].versionFiles ?? []) {
    const parts = relPath.split('/');
    const fileName = parts.pop();
    if (!fileName || parts.some((part) => part === '' || part === '..')) continue;
    try {
      const dir = await getDir(root, parts);
      if (dir === null) continue;
      const text = await readFileText(dir, fileName);
      const version = text === null ? null : normalizeVersion(text);
      if (version !== null) return { version, source: 'file' };
    } catch {
      // one unreadable version file must not hide the next one
    }
  }
  return null;
}

/**
 * nds-bootstrap owns `/_nds/release-bootstrap.ver` and its own binaries. This
 * evidence is kept strictly apart from TWiLight Menu++'s version evidence.
 */
async function bootstrapEvidence(
  root: FileSystemDirectoryHandle,
): Promise<{ evidence: VersionEvidence | null; sha256: string | null; size: number | null }> {
  const spec = CFW_MANIFEST.standalone.ndsBootstrap;
  for (const relPath of spec.versionFiles ?? []) {
    const parts = relPath.split('/');
    const fileName = parts.pop();
    if (!fileName || parts.some((part) => part === '' || part === '..')) continue;
    try {
      const dir = await getDir(root, parts);
      if (dir === null) continue;
      const bytes = await readFileBytes(dir, fileName);
      if (bytes === null) continue;
      const version = normalizeVersion(new TextDecoder('utf-8').decode(bytes));
      if (version !== null) {
        return {
          evidence: { version, source: 'file' },
          sha256: await sha256Hex(bytes),
          size: bytes.length,
        };
      }
    } catch {
      // try the next known location
    }
  }
  for (const relPath of spec.binaryPaths ?? []) {
    const parts = relPath.split('/');
    const fileName = parts.pop();
    if (!fileName || parts.some((part) => part === '' || part === '..')) continue;
    try {
      const dir = await getDir(root, parts);
      if (dir === null) continue;
      const bytes = await readFileBytes(dir, fileName);
      if (bytes === null) continue;
      const version = extractVersion(
        new TextDecoder('latin1').decode(bytes),
        spec.versionPatterns ?? [],
      );
      if (version !== null) {
        return {
          evidence: { version, source: 'binary' },
          sha256: await sha256Hex(bytes),
          size: bytes.length,
        };
      }
    } catch {
      // try the next known location
    }
  }
  return { evidence: null, sha256: null, size: null };
}

async function findGodMode9FileName(root: FileSystemDirectoryHandle): Promise<string | null> {
  const payloadsDir = await getDir(root, DIR_LUMA_PAYLOADS);
  if (!payloadsDir) return null;
  const entries = await listEntries(payloadsDir);
  const gm9 = entries.find(
    (entry) =>
      entry.kind === 'file' &&
      entry.name.toLowerCase().includes('godmode9') &&
      entry.name.toLowerCase().endsWith('.firm'),
  );
  return gm9?.name ?? null;
}

const TRACKED_UTILITIES = ['Universal-Updater', 'Anemone3DS', 'Checkpoint', 'FBI', 'NSA'] as const;

/**
 * Scans critical CFW files + key 3DS homebrew utilities on the open SD card.
 */
export async function scanCfwAndUtilities(
  root: FileSystemDirectoryHandle,
  liveTags: Partial<Record<CfwComponentId, string | null>> = {},
  liveBootstrapTag: string | null = null,
): Promise<CfwScanResult> {
  const [lumaFile, hbmenuFile, gm9Name, bootNdsFile] = await Promise.all([
    inspectFileAt(root, 'boot.firm'),
    inspectFileAt(root, 'boot.3dsx'),
    findGodMode9FileName(root),
    inspectFileAt(root, 'BOOT.NDS'),
  ]);

  const payloadsDir = gm9Name ? await getDir(root, DIR_LUMA_PAYLOADS) : null;
  const gm9File = gm9Name ? await inspectFileAt(payloadsDir, gm9Name) : null;

  // Some setups replace boot.firm with GodMode9. Only treat it as a GodMode9
  // installation when the binary actually says so.
  const gm9InBoot =
    gm9File === null && lumaFile !== null
      ? extractVersionFromBytes(lumaFile.bytes, 'godmode9')
      : null;

  const twilightEvidence =
    (await versionFileEvidence(root, 'twilight')) ?? binaryEvidence(bootNdsFile, 'twilight');
  const bootstrap = await bootstrapEvidence(root);

  const components: CfwComponentCheck[] = [
    identifyCfwComponent(
      CFW_MANIFEST,
      'luma3ds',
      lumaFile?.sha256 ?? null,
      lumaFile?.size ?? null,
      liveTags.luma3ds ?? null,
      binaryEvidence(lumaFile, 'luma3ds'),
    ),
    identifyCfwComponent(
      CFW_MANIFEST,
      'hbmenu',
      hbmenuFile?.sha256 ?? null,
      hbmenuFile?.size ?? null,
      liveTags.hbmenu ?? null,
      binaryEvidence(hbmenuFile, 'hbmenu'),
    ),
    identifyCfwComponent(
      CFW_MANIFEST,
      'godmode9',
      gm9File?.sha256 ?? (gm9InBoot !== null ? (lumaFile?.sha256 ?? null) : null),
      gm9File?.size ?? (gm9InBoot !== null ? (lumaFile?.size ?? null) : null),
      liveTags.godmode9 ?? null,
      binaryEvidence(gm9File, 'godmode9') ??
        (gm9InBoot !== null ? { version: gm9InBoot, source: 'binary' as const } : null),
    ),
    identifyCfwComponent(
      CFW_MANIFEST,
      'twilight',
      bootNdsFile?.sha256 ?? null,
      bootNdsFile?.size ?? null,
      liveTags.twilight ?? null,
      twilightEvidence,
    ),
  ];

  // Utility detection across /3ds/, /cias/, /fbi/, /nsa/
  const rootEntries = await listEntries(root);
  const dir3ds = await getDir(root, [DIR_3DS]);
  const entries3ds = dir3ds ? await listEntries(dir3ds) : [];
  const dirCias = await getDir(root, [DIR_CIAS]);
  const entriesCias = dirCias ? await listEntries(dirCias) : [];

  const utilities: DetectedUtility[] = TRACKED_UTILITIES.map((utilName) => {
    const key = utilName.toLowerCase();
    const locations: string[] = [];

    if (
      key === 'fbi' &&
      rootEntries.some(
        (entry) => entry.kind === 'directory' && entry.name.toLowerCase() === DIR_FBI,
      )
    ) {
      locations.push('/fbi/');
    }
    if (
      key === 'nsa' &&
      rootEntries.some(
        (entry) => entry.kind === 'directory' && entry.name.toLowerCase() === DIR_NSA,
      )
    ) {
      locations.push('/nsa/');
    }
    for (const entry of entries3ds) {
      if (entry.name.toLowerCase().includes(key)) locations.push(`/3ds/${entry.name}`);
    }
    for (const entry of entriesCias) {
      if (entry.name.toLowerCase().includes(key)) locations.push(`/cias/${entry.name}`);
    }

    return { name: utilName, present: locations.length > 0, locations };
  });

  return {
    components,
    bootstrap: identifyNdsBootstrap(
      CFW_MANIFEST,
      bootstrap.evidence?.version ?? null,
      bootstrap.evidence?.source ?? null,
      liveBootstrapTag,
      bootstrap.sha256,
      bootstrap.size,
    ),
    utilities,
  };
}
