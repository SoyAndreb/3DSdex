import { describe, expect, it } from 'vitest';
import { group3dsFindings, scan3dsApps } from './app3dsAudit.ts';
import { createCompatRootFromFiles } from './compatFs.ts';

function fakeFile(relPath: string, content: string, size?: number): File {
  const name = relPath.split('/').pop() ?? relPath;
  const file = new File([content], name, { lastModified: 1700000000000 });
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  Object.defineProperty(file, 'webkitRelativePath', { value: relPath });
  return file;
}

describe('scan3dsApps', () => {
  it('treats root .3dsx launchers as normal, not as findings', async () => {
    const compat = createCompatRootFromFiles([
      fakeFile('SD/3ds/loose.3dsx', 'loose'),
      fakeFile('SD/3ds/big.nds', 'x', 40 * 1024 * 1024),
      fakeFile('SD/Nintendo 3DS/00000000/secret.dat', 'private'),
    ]);

    const report = await scan3dsApps(compat.handle);
    expect(report.rootLaunchers).toBe(1);
    expect(report.findings.map((f) => f.kind)).toEqual(['heavy-file']);
    expect(compat.getChanges().written).toEqual([]);
    expect(compat.getChanges().deleted).toEqual([]);
  });

  it('does not flag folders with data, config, caches or subfolders', async () => {
    const compat = createCompatRootFromFiles([
      // Real /3ds/Checkpoint layout: saves and config, no .3dsx of its own.
      fakeFile('SD/3ds/Checkpoint/saves/game.sav', 'save'),
      fakeFile('SD/3ds/Checkpoint/config.json', '{}'),
      fakeFile('SD/3ds/Anemone3DS/cache/data.bin', 'cache'),
      fakeFile('SD/3ds/EmptyApp/.gitkeep', 'hidden but still a file'),
      fakeFile('SD/3ds/anemone-3ds.3dsx', 'launcher'),
    ]);

    const report = await scan3dsApps(compat.handle);
    expect(report.appFolders).toBe(3);
    expect(report.emptyFolders).toBe(0);
    expect(report.findings).toEqual([]);
    expect(report.rootLaunchers).toBe(1);
  });

  it('flags only genuinely empty folders', async () => {
    const compat = createCompatRootFromFiles([
      fakeFile('SD/3ds/EmptyOne/.keep', 'x'),
      // A directory with no children at all. compatFs materialises directories
      // from file paths, so create one explicitly through the VFS instead.
    ]);
    const dir3ds = await compat.handle.getDirectoryHandle('3ds');
    await dir3ds.getDirectoryHandle('TrulyEmpty', { create: true });

    const report = await scan3dsApps(compat.handle);
    expect(report.emptyFolders).toBe(1);
    expect(report.findings.map((f) => [f.kind, f.name])).toEqual([['empty-folder', 'TrulyEmpty']]);
  });

  it('flags case-insensitive duplicate names', async () => {
    const compat = createCompatRootFromFiles([
      fakeFile('SD/3ds/SameName/SameName.3dsx', 'a'),
      fakeFile('SD/3ds/samename/samename.3dsx', 'b'),
    ]);
    const report = await scan3dsApps(compat.handle);
    expect(report.findings.some((f) => f.kind === 'duplicate')).toBe(true);
  });

  it('returns an empty report when /3ds/ is absent', async () => {
    const compat = createCompatRootFromFiles([fakeFile('SD/boot.firm', 'firm')]);
    expect(await scan3dsApps(compat.handle)).toEqual({
      findings: [],
      appFolders: 0,
      rootLaunchers: 0,
      emptyFolders: 0,
      filesSeen: 0,
    });
  });
});

describe('group3dsFindings', () => {
  it('limits visible rows per kind and reports the hidden remainder', async () => {
    const compatible = createCompatRootFromFiles([
      fakeFile('SD/3ds/a.bin', 'x', 40 * 1024 * 1024),
      fakeFile('SD/3ds/b.bin', 'x', 40 * 1024 * 1024),
      fakeFile('SD/3ds/c.bin', 'x', 40 * 1024 * 1024),
      fakeFile('SD/3ds/d.bin', 'x', 40 * 1024 * 1024),
      fakeFile('SD/3ds/HasData/icon.png', 'png'),
    ]);
    const dir3ds = await compatible.handle.getDirectoryHandle('3ds');
    await dir3ds.getDirectoryHandle('EmptyOne', { create: true });
    await dir3ds.getDirectoryHandle('EmptyTwo', { create: true });

    const report = await scan3dsApps(compatible.handle);
    const groups = group3dsFindings(report, 1);
    expect(groups.map((g) => g.kind)).toEqual(['empty-folder', 'heavy-file']);
    expect(groups.map((g) => g.total)).toEqual([2, 4]);
    expect(groups.map((g) => g.visible.length)).toEqual([1, 1]);
    expect(groups.map((g) => g.hidden)).toEqual([1, 3]);

    const expanded = group3dsFindings(report, Number.POSITIVE_INFINITY);
    expect(expanded.every((g) => g.hidden === 0)).toBe(true);
    expect(expanded.reduce((sum, g) => sum + g.visible.length, 0)).toBe(report.findings.length);
  });
});
