/**
 * Strict critical-system whitelist shared by every filesystem layer.
 *
 * `/Nintendo 3DS/` and `/boot9strap/` may be *read* (they are needed to
 * recognize a card), but 3DSdex never creates, modifies, backs up, moves,
 * cleans or exports changes inside them — not in direct mode, not through the
 * Firefox compatible overlay, not in the generated `.zip`.
 *
 * This module has no imports on purpose: low-level helpers (`sdcard.ts`) and
 * the SD layout constants (`sd3ds.ts`) both use it without forming a cycle.
 */

export const DIR_NINTENDO_3DS = 'Nintendo 3DS';
export const DIR_BOOT9STRAP = 'boot9strap';

export const CRITICAL_SYSTEM_PATHS: readonly (readonly string[])[] = [
  [DIR_NINTENDO_3DS],
  [DIR_BOOT9STRAP],
];

/** Normalizes path segments (or a slash-separated path) for FAT32-like comparison. */
export function normalizePathSegments(path: readonly string[] | string): string[] {
  const segments = typeof path === 'string' ? path.split(/[\\/]+/) : [...path];
  return segments
    .map((segment) => segment.trim().toLowerCase())
    .filter((segment) => segment.length > 0 && segment !== '.');
}

/** True when `path` is a critical system folder or sits inside one. */
export function isCriticalSystemPath(path: readonly string[] | string): boolean {
  const segments = normalizePathSegments(path);
  if (segments.length === 0) return false;
  return CRITICAL_SYSTEM_PATHS.some((critical) =>
    critical.every(
      (segment, index) => segments[index] === segment.trim().toLowerCase(),
    ),
  );
}

/** Renders SD-relative path segments using forward slashes. */
export function formatSdPath(path: readonly string[]): string {
  return path.join('/');
}

/**
 * Throws `NotAllowedError` before any mutating operation aimed at a critical
 * system folder, matching the File System Access API denial error so existing
 * `fsMessage` handling keeps working.
 */
export function assertNotCriticalPath(path: readonly string[] | string): void {
  if (isCriticalSystemPath(path)) {
    throw new DOMException(
      `3DSdex never modifies critical system paths: /${formatSdPath(
        typeof path === 'string' ? normalizePathSegments(path) : path,
      )}`,
      'NotAllowedError',
    );
  }
}
