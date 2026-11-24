import { describe, expect, it } from 'vitest';
import { createCompatRootFromFiles } from './compatFs.ts';
import { looksLike3dsSd } from './sd3ds.ts';
import { getDir, readFileBytes, writeFileBytes } from './sdcard.ts';

function fakeFile(relPath: string, content = 'hello'): File {
  const name = relPath.split('/').pop() ?? relPath;
  const file = new File([content], name, { lastModified: 1700000000000 });
  Object.defineProperty(file, 'webkitRelativePath', { value: relPath });
  return file;
}

describe('compatFs (Firefox / fallback mode)', () => {
  it('validates 3DS SD root, stages writes and deletes, and exports a valid ZIP', async () => {
    const compat = createCompatRootFromFiles([
      fakeFile('My3DSBackup/boot.firm', 'firm-bytes'),
      fakeFile('My3DSBackup/themezer.cia', 'cia-bytes'),
      fakeFile('My3DSBackup/.DS_Store', 'junk'),
    ]);

    expect(compat.rootName).toBe('My3DSBackup');
    expect(await looksLike3dsSd(compat.handle)).toBe(true);

    // Move cia to /cias/ and delete .DS_Store
    const ciaData = await readFileBytes(compat.handle, 'themezer.cia');
    expect(ciaData).not.toBeNull();

    const ciasDir = await getDir(compat.handle, ['cias'], true);
    expect(ciasDir).not.toBeNull();
    await writeFileBytes(ciasDir!, 'themezer.cia', ciaData!);
    await compat.handle.removeEntry('themezer.cia');
    await compat.handle.removeEntry('.DS_Store');

    const changes = compat.getChanges();
    expect(changes.written).toEqual(['cias/themezer.cia']);
    expect(changes.deleted).toEqual(['.DS_Store', 'themezer.cia']);

    const zipBytes = await compat.exportZip();
    // PKZIP local file header signature: 0x50 0x4B 0x03 0x04
    expect(zipBytes[0]).toBe(0x50);
    expect(zipBytes[1]).toBe(0x4b);
    expect(zipBytes[2]).toBe(0x03);
    expect(zipBytes[3]).toBe(0x04);

    const zipText = new TextDecoder().decode(zipBytes);
    expect(zipText).toContain('cias/themezer.cia');
    expect(zipText).toContain('3DSDEX_ELIMINAR_MANUALMENTE.txt');
  });
});
