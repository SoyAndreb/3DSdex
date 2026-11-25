import { describe, expect, it } from 'vitest';
import {
  assertNotCriticalPath,
  CRITICAL_SYSTEM_PATHS,
  formatSdPath,
  isCriticalSystemPath,
} from './sd3ds.ts';

describe('critical system whitelist', () => {
  it('protects both folders, their descendants and case variants', () => {
    expect(CRITICAL_SYSTEM_PATHS).toHaveLength(2);
    expect(isCriticalSystemPath(['Nintendo 3DS'])).toBe(true);
    expect(isCriticalSystemPath('boot9strap/boot9strap.firm')).toBe(true);
    expect(isCriticalSystemPath('nintendo 3ds/00000000/a.dat')).toBe(true);
    expect(isCriticalSystemPath('BOOT9STRAP\\secret')).toBe(true);
    expect(isCriticalSystemPath(['.', 'Nintendo 3DS', '', 'file'])).toBe(true);
  });

  it('leaves ordinary SD folders writable', () => {
    expect(isCriticalSystemPath('boot.firm')).toBe(false);
    expect(isCriticalSystemPath(['luma', 'payloads', 'GodMode9.firm'])).toBe(false);
    expect(isCriticalSystemPath('Nintendo 3DS备份/file')).toBe(false);
    expect(() => assertNotCriticalPath(['cias', 'app.cia'])).not.toThrow();
  });

  it('throws a browser-style denial before any mutation', () => {
    expect(() => assertNotCriticalPath(['Nintendo 3DS', '00000000'])).toThrowError(
      expect.objectContaining({ name: 'NotAllowedError' }),
    );
    expect(() => assertNotCriticalPath('boot9strap')).toThrowError(
      expect.objectContaining({ name: 'NotAllowedError' }),
    );
  });

  it('formats SD-relative paths consistently', () => {
    expect(formatSdPath(['gm9', 'out', 'dump.firm'])).toBe('gm9/out/dump.firm');
  });
});
