/**
 * Property-based tests for DocumentationGenerator — aggregated prompt completeness
 * Feature: documentation-persona-repo-scanner, Property 7: Aggregated prompt completeness
 *
 * **Validates: Requirements 5.1, 5.2**
 *
 * For any CacheStore containing N SummaryRecords and any user prompt, the
 * aggregated prompt sent to the DocumentationGenerator shall contain the
 * summary text from every SummaryRecord in the cache and the user's original
 * documentation request.
 */

import * as fc from 'fast-check';
import { buildAggregatedPrompt } from '../docGenerator';
import { SummaryRecord } from '../cacheStore';

// Feature: documentation-persona-repo-scanner, Property 7: Aggregated prompt completeness

/**
 * Arbitrary for a single non-tree SummaryRecord with non-empty fields.
 * File paths avoid gitignore-triggering names and use safe extensions.
 */
const summaryRecordArb: fc.Arbitrary<SummaryRecord> = fc.record({
  filePath: fc
    .stringMatching(/^[a-z][a-z0-9]{0,7}$/)
    .map((name) => `src/${name}.ts`),
  fileType: fc.constantFrom('typescript', 'javascript', 'json', 'markdown', 'css'),
  summary: fc.string({ minLength: 1, maxLength: 200 }),
});

/**
 * Arbitrary for a list of unique non-tree SummaryRecords (1–10 records).
 */
const summaryRecordsArb: fc.Arbitrary<SummaryRecord[]> = fc
  .uniqueArray(summaryRecordArb, {
    minLength: 1,
    maxLength: 10,
    comparator: (a, b) => a.filePath === b.filePath,
  });

/**
 * Arbitrary for a user prompt that does NOT contain keywords that would
 * trigger special request types. This avoids interference from
 * detectRequestType filtering the __directory_tree__ record.
 */
const safeUserPromptArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 100 })
  .map((s) => s.replace(/diagram|overview|architecture|folder|structure/gi, 'docs'));

