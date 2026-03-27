/**
 * Unit tests for DocumentationGenerator
 *
 * **Validates: Requirements 5.1, 5.2, 5.5, 8.3**
 *
 * Tests cover:
 * - Aggregation with cache content below, at, and above the threshold
 * - Batch splitting produces correct number of batches
 * - Directory tree is included for structural prompts and may be omitted otherwise
 * - generateDocumentation integration with queryEasyAI mock
 */

import { CacheStore, SummaryRecord } from '../cacheStore';
import {
  buildAggregatedPrompt,
  splitIntoBatches,
  generateDocumentation,
  BATCH_THRESHOLD,
} from '../docGenerator';

// Mock queryEasyAI so we never hit a real AI backend
jest.mock('../aiService', () => ({
  queryEasyAI: jest.fn(),
}));

import { queryEasyAI } from '../aiService';

const mockedQueryEasyAI = queryEasyAI as jest.MockedFunction<typeof queryEasyAI>;

// ── Helpers ──────────────────────────────────────────────────────────

/** Create a SummaryRecord with a summary of a given length. */
function makeRecord(filePath: string, summaryLength: number): SummaryRecord {
  return {
    filePath,
    fileType: 'typescript',
    summary: 'x'.repeat(summaryLength),
  };
}

function makeAbortSignal(): AbortSignal {
  return new AbortController().signal;
}

// ── buildAggregatedPrompt ────────────────────────────────────────────

describe('buildAggregatedPrompt', () => {
  // Requirement 5.1, 5.2
  it('includes every record summary and the user prompt', () => {
    const records: SummaryRecord[] = [
      { filePath: 'src/a.ts', fileType: 'typescript', summary: 'Module A handles auth' },
      { filePath: 'src/b.ts', fileType: 'typescript', summary: 'Module B handles data' },
    ];

    const result = buildAggregatedPrompt(records, 'describe the project');

    expect(result).toContain('Module A handles auth');
    expect(result).toContain('Module B handles data');
    expect(result).toContain('describe the project');
  });

  it('includes file path and file type labels for each record', () => {
    const records: SummaryRecord[] = [
      { filePath: 'src/utils.ts', fileType: 'typescript', summary: 'Utility helpers' },
    ];

    const result = buildAggregatedPrompt(records, 'docs');

    expect(result).toContain('src/utils.ts');
    expect(result).toContain('typescript');
  });

  it('returns prompt with just the user request when records are empty', () => {
    const result = buildAggregatedPrompt([], 'generate docs');

    expect(result).toContain('generate docs');
  });

  // Requirement 8.3 — structural prompts include directory tree
  it('includes __directory_tree__ summary for overview prompts', () => {
    const records: SummaryRecord[] = [
      { filePath: '__directory_tree__', fileType: 'tree', summary: 'src/\n  index.ts\n  utils.ts' },
      { filePath: 'src/index.ts', fileType: 'typescript', summary: 'Entry point' },
    ];

    const result = buildAggregatedPrompt(records, 'project overview');

    expect(result).toContain('src/\n  index.ts\n  utils.ts');
    expect(result).toContain('Directory Tree');
  });

  it('includes __directory_tree__ summary for folder/structure prompts', () => {
    const records: SummaryRecord[] = [
      { filePath: '__directory_tree__', fileType: 'tree', summary: 'root-tree-content' },
      { filePath: 'a.ts', fileType: 'typescript', summary: 'File A' },
    ];

    const result = buildAggregatedPrompt(records, 'describe folder contents');

    expect(result).toContain('root-tree-content');
  });

  it('includes __directory_tree__ summary for non-structural prompts too', () => {
    const records: SummaryRecord[] = [
      { filePath: '__directory_tree__', fileType: 'tree', summary: 'UNIQUE_TREE_MARKER' },
      { filePath: 'a.ts', fileType: 'typescript', summary: 'File A' },
    ];

    const result = buildAggregatedPrompt(records, 'explain the code');

    expect(result).toContain('UNIQUE_TREE_MARKER');
  });

  it('includes __directory_tree__ for diagram prompts', () => {
    const records: SummaryRecord[] = [
      { filePath: '__directory_tree__', fileType: 'tree', summary: 'TREE_CONTENT_HERE' },
      { filePath: 'a.ts', fileType: 'typescript', summary: 'File A' },
    ];

    const result = buildAggregatedPrompt(records, 'create a diagram');

    expect(result).toContain('TREE_CONTENT_HERE');
  });
});

// ── splitIntoBatches ─────────────────────────────────────────────────

