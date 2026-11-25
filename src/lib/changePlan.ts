/**
 * Dry-run planning for every mutating 3DSdex flow.
 *
 * A plan is pure data: views show it before touching the card, then execute it
 * only after the user confirms. The same plan feeds the `.zip` manifest in
 * Firefox compatible mode, so both filesystem modes preview exactly the same
 * operations.
 *
 * No function in this module touches a filesystem handle.
 */

import { formatSdPath, isCriticalSystemPath } from './criticalPaths.ts';

export type ChangeKind = 'create' | 'backup' | 'move' | 'delete';

/** Why an operation was planned; the UI maps it to an i18n label. */
export type ChangeReason =
  | 'junk'
  | 'leftover'
  | 'misplaced'
  | 'backup-package'
  | 'orphan'
  | 'critical-update'
  | 'homebrew'
  | 'cover';

export interface PlannedChange {
  kind: ChangeKind;
  /** SD-relative target path (the removed path for a delete). */
  path: string;
  /** Source path for a move or a backup. */
  from?: string;
  /** Destination path for a move. */
  to?: string;
  size?: number;
  reason: ChangeReason;
}

export interface ChangePlan {
  changes: PlannedChange[];
  /** Critical-system operations rejected by the whitelist. */
  blocked: PlannedChange[];
}

/** Stable identity so repeated previews do not duplicate manifest lines. */
function changeKey(change: PlannedChange): string {
  return [change.kind, change.from ?? '', change.to ?? '', change.path, change.reason].join('|');
}

/** True when every path involved in `change` is outside critical system folders. */
export function isChangeAllowed(change: PlannedChange): boolean {
  const paths = [change.path, change.from, change.to].filter(
    (p): p is string => p !== undefined,
  );
  return !paths.some((p) => isCriticalSystemPath(p));
}

/** Sorts out allowed and blocked changes, dropping duplicates. */
export function createChangePlan(changes: readonly PlannedChange[]): ChangePlan {
  const seen = new Set<string>();
  const plan: ChangePlan = { changes: [], blocked: [] };
  for (const change of changes) {
    const key = changeKey(change);
    if (seen.has(key)) continue;
    seen.add(key);
    (isChangeAllowed(change) ? plan.changes : plan.blocked).push(change);
  }
  return plan;
}

/** Combines plans built by different views into one preview. */
export function mergeChangePlans(...plans: readonly ChangePlan[]): ChangePlan {
  return createChangePlan(plans.flatMap((plan) => [...plan.changes, ...plan.blocked]));
}

export interface ChangePlanSummary {
  create: number;
  backup: number;
  move: number;
  delete: number;
  blocked: number;
  totalBytes: number;
}

export function summarizePlan(plan: ChangePlan): ChangePlanSummary {
  const summary: ChangePlanSummary = {
    create: 0,
    backup: 0,
    move: 0,
    delete: 0,
    blocked: plan.blocked.length,
    totalBytes: 0,
  };
  for (const change of plan.changes) {
    summary[change.kind] += 1;
    summary.totalBytes += change.size ?? 0;
  }
  return summary;
}

function describeChange(change: PlannedChange): string {
  switch (change.kind) {
    case 'create':
      return `CREATE  /${change.path}`;
    case 'backup':
      return `BACKUP  /${change.from ?? change.path} -> /${change.path}`;
    case 'move':
      return `MOVE    /${change.from ?? ''} -> /${change.to ?? change.path}`;
    case 'delete':
      return `DELETE  /${change.path}`;
  }
}

/**
 * Human-readable manifest embedded in the exported `.zip`. It is
 * bilingual on purpose: it is read on a computer after leaving the browser.
 */
