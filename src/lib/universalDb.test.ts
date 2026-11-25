import { describe, expect, it } from 'vitest';
import { createCompatRootFromFiles } from './compatFs.ts';
import { readFileBytes } from './sdcard.ts';
import {
  crossReferenceApps,
  downloadAndInstallHomebrew,
  parseUniversalDbEntries,
  scanInstalledHomebrew,
} from './universalDb.ts';

function fakeFile(relPath: string, content = 'x'): File {
  const name = relPath.split('/').pop() ?? relPath;
  const file = new File([content], name, { lastModified: 1700000000000 });
  Object.defineProperty(file, 'webkitRelativePath', { value: relPath });
  return file;
}

describe('universalDb', () => {
  it('filters to 3DS apps and cross-references installed homebrew', async () => {
    const apps = parseUniversalDbEntries([
      {
        title: 'Checkpoint',
        author: 'BernardoGiordano',
        version: 'v3.8.0',
        systems: ['3DS'],
        categories: ['save-manager'],
        downloads: {
          'Checkpoint.3dsx': { url: 'https://example.com/Checkpoint.3dsx' },
        },
      },
      {
        title: 'DSiOnlyApp',
        systems: ['DSi'],
        downloads: { 'app.nds': { url: 'https://example.com/app.nds' } },
      },
    ]);

    expect(apps).toHaveLength(1);
    expect(apps[0].title).toBe('Checkpoint');

    const compat = createCompatRootFromFiles([
      fakeFile('SD/3ds/Checkpoint.3dsx', 'old-checkpoint'),
      fakeFile('SD/nsa/settings.json', '{}'),
    ]);
    const index = await scanInstalledHomebrew(compat.handle);
    const crossed = crossReferenceApps(apps, index);

    expect(crossed[0].installed).toBe(true);
    expect(crossed[0].installedAt).toBe('/3ds/Checkpoint.3dsx');
  });

  it('downloads and safely installs an app with automatic backup', async () => {
    const apps = parseUniversalDbEntries([
      {
        title: 'Checkpoint',
        systems: ['3DS'],
        downloads: {
          'Checkpoint.3dsx': { url: 'https://example.com/Checkpoint.3dsx' },
        },
      },
    ]);

    const compat = createCompatRootFromFiles([
      fakeFile('SD/3ds/Checkpoint.3dsx', 'old-bytes'),
    ]);

    const mockFetch = async () =>
      new Response(new TextEncoder().encode('new-checkpoint-bytes'), { status: 200 });

    const res = await downloadAndInstallHomebrew(
      compat.handle,
      apps[0].downloads[0],
      mockFetch as typeof fetch,
    );

    expect(res.writtenPath).toBe('3ds/Checkpoint.3dsx');
    expect(res.backedUpPath).toContain('luma/backups/3dsdex/');
    const written = await readFileBytes(
      await compat.handle.getDirectoryHandle('3ds'),
      'Checkpoint.3dsx',
    );
    expect(new TextDecoder().decode(written!)).toBe('new-checkpoint-bytes');
  });
});
