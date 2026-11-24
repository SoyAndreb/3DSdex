import { describe, expect, it } from 'vitest';
import { createCompatRootFromFiles } from './compatFs.ts';
import { audit3dsCard, evaluateFbiNsaRule, NSA_REPO_URL } from './sdAudit.ts';
import { looksLike3dsSd } from './sd3ds.ts';

function fakeFile(relPath: string, content = 'x'): File {
  const name = relPath.split('/').pop() ?? relPath;
  const file = new File([content], name, { lastModified: 1700000000000 });
  Object.defineProperty(file, 'webkitRelativePath', { value: relPath });
  return file;
}

describe('evaluateFbiNsaRule', () => {
  it('recommends NSA when FBI is present and NSA is absent', () => {
    const res = evaluateFbiNsaRule({ hasFbiDir: true, hasNsaDir: false });
    expect(res.recommendNsa).toBe(true);
    expect(res.status).toBe('recommend-nsa');
    expect(res.url).toBe(NSA_REPO_URL);
  });

  it('does not recommend NSA when NSA is present alone', () => {
    const res = evaluateFbiNsaRule({ hasFbiDir: false, hasNsaDir: true });
    expect(res.recommendNsa).toBe(false);
    expect(res.status).toBe('ok-nsa');
    expect(res.url).toBeNull();
  });

  it('suppresses recommendation when BOTH FBI and NSA folders exist', () => {
    const res = evaluateFbiNsaRule({ hasFbiDir: true, hasNsaDir: true });
    expect(res.recommendNsa).toBe(false);
    expect(res.status).toBe('ok-nsa');
    expect(res.url).toBeNull();
  });

  it('does not recommend NSA when neither folder exists', () => {
    const res = evaluateFbiNsaRule({ hasFbiDir: false, hasNsaDir: false });
    expect(res.recommendNsa).toBe(false);
    expect(res.status).toBe('none');
  });
});

describe('audit3dsCard', () => {
  it('audits critical files, misplaced .cia, OS junk, protected dirs, and FBI without NSA', async () => {
    const compat = createCompatRootFromFiles([
      fakeFile('SD_3DS/boot.firm', 'luma'),
      fakeFile('SD_3DS/boot.3dsx', 'hbmenu'),
      fakeFile('SD_3DS/luma/config.ini', 'cfg'),
      fakeFile('SD_3DS/luma/payloads/GodMode9.firm', 'gm9'),
      fakeFile('SD_3DS/themezer-3ds.cia', 'cia-data'),
      fakeFile('SD_3DS/fbi/lasturls', 'http://example'),
      fakeFile('SD_3DS/.DS_Store', 'junk'),
      fakeFile('SD_3DS/.fseventsd/fseventsd-uuid', 'uuid'),
      // Inside protected Nintendo 3DS: even a ._ file should not be touched/scanned
      fakeFile('SD_3DS/Nintendo 3DS/._protected', 'keep'),
      fakeFile('SD_3DS/boot9strap/key.bin', 'secret'),
    ]);

    expect(await looksLike3dsSd(compat.handle)).toBe(true);

    const audit = await audit3dsCard(compat.handle);
    expect(audit.hasBootFirm).toBe(true);
    expect(audit.hasBoot3dsx).toBe(true);
    expect(audit.hasGodMode9).toBe(true);
    expect(audit.hasLumaConfig).toBe(true);

    expect(audit.fbiNsa.recommendNsa).toBe(true);
    expect(audit.fbiNsa.url).toBe(NSA_REPO_URL);

    expect(audit.misplacedFiles).toHaveLength(1);
    expect(audit.misplacedFiles[0]).toMatchObject({
      name: 'themezer-3ds.cia',
      kind: 'cia',
      suggestedDir: 'cias',
    });

    expect(audit.junkFiles.map((f) => f.name)).toEqual(['.DS_Store']);
    expect(audit.junkDirs).toEqual([{ name: '.fseventsd', preventionOnly: false }]);
  });

  it('suppresses NSA recommendation when both fbi/ and nsa/ exist (like reference SD)', async () => {
    const compat = createCompatRootFromFiles([
      fakeFile('SD_3DS/boot.firm', 'luma'),
      fakeFile('SD_3DS/fbi/lasturls', 'old'),
      fakeFile('SD_3DS/nsa/settings.json', '{}'),
    ]);

    const audit = await audit3dsCard(compat.handle);
    expect(audit.fbiNsa.hasFbiDir).toBe(true);
    expect(audit.fbiNsa.hasNsaDir).toBe(true);
    expect(audit.fbiNsa.recommendNsa).toBe(false);
  });
});