describe('Property 7: Aggregated prompt completeness', () => {
  /**
   * **Validates: Requirements 5.1, 5.2**
   *
   * For any set of non-tree SummaryRecords and any user prompt, the
   * aggregated prompt contains every record's summary text.
   */
  it('aggregated prompt contains every record summary text', () => {
    fc.assert(
      fc.property(
        summaryRecordsArb,
        safeUserPromptArb,
        (records: SummaryRecord[], userPrompt: string) => {
          const result = buildAggregatedPrompt(records, userPrompt);

          for (const record of records) {
            expect(result).toContain(record.summary);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 5.1, 5.2**
   *
   * For any user prompt, the aggregated prompt contains the user's
   * original documentation request text.
   */
  it('aggregated prompt contains the user original documentation request', () => {
    fc.assert(
      fc.property(
        summaryRecordsArb,
        safeUserPromptArb,
        (records: SummaryRecord[], userPrompt: string) => {
          const result = buildAggregatedPrompt(records, userPrompt);

          expect(result).toContain(userPrompt);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 5.1, 5.2**
   *
   * Both every record's summary AND the user's original request are
   * present simultaneously in the aggregated prompt.
   */
  it('both all summaries and user request are present simultaneously', () => {
    fc.assert(
      fc.property(
        summaryRecordsArb,
        safeUserPromptArb,
        (records: SummaryRecord[], userPrompt: string) => {
          const result = buildAggregatedPrompt(records, userPrompt);

          // User prompt is present
          expect(result).toContain(userPrompt);

          // Every record summary is present
          for (const record of records) {
            expect(result).toContain(record.summary);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// Feature: documentation-persona-repo-scanner, Property 8: Batch splitting preserves all summaries

/**
 * Property-based tests for DocumentationGenerator — batch splitting preserves all summaries
 * Feature: documentation-persona-repo-scanner, Property 8: Batch splitting preserves all summaries
 *
 * **Validates: Requirements 5.5**
 *
 * For any CacheStore whose total summary text exceeds the configured context
 * threshold, the DocumentationGenerator shall split the summaries into batches
 * such that every SummaryRecord appears in exactly one batch, and no single
 * batch exceeds the threshold.
 */

import { splitIntoBatches, BATCH_THRESHOLD } from '../docGenerator';

/**
 * Arbitrary for a list of SummaryRecords with unique, index-based file paths (1–20 records).
 * Summary lengths vary to exercise both within-threshold and over-threshold batching.
 */
const batchRecordsArb: fc.Arbitrary<SummaryRecord[]> = fc
  .array(
    fc.record({
      fileType: fc.constantFrom('typescript', 'javascript', 'json', 'markdown'),
      summary: fc.string({ minLength: 1, maxLength: 2000 }),
    }),
    { minLength: 1, maxLength: 20 },
  )
  .map((items) =>
    items.map((item, idx) => ({
      filePath: `src/file_${idx}.ts`,
      fileType: item.fileType,
      summary: item.summary,
    })),
  );

describe('Property 8: Batch splitting preserves all summaries', () => {
  /**
   * **Validates: Requirements 5.5**
   *
   * Every SummaryRecord appears in exactly one batch — the total number
   * of records across all batches equals the input record count.
   */
  it('every SummaryRecord appears in exactly one batch (total records equals input)', () => {
    fc.assert(
      fc.property(batchRecordsArb, (records: SummaryRecord[]) => {
        const batches = splitIntoBatches(records);

        // Flatten all batches and count total records
        const allBatchedRecords = batches.flat();
        expect(allBatchedRecords).toHaveLength(records.length);

        // Every input record appears exactly once
        const batchedPaths = allBatchedRecords.map((r) => r.filePath);
        const inputPaths = records.map((r) => r.filePath);
        expect(batchedPaths.sort()).toEqual(inputPaths.sort());
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 5.5**
   *
   * No single batch's combined summary text exceeds BATCH_THRESHOLD,
   * except when a single record's summary alone exceeds it — that
   * record gets its own batch.
   */
  it('no batch exceeds BATCH_THRESHOLD unless it contains a single oversized record', () => {
    fc.assert(
      fc.property(batchRecordsArb, (records: SummaryRecord[]) => {
        const batches = splitIntoBatches(records);

        for (const batch of batches) {
          const totalSize = batch.reduce((sum, r) => sum + r.summary.length, 0);

          if (batch.length === 1) {
            // A single-record batch is always valid (oversized records
            // are isolated into their own batch)
            expect(batch.length).toBe(1);
          } else {
            // Multi-record batches must not exceed the threshold
            expect(totalSize).toBeLessThanOrEqual(BATCH_THRESHOLD);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 5.5**
   *
   * The order of records is preserved across batches — concatenating
   * all batches in order yields the original input order.
   */
  it('order of records is preserved across batches', () => {
    fc.assert(
      fc.property(batchRecordsArb, (records: SummaryRecord[]) => {
        const batches = splitIntoBatches(records);

        const allBatchedRecords = batches.flat();
        const batchedPaths = allBatchedRecords.map((r) => r.filePath);
        const inputPaths = records.map((r) => r.filePath);

        // Order must be preserved (not just set equality)
        expect(batchedPaths).toEqual(inputPaths);
      }),
      { numRuns: 100 },
    );
  });
});


// Feature: documentation-persona-repo-scanner, Property 11: Directory tree inclusion for structural requests

/**
 * Property-based tests for DocumentationGenerator — directory tree inclusion for structural requests
 * Feature: documentation-persona-repo-scanner, Property 11: Directory tree inclusion for structural requests
 *
 * **Validates: Requirements 8.3**
 *
 * For any user prompt that implies structural documentation (containing keywords
 * like "overview", "architecture", "folder", "structure"), the final aggregated
 * prompt shall include the `__directory_tree__` SummaryRecord content. For prompts
 * that do not imply structural documentation, the tree may be omitted.
 */

/**
 * Arbitrary for a __directory_tree__ SummaryRecord with a unique tree summary.
 * The summary is prefixed with a distinctive marker so it cannot accidentally
 * appear as a substring of other prompt parts (user prompt, file summaries, etc.).
 */
const treeRecordArb: fc.Arbitrary<SummaryRecord> = fc
  .stringMatching(/^[a-z][a-z0-9]{4,29}$/)
  .map((treeSummary) => ({
    filePath: '__directory_tree__',
    fileType: 'tree',
    summary: `TREE_MARKER_${treeSummary}`,
  }));

/**
 * Arbitrary for a small set of non-tree SummaryRecords (0–5 records).
 */
const nonTreeRecordsArb: fc.Arbitrary<SummaryRecord[]> = fc
  .uniqueArray(
    fc.record({
      filePath: fc
        .stringMatching(/^[a-z][a-z0-9]{0,5}$/)
        .map((name) => `src/${name}.ts`),
      fileType: fc.constantFrom('typescript', 'javascript', 'json'),
      summary: fc.string({ minLength: 1, maxLength: 100 }),
    }),
    { minLength: 0, maxLength: 5, comparator: (a, b) => a.filePath === b.filePath },
  );

/**
 * Arbitrary for a structural keyword that triggers tree inclusion.
 * detectRequestType returns "overview" for "overview"/"architecture",
 * and "folder" for "folder"/"structure".
 */
const structuralKeywordArb: fc.Arbitrary<string> = fc.constantFrom(
  'overview',
  'architecture',
  'folder',
  'structure',
);

/**
 * Arbitrary for a user prompt containing a structural keyword.
 * Wraps the keyword in surrounding safe text.
 */
const structuralPromptArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.string({ minLength: 0, maxLength: 30 }).map((s) => s.replace(/diagram|overview|architecture|folder|structure/gi, 'docs')),
    structuralKeywordArb,
    fc.string({ minLength: 0, maxLength: 30 }).map((s) => s.replace(/diagram|overview|architecture|folder|structure/gi, 'docs')),
  )
  .map(([prefix, keyword, suffix]) => `${prefix} ${keyword} ${suffix}`.trim());

/**
 * Arbitrary for a user prompt that does NOT contain any structural or diagram keywords.
 * This ensures detectRequestType returns "default".
 */
const nonStructuralPromptArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 100 })
  .map((s) => s.replace(/diagram|overview|architecture|folder|structure/gi, 'docs'));

describe('Property 11: Directory tree inclusion for structural requests', () => {
  /**
   * **Validates: Requirements 8.3**
   *
   * The directory tree is always included in the aggregated prompt
   * regardless of request type, so the AI always has project context.
   */
  it('always includes the __directory_tree__ summary in the aggregated prompt', () => {
    fc.assert(
      fc.property(
        treeRecordArb,
        nonTreeRecordsArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        (treeRecord: SummaryRecord, fileRecords: SummaryRecord[], userPrompt: string) => {
          const allRecords = [treeRecord, ...fileRecords];
          const result = buildAggregatedPrompt(allRecords, userPrompt);

          expect(result).toContain(treeRecord.summary);
        },
      ),
      { numRuns: 100 },
    );
  });
});
