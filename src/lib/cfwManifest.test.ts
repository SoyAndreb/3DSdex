import { describe, expect, it } from 'vitest';
import {
  CFW_MANIFEST,
  extractVersionFromBytes,
  identifyCfwComponent,
  normalizeVersion,
} from './cfwManifest.ts';
import { scanCfwAndUtilities } from './cfwScan.ts';
import { createCompatRootFromFiles } from './compatFs.ts';

function fakeFile(relPath: string, content = 'x'): File {
  const name = relPath.split('/').pop() ?? relPath;
  const file = new File([content], name, { lastModified: 1700000000000 });
  Object.defineProperty(file, 'webkitRelativePath', { value: relPath });
  return file;
}

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('identifyCfwComponent', () => {
  it('identifies up-to-date, outdated, no-version, and missing components', () => {
    const latestLuma = CFW_MANIFEST.components.luma3ds.releases.at(-1)!;
    const oldLuma = CFW_MANIFEST.components.luma3ds.releases[0];

    expect(identifyCfwComponent(CFW_MANIFEST, 'luma3ds', latestLuma.sha256, 300000).status).toBe(
      'up-to-date',
    );
    const outdated = identifyCfwComponent(CFW_MANIFEST, 'luma3ds', oldLuma.sha256, 300000);
    expect(outdated.status).toBe('outdated');
    expect(outdated.detectedVersion).toBe(oldLuma.tag);

    // Even latest manifest entry becomes outdated if live GitHub tag is newer
    const behindLive = identifyCfwComponent(
      CFW_MANIFEST,
      'luma3ds',
      latestLuma.sha256,
      300000,
      'v99.0.0',
    );
    expect(behindLive.status).toBe('outdated');
    expect(behindLive.latestVersion).toBe('v99.0.0');

    const noVersion = identifyCfwComponent(CFW_MANIFEST, 'luma3ds', 'deadbeef', 100);
    expect(noVersion.status).toBe('unknown-version');
    expect(noVersion.detectedVersion).toBeNull();
    expect(identifyCfwComponent(CFW_MANIFEST, 'luma3ds', null, null).status).toBe('missing');
  });

  it('accepts version evidence from a binary or /_nds/ version file', () => {
    const custom = identifyCfwComponent(CFW_MANIFEST, 'luma3ds', 'deadbeef', 100, null, {
      version: '13.3.3',
      source: 'binary',
    });
    expect(custom.status).toBe('up-to-date');
    expect(custom.detectedVersion).toBe('v13.3.3');
    expect(custom.versionSource).toBe('binary');

    const oldFile = identifyCfwComponent(CFW_MANIFEST, 'twilight', 'deadbeef', 100, null, {
      version: 'v27.10.0',
      source: 'file',
    });
    expect(oldFile.status).toBe('outdated');
    expect(oldFile.detectedVersion).toBe('v27.10.0');
    expect(oldFile.versionSource).toBe('file');

    // nds-bootstrap v2.x evidence must NEVER be reported as a TWiLight version.
    const bootstrapMistakenForTwilight = identifyCfwComponent(
      CFW_MANIFEST,
      'twilight',
      'deadbeef',
      100,
      null,
      { version: 'v2.17.0', source: 'file' },
    );
    expect(bootstrapMistakenForTwilight.status).toBe('unknown-version');
    expect(bootstrapMistakenForTwilight.detectedVersion).toBeNull();
  });
});

describe('manifest sources', () => {
  it('keeps the official hbmenu repository (also shipped inside Luma3DS releases)', () => {
    expect(CFW_MANIFEST.components.hbmenu.repo).toBe('devkitPro/3ds-hbmenu');
    expect(CFW_MANIFEST.components.luma3ds.repo).toBe('LumaTeam/Luma3DS');
  });
});

