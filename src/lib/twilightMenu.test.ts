import { describe, expect, it } from 'vitest';
import { createCompatRootFromFiles } from './compatFs.ts';
import { getDir, readFileBytes } from './sdcard.ts';
import {
  downloadMissingTwilightCovers,
  inspectTwilightMenu,
  scanTwilightGamesAndCovers,
} from './twilightMenu.ts';

function fakeFile(relPath: string, content = 'x'): File {
  const name = relPath.split('/').pop() ?? relPath;
  const file = new File([content], name, { lastModified: 1700000000000 });
  Object.defineProperty(file, 'webkitRelativePath', { value: relPath });
  return file;
}

describe('twilightMenu', () => {
  it('inspects TM++ installation and scans ROMs skipping protected folders', async () => {
    const compat = createCompatRootFromFiles([
      fakeFile('SD/BOOT.NDS', 'bootnds'),
      fakeFile('SD/_nds/release-bootstrap.ver', 'v2.4.0'),
      fakeFile('SD/_nds/TWiLightMenu/main.srldr', 'srldr'),
      fakeFile('SD/_nds/TWiLightMenu/boxart/Mario Kart DS.nds.png', 'png'),
      fakeFile('SD/Roms/nds/Mario Kart DS.nds', 'rom1'),
      fakeFile('SD/Roms/nds/New Super Mario Bros.nds', 'rom2'),
      fakeFile('SD/Nintendo 3DS/ignored.nds', 'ignore'),
    ]);

    const status = await inspectTwilightMenu(compat.handle);
    expect(status.installed).toBe(true);
    expect(status.hasBootNds).toBe(true);
    expect(status.hasMainSrldr).toBe(true);
    expect(status.hasBoxartDir).toBe(true);
    expect(status.bootstrapVer).toBe('v2.4.0');
    // The bootstrap version is kept on its own field and never becomes the
    // installed TWiLight Menu++ version.
    expect(status.versionCheck.detectedVersion).toBeNull();
    expect(status.versionCheck.status).toBe('unknown-version');

    const games = await scanTwilightGamesAndCovers(compat.handle);
    expect(games).toHaveLength(2);
    expect(games.find((g) => g.game.fileName === 'Mario Kart DS.nds')?.hasCover).toBe(true);
    expect(games.find((g) => g.game.fileName === 'New Super Mario Bros.nds')?.hasCover).toBe(false);
  });

  it('downloads missing TM++ covers into /_nds/TWiLightMenu/boxart/', async () => {
    const compat = createCompatRootFromFiles([
      fakeFile('SD/BOOT.NDS', 'bootnds'),
      fakeFile('SD/Roms/nds/New Super Mario Bros.nds', 'rom2'),
    ]);

    const games = await scanTwilightGamesAndCovers(compat.handle);
    const mockFetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api.github.com/repos/')) {
        return new Response(
          JSON.stringify({
            truncated: false,
            tree: [
              {
                path: 'Named_Boxarts/New Super Mario Bros. (Europe).png',
                type: 'blob',
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
    };

    const result = await downloadMissingTwilightCovers(compat.handle, games, {
      fetcher: mockFetch as typeof fetch,
    });

    expect(result).toEqual({ totalMissing: 1, downloaded: 1, notFound: 0, errors: 0 });
    const boxartDir = await getDir(compat.handle, ['_nds', 'TWiLightMenu', 'boxart']);
    const saved = await readFileBytes(boxartDir!, 'New Super Mario Bros.nds.png');
    expect(saved).toEqual(new Uint8Array([137, 80, 78, 71]));
  });
});
