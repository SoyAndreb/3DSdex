/**
 * Virtual FileSystemDirectoryHandle adapter for browsers without the File System
 * Access API (`showDirectoryPicker`), such as Firefox and Safari.
 *
 * Built from a `FileList` (via `<input type="file" webkitdirectory>`):
 * - Reads flow directly from the selected `File` objects without copying bytes
 *   into RAM upfront.
 * - Writes and deletions are recorded in an in-memory overlay so the user can
 *   safely preview changes and export them as a `.zip` preserving the exact
 *   SD card folder hierarchy.
 */

import { planManifestLines, type ChangePlan } from './changePlan.ts';
import { assertNotCriticalPath, isCriticalSystemPath } from './criticalPaths.ts';
import { buildZip, type ZipEntryInput } from './zipExport.ts';

export type FsMode = 'direct' | 'compat';

export interface CompatChangeSummary {
  written: string[];
  deleted: string[];
  /** Mutating operations rejected by the critical-system whitelist. */
  blocked: string[];
  /** How many operations were included in the last planned dry-run. */
  plannedCount: number;
}

export interface CompatRootState {
  rootName: string;
  handle: FileSystemDirectoryHandle;
  getChanges: () => CompatChangeSummary;
  /** Records a dry-run plan so the exported ZIP carries its manifest. */
  notePlan: (plan: ChangePlan) => void;
  exportZip: () => Promise<Uint8Array<ArrayBuffer>>;
}

function makeDomError(name: string, message: string): DOMException {
  return new DOMException(message, name);
}

class CompatFileHandle {
  readonly kind = 'file' as const;
  readonly name: string;
  private file: File | null;
  private writtenBytes: Uint8Array | null = null;
  private readonly relPath: string;
  private readonly onWrite: (relPath: string, bytes: Uint8Array) => void;

  constructor(
    name: string,
    relPath: string,
    file: File | null,
    onWrite: (relPath: string, bytes: Uint8Array) => void,
  ) {
    this.name = name;
    this.relPath = relPath;
    this.file = file;
    this.onWrite = onWrite;
  }

  async getFile(): Promise<File> {
    if (this.writtenBytes !== null) {
      const copy = new Uint8Array(this.writtenBytes.length);
      copy.set(this.writtenBytes);
      return new File([copy.buffer], this.name, { lastModified: Date.now() });
    }
    if (this.file === null) {
      throw makeDomError('NotFoundError', `File not found: ${this.relPath}`);
    }
    return this.file;
  }

  async createWritable(): Promise<FileSystemWritableFileStream> {
    // Critical folders are readable in compatible mode but never writable.
    assertNotCriticalPath(this.relPath);
    const chunks: Uint8Array[] = [];
    const commit = (bytes: Uint8Array) => {
      this.writtenBytes = bytes;
      this.file = null;
      this.onWrite(this.relPath, bytes);
    };
    return {
      async write(data: unknown) {
        if (data instanceof Uint8Array) {
          chunks.push(new Uint8Array(data));
        } else if (data instanceof ArrayBuffer) {
          chunks.push(new Uint8Array(data));
        } else if (typeof data === 'string') {
          chunks.push(new TextEncoder().encode(data));
        } else if (data instanceof Blob) {
          chunks.push(new Uint8Array(await data.arrayBuffer()));
        } else {
          throw new TypeError('Unsupported write chunk type');
        }
      },
      async abort() {
        chunks.length = 0;
      },
      async close() {
        const total = chunks.reduce((sum, c) => sum + c.length, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        commit(merged);
      },
    } as unknown as FileSystemWritableFileStream;
  }

  async isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return other === (this as unknown as FileSystemHandle);
  }
}

class CompatDirectoryHandle {
  readonly kind = 'directory' as const;
  readonly name: string;
  private readonly relPath: string;
  private readonly children = new Map<string, CompatDirectoryHandle | CompatFileHandle>();
  private readonly tracker: CompatChangeTracker;