export function planManifestLines(
  plan: ChangePlan,
  mode: 'direct' | 'compat',
  note?: string,
): string[] {
  const summary = summarizePlan(plan);
  const lines = [
    '3DSDEX - Change preview / Vista previa de cambios',
    '==================================================',
    `Mode / Modo: ${mode === 'direct' ? 'direct (Chromium)' : 'compatible (Firefox / .zip)'}`,
    `create: ${summary.create} · backup: ${summary.backup} · move: ${summary.move} · delete: ${summary.delete}`,
    '',
  ];
  for (const change of plan.changes) {
    lines.push(`${describeChange(change)} [${change.reason}]`);
  }
  if (plan.blocked.length > 0) {
    lines.push('', 'BLOCKED - critical system paths (never modified) / BLOQUEADOS:');
    for (const change of plan.blocked) {
      lines.push(`${describeChange(change)} [critical]`);
    }
  }
  if (note !== undefined && note.length > 0) {
    lines.push('', note);
  }
  lines.push('');
  return lines;
}

interface JunkInput {
  path: readonly string[];
  name: string;
  size: number;
}
interface LeftoverInput extends JunkInput {
  id: string;
}
interface MisplacedInput {
  name: string;
  size: number;
  suggestedDir: string;
}

/** Preview for the OS-junk / leftover cleanup in `Health3dsView`. */
export function buildCleanupPlan(input: {
  junkFiles: readonly JunkInput[];
  junkDirs: readonly { name: string; preventionOnly: boolean }[];
  emptyLostDir: boolean;
  leftovers: readonly LeftoverInput[];
  selectedLeftovers: ReadonlySet<string>;
}): ChangePlan {
  const changes: PlannedChange[] = input.junkFiles.map((file) => ({
    kind: 'delete',
    path: formatSdPath([...file.path, file.name]),
    size: file.size,
    reason: 'junk',
  }));
  for (const dir of input.junkDirs) {
    if (dir.preventionOnly) continue;
    changes.push({ kind: 'delete', path: `${dir.name}/`, reason: 'junk' });
  }
  if (input.emptyLostDir) {
    changes.push({ kind: 'delete', path: 'LOST.DIR/', reason: 'junk' });
  }
  for (const item of input.leftovers) {
    if (!input.selectedLeftovers.has(item.id)) continue;
    changes.push({
      kind: 'delete',
      path: formatSdPath([...item.path, item.name]),
      size: item.size,
      reason: 'leftover',
    });
  }
  return createChangePlan(changes);
}

/** Preview for moving loose `.cia` / `.3dsx` / `.firm` files to standard folders. */
export function buildMovePlan(files: readonly MisplacedInput[]): ChangePlan {
  return createChangePlan(
    files.map((file) => ({
      kind: 'move' as const,
      path: `${file.suggestedDir}/${file.name}`,
      from: file.name,
      to: `${file.suggestedDir}/${file.name}`,
      size: file.size,
      reason: 'misplaced' as const,
    })),
  );
}

/** Preview for exporting selected local backup packages. */
export function buildBackupExportPlan(
  items: readonly { path: readonly string[]; name: string; size: number }[],
): ChangePlan {
  return createChangePlan(
    items.map((item) => ({
      kind: 'backup' as const,
      path: formatSdPath([...item.path, item.name]),
      size: item.size,
      reason: 'backup-package' as const,
    })),
  );
}

/** Preview for an explicitly requested review/cleanup of `/3ds/` findings. */
export function buildOrphanPlan(
  items: readonly { path: readonly string[]; name: string; size: number }[],
): ChangePlan {
  return createChangePlan(
    items.map((item) => ({
      kind: 'delete' as const,
      path: formatSdPath([...item.path, item.name]),
      size: item.size,
      reason: 'orphan' as const,
    })),
  );
}

/** Preview for a verified overwrite of a critical CFW/homebrew file. */
export function buildWritePlan(
  path: string,
  reason: ChangeReason,
  size?: number,
  backedUpPath?: string | null,
): ChangePlan {
  const changes: PlannedChange[] = [];
  if (backedUpPath != null) {
    changes.push({ kind: 'backup', path: backedUpPath, from: path, size, reason });
  }
  changes.push({ kind: 'create', path, size, reason });
  return createChangePlan(changes);
}
