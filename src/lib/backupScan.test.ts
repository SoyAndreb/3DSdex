import { describe, expect, it } from 'vitest';
import { createCompatRootFromFiles } from './compatFs.ts';
import { exportBackupPackages, scanBackups } from './backupScan.ts';

/** Fixtures are local to this test file. */
function fakeFile(relPath: string, content: string, lastModified = 1700000000000): File {
  const name = relPath.split('/').pop() ?? relPath;
  const file = new File([content], name, { lastModified });
  Object.defineProperty(file, 'webkitRelativePath', { value: relPath });
  return file;
}

function zipEntryNames(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const names: string[] = [];
  for (let i = 0; i + 30 <= bytes.length; i += 1) {
    if (view.getUint32(i, true) !== 0x04034b50) continue;
    const length = view.getUint16(i + 26, true);
    names.push(new TextDecoder().decode(bytes.subarray(i + 30, i + 30 + length)));
  }
  return names;
}

describe('scanBackups', () => {
  it('groups GM9 dumps, JKSV, Checkpoint and 3DSdex backups with date and size', async () => {
    const compat = createCompatRootFromFiles([
      fakeFile('SD/gm9/out/luma-dump.firm', 'firm', 1700000000000),
      fakeFile('SD/JKSV/Animal Crossing/save.dat', 'save', 1800000000000),
      fakeFile('SD/3ds/Checkpoint/Game/slot0/save.dat', 'slot', 1900000000000),
      fakeFile('SD/luma/backups/3dsdex/20261124-120000/boot.firm', 'backup', 2000000000000),
      fakeFile('SD/Nintendo 3DS/00000000/private.dat', 'never', 2100000000000),
    ]);

    const packages = await scanBackups(compat.handle);
    expect(packages.map((p) => p.id)).toEqual([
      'luma/backups/3dsdex/20261124-120000',
      '3ds/Checkpoint/Game',
      'JKSV/Animal Crossing',
      'gm9/out/luma-dump.firm',
    ]);
    expect(packages.find((p) => p.source === 'gm9')).toMatchObject({
      name: 'luma-dump.firm',
      files: 1,
      size: 4,
    });
    expect(packages.find((p) => p.source === 'jksv')).toMatchObject({ files: 1 });
    expect(packages.every((p) => !p.id.toLowerCase().includes('nintendo 3ds'))).toBe(true);

    const bytes = await exportBackupPackages(compat.handle, [packages[0]!, packages[3]!]);
    expect(zipEntryNames(bytes)).toEqual(
      expect.arrayContaining([
        'luma/backups/3dsdex/20261124-120000/boot.firm',
        'gm9/out/luma-dump.firm',
      ]),
    );
    expect(zipEntryNames(bytes)).not.toContain('Nintendo 3DS/00000000/private.dat');
  });

  it('returns an empty list when no backup folders exist', async () => {
    const compat = createCompatRootFromFiles([fakeFile('SD/boot.firm', 'firm')]);
    expect(await scanBackups(compat.handle)).toEqual([]);
  });
});