  constructor(name: string, relPath: string, tracker: CompatChangeTracker) {
    this.name = name;
    this.relPath = relPath;
    this.tracker = tracker;
  }

  private childPath(name: string): string {
    return this.relPath === '' ? name : `${this.relPath}/${name}`;
  }

  private findChildKey(name: string): string | undefined {
    const target = name.toLowerCase();
    for (const key of this.children.keys()) {
      if (key.toLowerCase() === target) {
        return key;
      }
    }
    return undefined;
  }

  insertInitialFile(segments: readonly string[], file: File): void {
    if (segments.length === 0) return;
    if (segments.length === 1) {
      const fileName = segments[0];
      const path = this.childPath(fileName);
      this.children.set(
        fileName,
        new CompatFileHandle(fileName, path, file, (p, b) => this.tracker.markWritten(p, b)),
      );
      return;
    }
    const [head, ...rest] = segments;
    let sub = this.children.get(head);
    if (sub === undefined || sub.kind !== 'directory') {
      sub = new CompatDirectoryHandle(head, this.childPath(head), this.tracker);
      this.children.set(head, sub);
    }
    sub.insertInitialFile(rest, file);
  }

  async getDirectoryHandle(
    name: string,
    options?: FileSystemGetDirectoryOptions,
  ): Promise<FileSystemDirectoryHandle> {
    const existingKey = this.findChildKey(name);
    if (existingKey !== undefined) {
      const entry = this.children.get(existingKey)!;
      if (entry.kind !== 'directory') {
        throw makeDomError('TypeMismatchError', `${name} is a file`);
      }
      return entry as unknown as FileSystemDirectoryHandle;
    }
    if (options?.create) {
      assertNotCriticalPath(this.childPath(name));
      const created = new CompatDirectoryHandle(name, this.childPath(name), this.tracker);
      this.children.set(name, created);
      return created as unknown as FileSystemDirectoryHandle;
    }
    throw makeDomError('NotFoundError', `Directory not found: ${name}`);
  }

  async getFileHandle(
    name: string,
    options?: FileSystemGetFileOptions,
  ): Promise<FileSystemFileHandle> {
    const existingKey = this.findChildKey(name);
    if (existingKey !== undefined) {
      const entry = this.children.get(existingKey)!;
      if (entry.kind !== 'file') {
        throw makeDomError('TypeMismatchError', `${name} is a directory`);
      }
      return entry as unknown as FileSystemFileHandle;
    }
    if (options?.create) {
      const path = this.childPath(name);
      assertNotCriticalPath(path);
      const created = new CompatFileHandle(name, path, null, (p, b) =>
        this.tracker.markWritten(p, b),
      );
      this.children.set(name, created);
      return created as unknown as FileSystemFileHandle;
    }
    throw makeDomError('NotFoundError', `File not found: ${name}`);
  }

  async removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void> {
    assertNotCriticalPath(this.childPath(name));
    const existingKey = this.findChildKey(name);
    if (existingKey === undefined) {
      throw makeDomError('NotFoundError', `Entry not found: ${name}`);
    }
    const entry = this.children.get(existingKey)!;
    if (entry.kind === 'directory') {
      if (entry.children.size > 0 && !options?.recursive) {
        throw makeDomError('InvalidModificationError', `Directory not empty: ${name}`);
      }
      entry.collectAllPaths().forEach((p) => this.tracker.markDeleted(p));
    } else {
      this.tracker.markDeleted(this.childPath(existingKey));
    }
    this.children.delete(existingKey);
  }

  private collectAllPaths(): string[] {
    const out: string[] = [];
    for (const [key, entry] of this.children.entries()) {
      if (entry.kind === 'file') {
        out.push(this.childPath(key));
      } else {
        out.push(...entry.collectAllPaths());
      }
    }
    return out;
  }

  async *values(): AsyncIterableIterator<FileSystemHandle> {
    for (const entry of this.children.values()) {
      yield entry as unknown as FileSystemHandle;
    }
  }

  async isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return other === (this as unknown as FileSystemHandle);
  }
}

