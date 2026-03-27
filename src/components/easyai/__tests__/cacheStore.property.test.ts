/**
 * Property-based tests for CacheStore
 * Feature: documentation-persona-repo-scanner, Property 3: CacheStore round-trip
 *
 * **Validates: Requirements 3.3, 3.4**
 *
 * Property 3: For any valid SummaryRecord (with non-empty filePath, fileType,
 * and summary), adding it to the CacheStore and then retrieving it by filePath
 * shall return a record with identical filePath, fileType, and summary values.
 */

import * as fc from 'fast-check';
import { CacheStore, SummaryRecord } from '../cacheStore';

/** Generate a safe path segment (alphanumeric + underscore/hyphen). */
const safeSegment = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), {
    minLength: 1,
    maxLength: 10,
  })
  .map((chars) => chars.join(''));

/** Generate a non-empty relative file path like "src/utils/helper.ts". */
const nonEmptyFilePath = fc
  .tuple(
    fc.array(safeSegment, { minLength: 1, maxLength: 4 }),
    safeSegment,
    fc.constantFrom('.ts', '.js', '.md', '.json', '.txt', '.py', '.rs', '.go'),
  )
  .map(([dirs, name, ext]) => [...dirs, `${name}${ext}`].join('/'));

/** Generate a non-empty file type string. */
const nonEmptyFileType = fc.constantFrom(
  'typescript', 'javascript', 'markdown', 'json', 'python', 'rust', 'go', 'text',
);

/** Generate a non-empty summary string. */
const nonEmptySummary = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.trim().length > 0);

/** Generate a valid SummaryRecord with non-empty fields. */
const summaryRecordArb: fc.Arbitrary<SummaryRecord> = fc
  .tuple(nonEmptyFilePath, nonEmptyFileType, nonEmptySummary)
  .map(([filePath, fileType, summary]) => ({ filePath, fileType, summary }));

// Feature: documentation-persona-repo-scanner, Property 3: CacheStore round-trip
describe('Property 3: CacheStore round-trip', () => {
  // **Validates: Requirements 3.3, 3.4**
  // Adding a record and retrieving by filePath returns identical values
  it('round-trips any valid SummaryRecord through add and getByPath', () => {
    fc.assert(
      fc.property(summaryRecordArb, (record) => {
        const store = new CacheStore();
        store.add(record);
        const retrieved = store.getByPath(record.filePath);
        expect(retrieved).toBeDefined();
        expect(retrieved!.filePath).toBe(record.filePath);
        expect(retrieved!.fileType).toBe(record.fileType);
        expect(retrieved!.summary).toBe(record.summary);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 3.3, 3.4**
  // Adding multiple distinct records and retrieving each returns the correct record
  it('round-trips multiple distinct SummaryRecords', () => {
    fc.assert(
      fc.property(
        fc.array(summaryRecordArb, { minLength: 1, maxLength: 20 }),
        (records) => {
          const store = new CacheStore();
          // Deduplicate by filePath — last one wins (matches overwrite semantics)
          const expected = new Map<string, SummaryRecord>();
          for (const r of records) {
            store.add(r);
            expected.set(r.filePath, r);
          }

          expect(store.size).toBe(expected.size);

          for (const [path, rec] of expected) {
            const retrieved = store.getByPath(path);
            expect(retrieved).toBeDefined();
            expect(retrieved!.filePath).toBe(rec.filePath);
            expect(retrieved!.fileType).toBe(rec.fileType);
            expect(retrieved!.summary).toBe(rec.summary);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 3.3, 3.4**
  // Duplicate filePath additions overwrite the previous record
  it('overwrites previous record when adding duplicate filePath', () => {
    fc.assert(
      fc.property(
        nonEmptyFilePath,
        nonEmptyFileType,
        nonEmptySummary,
        nonEmptyFileType,
        nonEmptySummary,
        (filePath, type1, summary1, type2, summary2) => {
          const store = new CacheStore();
          store.add({ filePath, fileType: type1, summary: summary1 });
          store.add({ filePath, fileType: type2, summary: summary2 });

          expect(store.size).toBe(1);
          const retrieved = store.getByPath(filePath);
          expect(retrieved).toBeDefined();
          expect(retrieved!.fileType).toBe(type2);
          expect(retrieved!.summary).toBe(summary2);
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 3.3, 3.4**
  // getAll returns all added records and they match what was added
  it('getAll returns all stored records with correct values', () => {
    fc.assert(
      fc.property(
        fc.array(summaryRecordArb, { minLength: 1, maxLength: 20 }),
        (records) => {
          const store = new CacheStore();
          const expected = new Map<string, SummaryRecord>();
          for (const r of records) {
            store.add(r);
            expected.set(r.filePath, r);
          }

          const all = store.getAll();
          expect(all.length).toBe(expected.size);

          for (const rec of all) {
            const exp = expected.get(rec.filePath);
            expect(exp).toBeDefined();
            expect(rec.filePath).toBe(exp!.filePath);
            expect(rec.fileType).toBe(exp!.fileType);
            expect(rec.summary).toBe(exp!.summary);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
