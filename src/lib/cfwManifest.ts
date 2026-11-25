/**
 * CFW & critical component version identification.
 *
 * A hash is the strongest evidence when it is in the manifest, but real SD
 * cards hold custom-built or newer binaries whose hashes were never catalogued.
 * Those binaries still carry an ASCII version string (`Luma3DS v13.3.3`,
 * `GodMode9 v2.1.1`, ...), and TWiLight Menu++ also leaves version files under
 * `/_nds/TWiLightMenu/`. Both are read here as secondary evidence so a card is
 * not reported as "custom" when its installed version is plainly written in the
 * binary. `/_nds/release-bootstrap.ver` belongs to nds-bootstrap, a DIFFERENT
 * component, and is never accepted as a TWiLight Menu++ version.
 *
 * This module is pure: it never touches a filesystem or the network.
 */

import manifestJson from '../data/cfwReleases.json';

export type CfwComponentId = 'luma3ds' | 'hbmenu' | 'godmode9' | 'twilight';

export interface CfwReleaseEntry {
  tag: string;
  sha256: string;
}

export interface CfwComponentSpec {
  name: string;
  repo: string;
  targetPath: string;
  latestKnown: string;
  /** Case-insensitive regexes with the version in capture group 1. */
  versionPatterns?: readonly string[];
  /** SD-relative text files checked before the binary (TWiLight Menu++ only). */
  versionFiles?: readonly string[];
  /** Reject secondary evidence below this version (e.g. a bootstrap v2.x string). */
  versionFloor?: string;
  releases: readonly CfwReleaseEntry[];
}

export interface CfwStandaloneSpec {
  name: string;
  repo: string;
  targetPath: string;
  latestKnown: string;
  versionPatterns?: readonly string[];
  versionFiles?: readonly string[];
  binaryPaths?: readonly string[];
}

export interface CfwManifest {
  components: Record<CfwComponentId, CfwComponentSpec>;
  /** Components detected independently of the four boot/homebrew payloads. */
  standalone: { ndsBootstrap: CfwStandaloneSpec };
}

export const CFW_MANIFEST = manifestJson as CfwManifest;

export type CfwComponentStatus =
  'up-to-date' | 'outdated' | 'unknown-version' | 'unrecognised' | 'missing';

export type CfwVersionSource = 'hash' | 'binary' | 'file';

export interface CfwComponentCheck {
  id: CfwComponentId;
  name: string;
  repo: string;
  targetPath: string;
  status: CfwComponentStatus;
  detectedVersion: string | null;
  latestVersion: string;
  sha256: string | null;
  fileSize: number | null;
  /** Where `detectedVersion` came from, for an honest UI label. */
  versionSource: CfwVersionSource | null;
}

/** Secondary evidence read from a binary or a version file by the scanner. */
export interface VersionEvidence {
  version: string | null;
  source: Exclude<CfwVersionSource, 'hash'>;
}

/** nds-bootstrap is detected separately from TWiLight Menu++ itself. */
export type NdsBootstrapCheck = Omit<CfwComponentCheck, 'id'> & {
  id: 'nds-bootstrap';
};

/** Pure status resolution for nds-bootstrap, from its own version file/binary. */
export function identifyNdsBootstrap(
  manifest: CfwManifest,
  version: string | null,
  source: Exclude<CfwVersionSource, 'hash'> | null,
  liveLatestTag: string | null = null,
  sha256: string | null = null,
  fileSize: number | null = null,
): NdsBootstrapCheck {
  const spec = manifest.standalone.ndsBootstrap;
  const detectedVersion = normalizeVersion(version ?? '');
  const latestVersion =
    liveLatestTag && compareTags(liveLatestTag, spec.latestKnown) > 0
      ? liveLatestTag
      : spec.latestKnown;
  const base = {
    id: 'nds-bootstrap' as const,
    name: spec.name,
    repo: spec.repo,
    targetPath: spec.targetPath,
    latestVersion,
    sha256: sha256 === null ? null : sha256.toLowerCase(),
    fileSize,
  };
  if (detectedVersion === null) {
    return {
      ...base,
      status: source === null ? 'missing' : 'unknown-version',
      detectedVersion: null,
      versionSource: null,
    };
  }
  return {
    ...base,
    status: compareTags(detectedVersion, latestVersion) >= 0 ? 'up-to-date' : 'outdated',
    detectedVersion,
    versionSource: source,
  };
}