describe('embedded version extraction', () => {
  it('reads Luma3DS, hbmenu, GodMode9 and TWiLight strings', () => {
    expect(normalizeVersion('13.3.3')).toBe('v13.3.3');
    expect(extractVersionFromBytes(bytes('Luma3DS v13.3.3\x00config'), 'luma3ds')).toBe('v13.3.3');
    expect(extractVersionFromBytes(bytes('3DS Homebrew Menu v2.4.4'), 'hbmenu')).toBe('v2.4.4');
    expect(extractVersionFromBytes(bytes('GodMode9 v2.1.1'), 'godmode9')).toBe('v2.1.1');
    expect(extractVersionFromBytes(bytes('TWiLight Menu++ v27.14.0'), 'twilight')).toBe('v27.14.0');
    expect(extractVersionFromBytes(bytes('no version here'), 'luma3ds')).toBeNull();
  });

  it('reads the installed version during a real SD scan', async () => {
    const compat = createCompatRootFromFiles([
      fakeFile('SD/boot.firm', '\x00Luma3DS v13.3.3 custom build'),
      fakeFile('SD/boot.3dsx', '3DS Homebrew Menu v2.4.4'),
      fakeFile('SD/luma/payloads/GodMode9.firm', 'GodMode9 v2.1.1'),
      fakeFile('SD/BOOT.NDS', 'TWiLight Menu++ v27.10.0'),
      fakeFile('SD/_nds/TWiLightMenu/version.txt', 'v27.14.0'),
    ]);
    const res = await scanCfwAndUtilities(compat.handle);
    expect(res.components.map((c) => [c.id, c.detectedVersion, c.versionSource])).toEqual([
      ['luma3ds', 'v13.3.3', 'binary'],
      ['hbmenu', 'v2.4.4', 'binary'],
      ['godmode9', 'v2.1.1', 'binary'],
      // Version files take precedence over the BOOT.NDS binary.
      ['twilight', 'v27.14.0', 'file'],
    ]);
    expect(res.components.every((c) => c.status === 'up-to-date')).toBe(true);
  });

  it('never uses nds-bootstrap as the TWiLight Menu++ version', async () => {
    const compat = createCompatRootFromFiles([
      fakeFile('SD/BOOT.NDS', 'no embedded version here'),
      fakeFile('SD/_nds/release-bootstrap.ver', 'v2.17.0'),
      fakeFile('SD/_nds/TWiLightMenu/main.srldr', 'no embedded version here'),
    ]);
    const res = await scanCfwAndUtilities(compat.handle);
    const twilight = res.components.find((c) => c.id === 'twilight')!;
    expect(twilight.detectedVersion).toBeNull();
    expect(twilight.status).toBe('unknown-version');

    // The very same file is a valid, independent nds-bootstrap detection.
    expect(res.bootstrap.id).toBe('nds-bootstrap');
    expect(res.bootstrap.detectedVersion).toBe('v2.17.0');
    expect(res.bootstrap.versionSource).toBe('file');
    expect(res.bootstrap.status).toBe('up-to-date');
  });

  it('keeps a newer live nds-bootstrap tag independent from TWiLight', async () => {
    const compat = createCompatRootFromFiles([
      fakeFile('SD/_nds/release-bootstrap.ver', 'v2.17.0'),
    ]);
    const res = await scanCfwAndUtilities(compat.handle, {}, 'v2.20.0');
    expect(res.bootstrap.latestVersion).toBe('v2.20.0');
    expect(res.bootstrap.status).toBe('outdated');
    expect(res.components.find((c) => c.id === 'twilight')?.status).toBe('missing');
  });
});

describe('scanCfwAndUtilities', () => {
  it('reports no version when binaries and version files are unreadable', async () => {
    const compat = createCompatRootFromFiles([
      fakeFile('SD/boot.firm', 'custom-luma'),
      fakeFile('SD/boot.3dsx', 'custom-hbmenu'),
      fakeFile('SD/luma/payloads/GodMode9.firm', 'custom-gm9'),
      fakeFile('SD/3ds/Anemone3DS.3dsx', 'app'),
      fakeFile('SD/nsa/settings.json', '{}'),
    ]);

    const res = await scanCfwAndUtilities(compat.handle);
    expect(res.components.find((c) => c.id === 'luma3ds')?.status).toBe('unknown-version');
    expect(res.components.find((c) => c.id === 'twilight')?.status).toBe('missing');
    expect(res.utilities.find((u) => u.name === 'Anemone3DS')?.present).toBe(true);
    expect(res.utilities.find((u) => u.name === 'NSA')?.present).toBe(true);
    expect(res.utilities.find((u) => u.name === 'Checkpoint')?.present).toBe(false);
  });
});
