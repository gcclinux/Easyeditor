/**
 * Unit tests for CacheStore
 *
 * **Validates: Requirements 3.3, 3.4**
 *
 * Tests cover:
 * - Add, retrieve, clear operations
 * - `size` property accuracy
 * - Duplicate path overwrites
 */

import { CacheStore, SummaryRecord } from '../cacheStore';

describe('CacheStore', () => {
  let store: CacheStore;

  beforeEach(() => {
    store = new CacheStore();
  });

  // ── Requirement 3.3, 3.4: Add and retrieve operations ─────────────

  describe('add and retrieve', () => {
    it('stores and retrieves a single record by filePath', () => {
      const record: SummaryRecord = {
        filePath: 'src/index.ts',
        fileType: 'typescript',
        summary: 'Main entry point',
      };
      store.add(record);
      const retrieved = store.getByPath('src/index.ts');
      expect(retrieved).toEqual(record);
    });

    it('returns undefined for a path that was never added', () => {
      expect(store.getByPath('nonexistent.ts')).toBeUndefined();
    });

    it('stores multiple records and retrieves each correctly', () => {
      const r1: SummaryRecord = { filePath: 'a.ts', fileType: 'typescript', summary: 'File A' };
      const r2: SummaryRecord = { filePath: 'b.json', fileType: 'json', summary: 'File B' };
      const r3: SummaryRecord = { filePath: '__directory_tree__', fileType: 'tree', summary: 'src/\n  a.ts\nb.json' };

      store.add(r1);
      store.add(r2);
      store.add(r3);

      expect(store.getByPath('a.ts')).toEqual(r1);
      expect(store.getByPath('b.json')).toEqual(r2);
      expect(store.getByPath('__directory_tree__')).toEqual(r3);
    });

    it('getAll returns all stored records in insertion order', () => {
      const r1: SummaryRecord = { filePath: 'first.ts', fileType: 'typescript', summary: 'First' };
      const r2: SummaryRecord = { filePath: 'second.ts', fileType: 'typescript', summary: 'Second' };

      store.add(r1);
      store.add(r2);

      const all = store.getAll();
      expect(all).toEqual([r1, r2]);
    });

    it('getAll returns an empty array when store is empty', () => {
      expect(store.getAll()).toEqual([]);
    });
  });

  // ── Requirement 3.4: size property ─────────────────────────────────

  describe('size property', () => {
    it('returns 0 for a new empty store', () => {
      expect(store.size).toBe(0);
    });

    it('increments as records are added', () => {
      store.add({ filePath: 'a.ts', fileType: 'ts', summary: 'A' });
      expect(store.size).toBe(1);

      store.add({ filePath: 'b.ts', fileType: 'ts', summary: 'B' });
      expect(store.size).toBe(2);

      store.add({ filePath: 'c.ts', fileType: 'ts', summary: 'C' });
      expect(store.size).toBe(3);
    });

    it('does not increment when overwriting an existing path', () => {
      store.add({ filePath: 'a.ts', fileType: 'ts', summary: 'Original' });
      store.add({ filePath: 'a.ts', fileType: 'ts', summary: 'Updated' });
      expect(store.size).toBe(1);
    });

    it('returns 0 after clear', () => {
      store.add({ filePath: 'a.ts', fileType: 'ts', summary: 'A' });
      store.add({ filePath: 'b.ts', fileType: 'ts', summary: 'B' });
      store.clear();
      expect(store.size).toBe(0);
    });
  });

  // ── Clear operation ────────────────────────────────────────────────

  describe('clear', () => {
    it('removes all records from the store', () => {
      store.add({ filePath: 'a.ts', fileType: 'ts', summary: 'A' });
      store.add({ filePath: 'b.ts', fileType: 'ts', summary: 'B' });

      store.clear();

      expect(store.getAll()).toEqual([]);
      expect(store.getByPath('a.ts')).toBeUndefined();
      expect(store.getByPath('b.ts')).toBeUndefined();
    });

    it('is safe to call on an already empty store', () => {
      store.clear();
      expect(store.size).toBe(0);
      expect(store.getAll()).toEqual([]);
    });

    it('allows adding records again after clear', () => {
      store.add({ filePath: 'a.ts', fileType: 'ts', summary: 'A' });
      store.clear();

      const newRecord: SummaryRecord = { filePath: 'b.ts', fileType: 'ts', summary: 'B' };
      store.add(newRecord);

      expect(store.size).toBe(1);
      expect(store.getByPath('b.ts')).toEqual(newRecord);
    });
  });

  // ── Duplicate path overwrites ──────────────────────────────────────

  describe('duplicate path overwrites', () => {
    it('overwrites the previous record when adding with the same filePath', () => {
      const original: SummaryRecord = { filePath: 'src/app.ts', fileType: 'typescript', summary: 'Original summary' };
      const updated: SummaryRecord = { filePath: 'src/app.ts', fileType: 'typescript', summary: 'Updated summary' };

      store.add(original);
      store.add(updated);

      expect(store.getByPath('src/app.ts')).toEqual(updated);
      expect(store.getByPath('src/app.ts')!.summary).toBe('Updated summary');
    });

    it('can overwrite with a different fileType', () => {
      store.add({ filePath: 'config', fileType: 'json', summary: 'JSON config' });
      store.add({ filePath: 'config', fileType: 'yaml', summary: 'YAML config' });

      const result = store.getByPath('config');
      expect(result!.fileType).toBe('yaml');
      expect(result!.summary).toBe('YAML config');
    });

    it('getAll returns only the latest version of overwritten records', () => {
      store.add({ filePath: 'a.ts', fileType: 'ts', summary: 'v1' });
      store.add({ filePath: 'b.ts', fileType: 'ts', summary: 'v1' });
      store.add({ filePath: 'a.ts', fileType: 'ts', summary: 'v2' });

      const all = store.getAll();
      expect(all).toHaveLength(2);
      expect(all.find(r => r.filePath === 'a.ts')!.summary).toBe('v2');
      expect(all.find(r => r.filePath === 'b.ts')!.summary).toBe('v1');
    });
  });
});