class CompatChangeTracker {
  private readonly written = new Map<string, Uint8Array>();
  private readonly deleted = new Set<string>();
  private readonly blocked = new Set<string>();
  private plan: ChangePlan = { changes: [], blocked: [] };

  markWritten(relPath: string, bytes: Uint8Array): void {
    if (isCriticalSystemPath(relPath)) {
      this.blocked.add(relPath);
      return;
    }
    this.deleted.delete(relPath);
    this.written.set(relPath, bytes);
  }

  markDeleted(relPath: string): void {
    if (isCriticalSystemPath(relPath)) {
      this.blocked.add(relPath);
      return;
    }
    this.written.delete(relPath);
    this.deleted.add(relPath);
  }

  /** Records a dry-run plan for the ZIP manifest and reports blocked paths. */
  notePlan(plan: ChangePlan): void {
    this.plan = plan;
    for (const change of plan.blocked) {
      this.blocked.add(change.path);
    }
  }

  summary(): CompatChangeSummary {
    return {
      written: Array.from(this.written.keys()).sort(),
      deleted: Array.from(this.deleted).sort(),
      blocked: Array.from(this.blocked).sort(),
      plannedCount: this.plan.changes.length,
    };
  }

  async buildExportZip(): Promise<Uint8Array<ArrayBuffer>> {
    const entries: ZipEntryInput[] = [];
    for (const [path, data] of this.written.entries()) {
      // Defense in depth: a critical path never reaches the archive.
      if (isCriticalSystemPath(path)) continue;
      entries.push({ path, data });
    }

    const manifest = planManifestLines(
      this.plan,
      'compat',
      'IMPORTANTE: extrae este .zip en la RAÍZ de la SD (o de tu copia local), manteniendo las rutas. ' +
        'Los archivos marcados para eliminar deben borrarse a mano: un .zip solo agrega o sobrescribe.',
    );
    entries.push({
      path: '3DSDEX_CAMBIOS.txt',
      data: new TextEncoder().encode(manifest.join('\n')),
    });

    if (this.deleted.size > 0) {
      const lines = [
        '3DSdex — Archivos marcados para eliminar en modo compatible (Firefox)',
        '=========================================================================',
        'Un archivo .zip solo puede agregar o sobrescribir archivos en tu tarjeta SD.',
        'Elimina manualmente las siguientes rutas si deseas completar la limpieza:',
        '',
        ...Array.from(this.deleted)
          .sort()
          .map((p) => `- ${p}`),
        '',
      ];
      entries.push({
        path: '3DSDEX_ELIMINAR_MANUALMENTE.txt',
        data: new TextEncoder().encode(lines.join('\n')),
      });
    }
    return buildZip(entries);
  }
}

/**
 * Builds an in-memory `FileSystemDirectoryHandle` tree from a browser `FileList`
 * (or array of `File` objects with `webkitRelativePath`).
 */
export function createCompatRootFromFiles(files: Iterable<File>): CompatRootState {
  const tracker = new CompatChangeTracker();
  const list = Array.from(files);
  const firstRel = list[0]?.webkitRelativePath ?? '';
  const rootName = firstRel.includes('/') ? firstRel.split('/')[0] : 'SD_3DS';
  const root = new CompatDirectoryHandle(rootName, '', tracker);

  for (const file of list) {
    const rel = file.webkitRelativePath || file.name;
    const parts = rel.split('/').filter((s) => s.length > 0);
    // Strip the top-level picked folder name when webkitRelativePath includes it.
    const inner = parts.length > 1 && parts[0] === rootName ? parts.slice(1) : parts;
    if (inner.length > 0) {
      root.insertInitialFile(inner, file);
    }
  }

  return {
    rootName,
    handle: root as unknown as FileSystemDirectoryHandle,
    getChanges: () => tracker.summary(),
    notePlan: (plan: ChangePlan) => tracker.notePlan(plan),
    exportZip: () => tracker.buildExportZip(),
  };
}
