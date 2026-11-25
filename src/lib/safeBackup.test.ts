import { describe, expect, it } from 'vitest';
import { createCompatRootFromFiles } from './compatFs.ts';
import { sha256Hex } from './loaderScan.ts';
import { safeOverwriteFile } from './safeBackup.ts';
import { getDir, readFileBytes } from './sdcard.ts';

function fakeFile(relPath: string, content = 'old'): File {
  const name = relPath.split('/').pop() ?? relPath;
  const file = new File([content], name, { lastModified: 1700000000000 });
  Object.defineProperty(file, 'webkitRelativePath', { value: relPath });
  return file;
}

describe('safeOverwriteFile', () => {
  it('writes a new file with SHA-256 verification when no prior file exists', async () => {
    const compat = createCompatRootFromFiles([fakeFile('SD/luma/config.ini', 'cfg')]);
    const newBytes = new TextEncoder().encode('new-hbmenu');
    const res = await safeOverwriteFile(compat.handle, [], 'boot.3dsx', newBytes, {
      stamp: '20261124-120000',
    });

    expect(res.backedUpPath).toBeNull();
    expect(res.writtenPath).toBe('boot.3dsx');
    expect(res.sha256).toBe(await sha256Hex(newBytes));
    expect(await readFileBytes(compat.handle, 'boot.3dsx')).toEqual(newBytes);
  });

  it('backs up existing critical file before overwriting and verifies both', async () => {
    const oldContent = 'old-luma-firm';
    const compat = createCompatRootFromFiles([fakeFile('SD/boot.firm', oldContent)]);
    const newBytes = new TextEncoder().encode('new-luma-firm-v13.3.3');

    const res = await safeOverwriteFile(compat.handle, [], 'boot.firm', newBytes, {
      stamp: '20261124-120000',
    });

    expect(res.backedUpPath).toBe('luma/backups/3dsdex/20261124-120000/boot.firm');
    expect(await readFileBytes(compat.handle, 'boot.firm')).toEqual(newBytes);

    const backupDir = await getDir(compat.handle, ['luma', 'backups', '3dsdex', '20261124-120000']);
    expect(backupDir).not.toBeNull();
    const backedUp = await readFileBytes(backupDir!, 'boot.firm');
    expect(new TextDecoder().decode(backedUp!)).toBe(oldContent);
  });

  it('rejects a verified write whose target is a critical system path', async () => {
    const compat = createCompatRootFromFiles([fakeFile('SD/boot.firm', 'luma')]);
    const newBytes = new TextEncoder().encode('nope');
    await expect(
      safeOverwriteFile(compat.handle, ['Nintendo 3DS', '00000000'], 'secret.dat', newBytes),
    ).rejects.toMatchObject({ name: 'NotAllowedError' });
    await expect(
      safeOverwriteFile(compat.handle, ['boot9strap'], 'boot9strap.firm', newBytes),
    ).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(compat.getChanges().written).toHaveLength(0);
  });
});
