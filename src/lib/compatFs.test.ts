import { describe, expect, it } from 'vitest';
import { createCompatRootFromFiles } from './compatFs.ts';
import { scan3dsApps } from './app3dsAudit.ts';
import { looksLike3dsSd } from './sd3ds.ts';
import { getDir, readFileBytes, writeFileBytes } from './sdcard.ts';

/** Reads the names stored in each local ZIP header, not arbitrary text. */
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
    expect(zipText).toContain('3DSDEX_CAMBIOS.txt');
  });

  it('does not mark deletions from scanning, auditing or a dry-run preview alone', async () => {
    const compat = createCompatRootFromFiles([
      fakeFile('SD/boot.firm', 'firm'),
      fakeFile('SD/3ds/.DS_Store', 'junk'),
      fakeFile('SD/3ds/EmptyApp/.gitkeep', 'data'),
    ]);

    // Read-only scans must not stage anything.
    await scan3dsApps(compat.handle);
    expect(compat.getChanges().written).toEqual([]);
    expect(compat.getChanges().deleted).toEqual([]);

    // A preview is only a manifest note, never an actual deletion mark.
    compat.notePlan({
      changes: [
        { kind: 'delete', path: '3ds/.DS_Store', reason: 'junk' },
        { kind: 'delete', path: '3ds/EmptyApp/', reason: 'junk' },
      ],
      blocked: [],
    });
    expect(compat.getChanges().deleted).toEqual([]);
    expect(compat.getChanges().plannedCount).toBe(2);
    const withPlan = new TextDecoder().decode(await compat.exportZip());
    expect(withPlan).toContain('delete: 2');

    // Cancelling the preview clears the plan, so a stale "2 deletions" note
    // cannot survive into an export the user did not ask for.
    compat.notePlan({ changes: [], blocked: [] });
    expect(compat.getChanges().plannedCount).toBe(0);
    const cleared = new TextDecoder().decode(await compat.exportZip());
    expect(cleared).toContain('delete: 0');
    expect(cleared).not.toContain('delete: 2');
  });

  it('allows reading critical folders but blocks writes, deletes and ZIP changes inside them', async () => {
    const compat = createCompatRootFromFiles([
      fakeFile('SD/boot.firm', 'luma'),
      fakeFile('SD/Nintendo 3DS/00000000/secret.dat', 'private'),
      fakeFile('SD/boot9strap/boot9strap.firm', 'b9s'),
    ]);

    // Reading is allowed in Firefox mode.
    const privateDir = await getDir(compat.handle, ['Nintendo 3DS', '00000000']);
    expect(privateDir).not.toBeNull();
    expect(await readFileBytes(privateDir!, 'secret.dat')).not.toBeNull();

    const nintendo = await getDir(compat.handle, ['Nintendo 3DS']);
    const b9s = await getDir(compat.handle, ['boot9strap']);
    await expect(nintendo!.getFileHandle('new.txt', { create: true })).rejects.toMatchObject({
      name: 'NotAllowedError',
    });
    await expect(b9s!.getDirectoryHandle('sub', { create: true })).rejects.toMatchObject({
      name: 'NotAllowedError',
    });
    await expect(nintendo!.removeEntry('00000000')).rejects.toMatchObject({
      name: 'NotAllowedError',
    });
    const existing = await b9s!.getFileHandle('boot9strap.firm');
    await expect(existing.createWritable()).rejects.toMatchObject({ name: 'NotAllowedError' });

    compat.notePlan({
      changes: [{ kind: 'create', path: 'cias/app.cia', reason: 'homebrew' }],
      blocked: [{ kind: 'delete', path: 'Nintendo 3DS/00000000/secret.dat', reason: 'junk' }],
    });
    expect(compat.getChanges().blocked).toContain('Nintendo 3DS/00000000/secret.dat');

    const bytes = await compat.exportZip();
    const zipText = new TextDecoder().decode(bytes);
    expect(zipText).toContain('3DSDEX_CAMBIOS.txt');
    expect(zipText).toContain('BLOQUEADOS');
    expect(zipEntryNames(bytes)).not.toContain('Nintendo 3DS/00000000/secret.dat');
  });
});