describe('splitIntoBatches', () => {
  // Requirement 5.5
  it('returns a single batch when total summary size is below threshold', () => {
    const records = [
      makeRecord('a.ts', 100),
      makeRecord('b.ts', 100),
    ];

    const batches = splitIntoBatches(records);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
  });

  it('returns a single batch when total summary size equals threshold exactly', () => {
    // Two records whose summaries sum to exactly BATCH_THRESHOLD
    const half = BATCH_THRESHOLD / 2;
    const records = [
      makeRecord('a.ts', half),
      makeRecord('b.ts', half),
    ];

    const batches = splitIntoBatches(records);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
  });

  it('splits into multiple batches when total summary size exceeds threshold', () => {
    // Each record is just over half the threshold, so two won't fit in one batch
    const size = Math.ceil(BATCH_THRESHOLD * 0.6);
    const records = [
      makeRecord('a.ts', size),
      makeRecord('b.ts', size),
      makeRecord('c.ts', size),
    ];

    const batches = splitIntoBatches(records);

    expect(batches.length).toBeGreaterThan(1);
    // All records are accounted for
    const total = batches.reduce((sum, b) => sum + b.length, 0);
    expect(total).toBe(3);
  });

  it('places a single oversized record alone in its own batch', () => {
    const records = [
      makeRecord('small.ts', 100),
      makeRecord('huge.ts', BATCH_THRESHOLD + 1000),
      makeRecord('small2.ts', 100),
    ];

    const batches = splitIntoBatches(records);

    // The huge record should be in its own batch
    const hugeBatch = batches.find(b => b.some(r => r.filePath === 'huge.ts'));
    expect(hugeBatch).toBeDefined();
    expect(hugeBatch!).toHaveLength(1);
  });

  it('preserves record order across batches', () => {
    const size = Math.ceil(BATCH_THRESHOLD * 0.6);
    const records = [
      makeRecord('first.ts', size),
      makeRecord('second.ts', size),
      makeRecord('third.ts', size),
    ];

    const batches = splitIntoBatches(records);
    const flatPaths = batches.flat().map(r => r.filePath);

    expect(flatPaths).toEqual(['first.ts', 'second.ts', 'third.ts']);
  });

  it('returns empty array for empty input', () => {
    expect(splitIntoBatches([])).toEqual([]);
  });

  it('handles many small records fitting in one batch', () => {
    // 100 records of 10 chars each = 1000 chars, well under threshold
    const records = Array.from({ length: 100 }, (_, i) =>
      makeRecord(`file${i}.ts`, 10),
    );

    const batches = splitIntoBatches(records);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(100);
  });
});

// ── generateDocumentation ────────────────────────────────────────────

describe('generateDocumentation', () => {
  beforeEach(() => {
    mockedQueryEasyAI.mockReset();
  });

  // Requirement 5.1, 5.2 — single call when below threshold
  it('makes a single AI call when aggregated content is below threshold', async () => {
    const cache = new CacheStore();
    cache.add({ filePath: 'src/a.ts', fileType: 'typescript', summary: 'Short summary' });

    mockedQueryEasyAI.mockResolvedValueOnce('# Final Doc\nGenerated documentation.');

    const result = await generateDocumentation({
      cache,
      userPrompt: 'explain the code',
      signal: makeAbortSignal(),
    });

    expect(result).toBe('# Final Doc\nGenerated documentation.');
    expect(mockedQueryEasyAI).toHaveBeenCalledTimes(1);
  });

  // Requirement 5.5 — batching when above threshold
  it('makes batch calls plus a synthesis call when content exceeds threshold', async () => {
    const cache = new CacheStore();
    // Create records whose summaries exceed the threshold
    const bigSummary = 'x'.repeat(Math.ceil(BATCH_THRESHOLD * 0.7));
    cache.add({ filePath: 'src/a.ts', fileType: 'typescript', summary: bigSummary });
    cache.add({ filePath: 'src/b.ts', fileType: 'typescript', summary: bigSummary });

    // First call = batch 1 partial, second = batch 2 partial, third = synthesis
    mockedQueryEasyAI
      .mockResolvedValueOnce('Partial doc 1')
      .mockResolvedValueOnce('Partial doc 2')
      .mockResolvedValueOnce('# Merged Final Doc');

    const result = await generateDocumentation({
      cache,
      userPrompt: 'explain the code',
      signal: makeAbortSignal(),
    });

    expect(result).toBe('# Merged Final Doc');
    // At least 2 batch calls + 1 synthesis call
    expect(mockedQueryEasyAI.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('returns empty string when signal is already aborted', async () => {
    const cache = new CacheStore();
    cache.add({ filePath: 'a.ts', fileType: 'ts', summary: 'Summary' });

    const controller = new AbortController();
    controller.abort();

    const result = await generateDocumentation({
      cache,
      userPrompt: 'docs',
      signal: controller.signal,
    });

    expect(result).toBe('');
    expect(mockedQueryEasyAI).not.toHaveBeenCalled();
  });

  // Requirement 8.3 — directory tree in synthesis prompt for structural requests
  it('includes directory tree in synthesis prompt for overview requests', async () => {
    const cache = new CacheStore();
    cache.add({ filePath: '__directory_tree__', fileType: 'tree', summary: 'src/\n  index.ts' });
    const bigSummary = 'y'.repeat(Math.ceil(BATCH_THRESHOLD * 0.7));
    cache.add({ filePath: 'src/index.ts', fileType: 'typescript', summary: bigSummary });
    cache.add({ filePath: 'src/utils.ts', fileType: 'typescript', summary: bigSummary });

    mockedQueryEasyAI
      .mockResolvedValueOnce('Partial 1')
      .mockResolvedValueOnce('Partial 2')
      .mockResolvedValueOnce('Final with tree');

    await generateDocumentation({
      cache,
      userPrompt: 'project overview',
      signal: makeAbortSignal(),
    });

    // The final synthesis call (last call) should include the tree
    const lastCall = mockedQueryEasyAI.mock.calls[mockedQueryEasyAI.mock.calls.length - 1];
    const synthesisUserPrompt = lastCall[1];
    expect(synthesisUserPrompt).toContain('src/\n  index.ts');
    expect(synthesisUserPrompt).toContain('Directory Tree');
  });

  it('handles empty cache gracefully', async () => {
    const cache = new CacheStore();

    mockedQueryEasyAI.mockResolvedValueOnce('Empty project doc');

    const result = await generateDocumentation({
      cache,
      userPrompt: 'describe the project',
      signal: makeAbortSignal(),
    });

    expect(result).toBe('Empty project doc');
    expect(mockedQueryEasyAI).toHaveBeenCalledTimes(1);
  });
});
