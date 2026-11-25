/**
 * Safe backup & verified overwrite helper for critical 3DS files
 * (`boot.firm`, `boot.3dsx`, `/luma/payloads/*.firm`, TWiLight Menu++ files).
 *
 * Before overwriting an existing file:
 * 1. Reads the existing file bytes and computes its SHA-256.
 * 2. Writes a timestamped backup under `/luma/backups/3dsdex/<stamp>/...` and
 *    verifies the backup bytes match the original SHA-256.
 * 3. Writes the new file bytes and re-reads them to verify size and SHA-256.
 * 4. If post-write verification fails, restores the backup automatically.
 */

import { sha256Hex } from './loaderScan.ts';
import { assertNotCriticalPath } from './criticalPaths.ts';
import { getDir, readFileBytes, writeFileBytes } from './sdcard.ts';

export interface SafeWriteResult {
  writtenPath: string;
  backedUpPath: string | null;
  sha256: string;
  size: number;
}

function formatBackupStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * Safely writes `newBytes` to `targetSegments/fileName` with automatic backup
 * of any existing file and post-write SHA-256 verification.
 */
export async function safeOverwriteFile(
  root: FileSystemDirectoryHandle,
  targetSegments: readonly string[],
  fileName: string,
  newBytes: Uint8Array,
  options: { stamp?: string } = {},
): Promise<SafeWriteResult> {
  // A critical system folder can never be a backup/verified-write target.
  assertNotCriticalPath([...targetSegments, fileName]);
  const targetDir = await getDir(root, targetSegments, true);
  if (targetDir === null) {
    throw new Error(`Could not resolve target directory: /${targetSegments.join('/')}`);
  }

  const existingBytes = await readFileBytes(targetDir, fileName);
  let backedUpPath: string | null = null;
  let originalHash: string | null = null;

  if (existingBytes !== null) {
    originalHash = await sha256Hex(existingBytes);
    const stamp = options.stamp ?? formatBackupStamp();
    const backupSegments = ['luma', 'backups', '3dsdex', stamp, ...targetSegments];
    const backupDir = await getDir(root, backupSegments, true);
    if (backupDir === null) {
      throw new Error(`Could not create backup directory: /${backupSegments.join('/')}`);
    }
    await writeFileBytes(backupDir, fileName, existingBytes);
    const verifyBackup = await readFileBytes(backupDir, fileName);
    if (verifyBackup === null || (await sha256Hex(verifyBackup)) !== originalHash) {
      throw new Error(`Backup verification failed for ${fileName}; aborting overwrite.`);
    }
    backedUpPath = `${backupSegments.join('/')}/${fileName}`;
  }

  const expectedHash = await sha256Hex(newBytes);
  await writeFileBytes(targetDir, fileName, newBytes);

  const writtenBack = await readFileBytes(targetDir, fileName);
  const actualHash = writtenBack !== null ? await sha256Hex(writtenBack) : null;
  if (writtenBack === null || writtenBack.length !== newBytes.length || actualHash !== expectedHash) {
    if (existingBytes !== null) {
      await writeFileBytes(targetDir, fileName, existingBytes);
    }
    throw new Error(`Post-write verification failed for ${fileName}; original file restored.`);
  }

  const writtenPath =
    targetSegments.length > 0 ? `${targetSegments.join('/')}/${fileName}` : fileName;

  return {
    writtenPath,
    backedUpPath,
    sha256: expectedHash,
    size: newBytes.length,
  };
}
