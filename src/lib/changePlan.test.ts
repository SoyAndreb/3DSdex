import { describe, expect, it } from 'vitest';
import {
  buildBackupExportPlan,
  buildCleanupPlan,
  buildMovePlan,
  buildWritePlan,
  createChangePlan,
  isChangeAllowed,
  mergeChangePlans,
  planManifestLines,
  summarizePlan,
  type PlannedChange,
} from './changePlan.ts';

describe('changePlan', () => {
  it('separates blocked critical paths from permitted changes', () => {
    const plan = createChangePlan([
      { kind: 'create', path: 'cias/app.cia', reason: 'homebrew', size: 10 },
      { kind: 'delete', path: 'Nintendo 3DS/00000000/data', reason: 'junk', size: 99 },
      { kind: 'move', from: 'app.3dsx', to: '3ds/app.3dsx', path: '3ds/app.3dsx', reason: 'misplaced' },
      { kind: 'backup', from: 'boot.firm', to: 'boot9strap/boot.firm', path: 'boot9strap/boot.firm', reason: 'critical-update' },
    ]);
    expect(plan.changes).toHaveLength(2);
    expect(plan.blocked).toHaveLength(2);
    expect(summarizePlan(plan)).toMatchObject({ create: 1, move: 1, blocked: 2, totalBytes: 10 });
    expect(isChangeAllowed({ kind: 'delete', path: 'NINTENDO 3DS/a', reason: 'junk' })).toBe(false);
  });

  it('deduplicates identical changes and merges plans', () => {
    const item: PlannedChange = { kind: 'create', path: 'cias/a.cia', reason: 'homebrew' };
    const merged = mergeChangePlans(
      createChangePlan([item, item]),
      createChangePlan([{ kind: 'delete', path: 'a.cia', reason: 'misplaced' }]),
    );
    expect(merged.changes).toHaveLength(2);
  });

  it('builds previews for cleanup, moves, backups and writes', () => {
    const cleanup = buildCleanupPlan({
      junkFiles: [{ path: ['sub'], name: '.DS_Store', size: 4 }],
      junkDirs: [{ name: '.fseventsd', preventionOnly: true }, { name: '.Trashes', preventionOnly: false }],
      emptyLostDir: true,
      leftovers: [{ id: 'bak', path: [], name: 'boot.firm.bak', size: 8 }],
      selectedLeftovers: new Set(['bak']),
    });
    expect(cleanup.changes.map((c) => c.path)).toEqual([
      'sub/.DS_Store',
      '.Trashes/',
      'LOST.DIR/',
      'boot.firm.bak',
    ]);

    expect(buildMovePlan([{ name: 'a.cia', size: 1, suggestedDir: 'cias' }]).changes[0]).toMatchObject({
      kind: 'move',
      from: 'a.cia',
      to: 'cias/a.cia',
    });
    expect(buildBackupExportPlan([{ path: ['gm9', 'out'], name: 'dump.firm', size: 3 }]).changes[0].kind).toBe('backup');
    expect(buildWritePlan('boot.firm', 'critical-update', 2, 'luma/backups/3dsdex/x/boot.firm').changes.map((c) => c.kind)).toEqual(['backup', 'create']);
  });

  it('writes a bilingual manifest with blocked critical paths and a manual note', () => {
    const lines = planManifestLines(
      createChangePlan([
        { kind: 'delete', path: 'Nintendo 3DS/a', reason: 'junk' },
        { kind: 'create', path: 'cias/a.cia', reason: 'homebrew' },
      ]),
      'compat',
      'Extrae el .zip en la raíz de la SD.',
    );
    const text = lines.join('\n');
    expect(text).toContain('Mode / Modo: compatible');
    expect(text).toContain('CREATE  /cias/a.cia [homebrew]');
    expect(text).toContain('BLOQUEADOS');
    expect(text).toContain('Extrae el .zip en la raíz de la SD.');
  });
});