/** Upper bound for string scanning; every 3DS payload fits well inside this. */
export const MAX_VERSION_SCAN_BYTES = 8 * 1024 * 1024;

/**
 * Compares two semver-like tags (`v13.3.3` vs `v13.2.1`). Returns > 0 if `a > b`.
 */
export function compareTags(a: string, b: string): number {
  const parse = (t: string) =>
    t
      .replace(/^v/i, '')
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Canonicalises `13.3.3`, `v2.4` or `v27.14.0` to a comparable `vX.Y.Z`. */
export function normalizeVersion(raw: string): string | null {
  const match = raw.match(/v?\s*(\d+\.\d+(?:\.\d+)?)/i);
  return match === null ? null : `v${match[1]}`;
}

/**
 * Finds the first labelled version in a string using the component patterns.
 * Patterns must capture the numeric part in group 1.
 */
export function extractVersion(text: string, patterns: readonly string[]): string | null {
  for (const pattern of patterns) {
    let regex: RegExp;
    try {
      regex = new RegExp(pattern, 'i');
    } catch {
      continue; // a bad manifest pattern must not break the whole scan
    }
    const match = regex.exec(text);
    if (match?.[1] !== undefined) {
      const version = normalizeVersion(match[1]);
      if (version !== null) return version;
    }
  }
  return null;
}

/** Bytes from a 3DS binary are ASCII strings; a byte-preserving decode is enough. */
function byteText(bytes: Uint8Array): string {
  let text = '';
  const end = Math.min(bytes.length, MAX_VERSION_SCAN_BYTES);
  for (let i = 0; i < end; i += 1) text += String.fromCharCode(bytes[i]);
  return text;
}

/** Reads the embedded version string of one component from its binary bytes. */
export function extractVersionFromBytes(
  bytes: Uint8Array,
  id: CfwComponentId,
  manifest: CfwManifest = CFW_MANIFEST,
): string | null {
  return extractVersion(byteText(bytes), manifest.components[id].versionPatterns ?? []);
}

/**
 * Resolves a component's status from a manifest hash, optional secondary
 * evidence and an optional live GitHub tag. The hash wins when it matches;
 * otherwise the embedded/file version is used. With neither, the honest answer
 * is "no version detected" rather than guessing.
 */
export function identifyCfwComponent(
  manifest: CfwManifest,
  id: CfwComponentId,
  sha256: string | null,
  fileSize: number | null,
  liveLatestTag: string | null = null,
  evidence: VersionEvidence | null = null,
): CfwComponentCheck {
  const spec = manifest.components[id];
  const latestVersion =
    liveLatestTag && compareTags(liveLatestTag, spec.latestKnown) > 0
      ? liveLatestTag
      : spec.latestKnown;

  const base = {
    id,
    name: spec.name,
    repo: spec.repo,
    targetPath: spec.targetPath,
    latestVersion,
    sha256: sha256 === null ? null : sha256.toLowerCase(),
    fileSize,
  };

  if (sha256 === null) {
    return { ...base, status: 'missing', detectedVersion: null, versionSource: null };
  }

  const normalized = sha256.toLowerCase();
  const match = spec.releases.find((release) => release.sha256.toLowerCase() === normalized);
  const rawHint = evidence?.version ? normalizeVersion(evidence.version) : null;
  // A component can never inherit another component's version: TWiLight is
  // v27.x while nds-bootstrap is v2.x, so a v2.x hint is rejected outright.
  const hint =
    rawHint !== null &&
    (spec.versionFloor === undefined || compareTags(rawHint, spec.versionFloor) >= 0)
      ? rawHint
      : null;
  const detectedVersion = match?.tag ?? hint;

  if (detectedVersion === null) {
    return {
      ...base,
      status: 'unknown-version',
      detectedVersion: null,
      versionSource: null,
    };
  }

  return {
    ...base,
    status: compareTags(detectedVersion, latestVersion) >= 0 ? 'up-to-date' : 'outdated',
    detectedVersion,
    versionSource: match ? 'hash' : (evidence?.source ?? 'binary'),
  };
}
