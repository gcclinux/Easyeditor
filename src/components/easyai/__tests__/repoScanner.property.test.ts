/**
 * Property-based tests for RepoScanner — repository validation correctness
 * Feature: documentation-persona-repo-scanner, Property 1: Repository validation correctness
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * Property 1: For any combination of dirHandle presence (present/null) and
 * .git directory existence (present/absent), the `scanRepository` validation
 * step shall return success only when both a dirHandle is available AND a
 * `.git` directory exists within it, and shall return an error otherwise.
 */

import * as fc from 'fast-check';
import { scanRepository, ScanOptions } from '../repoScanner';

// Mock detectGitRepoInDirectory from insertSave
jest.mock('../../../insertSave', () => ({
  detectGitRepoInDirectory: jest.fn(),
}));

// Mock queryEasyAI from aiService — not exercised in validation tests
jest.mock('../aiService', () => ({
  queryEasyAI: jest.fn().mockResolvedValue('mock summary'),
}));

import { detectGitRepoInDirectory } from '../../../insertSave';

const mockedDetectGitRepo = detectGitRepoInDirectory as jest.MockedFunction<
  typeof detectGitRepoInDirectory
>;

/** Build a minimal fake FileSystemDirectoryHandle. */
function fakeDirHandle(): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name: 'test-repo',
    getDirectoryHandle: jest.fn(),
    getFileHandle: jest.fn(),
    entries: jest.fn().mockReturnValue([][Symbol.asyncIterator]
      ? [][Symbol.asyncIterator]()
      : (async function* () {})()),
    keys: jest.fn(),
    values: jest.fn(),
    resolve: jest.fn(),
    isSameEntry: jest.fn(),
    queryPermission: jest.fn(),
    requestPermission: jest.fn(),
  } as unknown as FileSystemDirectoryHandle;
}

/** Build ScanOptions with the given dirHandle (may be null). */
function buildOptions(dirHandle: any): ScanOptions {
  return {
    dirHandle,
    userPrompt: 'Generate project overview',
    onProgress: jest.fn(),
    signal: new AbortController().signal,
  };
}

// Feature: documentation-persona-repo-scanner, Property 1: Repository validation correctness
describe('Property 1: Repository validation correctness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * When no dirHandle is provided (null/undefined), scanRepository must
   * throw the "open a Git repository" error regardless of any other state.
   */
  it('throws when dirHandle is absent (null or undefined)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(null, undefined),
        async (dirHandle) => {
          await expect(scanRepository(buildOptions(dirHandle))).rejects.toThrow(
            'Please open a Git repository first via EasyGit.',
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * When a dirHandle is present but .git directory does NOT exist,
   * scanRepository must throw the "not a Git repository" error.
   */
  it('throws when dirHandle is present but .git directory is absent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // arbitrary boolean — just to drive multiple runs
        async () => {
          mockedDetectGitRepo.mockResolvedValue(false);
          const handle = fakeDirHandle();

          await expect(scanRepository(buildOptions(handle))).rejects.toThrow(
            'The opened folder is not a Git repository.',
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.3**
   *
   * When both a dirHandle is present AND .git exists, scanRepository must
   * NOT throw a validation error — it should proceed (resolve successfully).
   */
  it('does not throw when dirHandle is present and .git exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // arbitrary boolean — just to drive multiple runs
        async () => {
          mockedDetectGitRepo.mockResolvedValue(true);
          const handle = fakeDirHandle();

          // Mock entries to return an empty async iterator so the scan completes quickly
          (handle as any).entries = jest
            .fn()
            .mockReturnValue((async function* () {})());

          const result = await scanRepository(buildOptions(handle));
          // Scan should succeed (not throw) and return a valid result
          expect(result).toBeDefined();
          expect(result.cancelled).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * For any random combination of (dirHandle present/null, .git present/absent),
   * validation succeeds if and only if BOTH conditions are true.
   */
  it('succeeds if and only if dirHandle is present AND .git exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // hasDirHandle
        fc.boolean(), // hasGitDir
        async (hasDirHandle, hasGitDir) => {
          const handle = hasDirHandle ? fakeDirHandle() : null;

          if (hasDirHandle) {
            mockedDetectGitRepo.mockResolvedValue(hasGitDir);
            // Provide empty entries so valid scans complete
            (handle as any).entries = jest
              .fn()
              .mockReturnValue((async function* () {})());
          }

          const shouldSucceed = hasDirHandle && hasGitDir;

          if (shouldSucceed) {
            const result = await scanRepository(buildOptions(handle));
            expect(result).toBeDefined();
            expect(result.cancelled).toBe(false);
          } else if (!hasDirHandle) {
            await expect(scanRepository(buildOptions(handle))).rejects.toThrow(
              'Please open a Git repository first via EasyGit.',
            );
          } else {
            // hasDirHandle && !hasGitDir
            await expect(scanRepository(buildOptions(handle))).rejects.toThrow(
              'The opened folder is not a Git repository.',
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: documentation-persona-repo-scanner, Property 4: Per-file prompt includes file content and user request
/**
 * Property 4: Per-file prompt includes file content and user request
 *
 * **Validates: Requirements 3.2, 4.2**
 *
 * For any non-empty file content string and any non-empty user documentation
 * prompt, the constructed per-file AI prompt shall contain both the file
 * content (or its truncated form) and the user's documentation request text.
 */

import { buildPerFilePrompt, truncateContent, detectRequestType } from '../repoScanner';

describe('Property 4: Per-file prompt includes file content and user request', () => {
  // Arbitrary for non-empty strings (at least 1 char)
  const nonEmptyString = fc.string({ minLength: 1 });

  // All valid request types the function accepts
  const requestTypeArb = fc.constantFrom('diagram', 'overview', 'folder', 'default');

  // Arbitrary file paths
  const filePathArb = fc.string({ minLength: 1, maxLength: 50 });

  /**
   * **Validates: Requirements 3.2, 4.2**
   *
   * The user prompt text must always appear in the constructed prompt output
   * so that EasyAI receives the user's documentation request for each file.
   */
  it('user documentation request is present in the per-file prompt', () => {
    fc.assert(
      fc.property(
        filePathArb,
        nonEmptyString,
        nonEmptyString,
        requestTypeArb,
        (filePath: string, content: string, userPrompt: string, requestType: string) => {
          const { userPromptText } = buildPerFilePrompt(
            filePath,
            content,
            userPrompt,
            requestType,
          );

          // The user's documentation request must appear in the prompt
          expect(userPromptText).toContain(userPrompt);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.2, 4.2**
   *
   * The file content (as passed to buildPerFilePrompt) must appear verbatim
   * in the constructed prompt output so that EasyAI can analyse the file.
   */
  it('file content is present in the per-file prompt', () => {
    fc.assert(
      fc.property(
        filePathArb,
        nonEmptyString,
        nonEmptyString,
        requestTypeArb,
        (filePath: string, content: string, userPrompt: string, requestType: string) => {
          const { userPromptText } = buildPerFilePrompt(
            filePath,
            content,
            userPrompt,
            requestType,
          );

          // The file content must appear in the prompt
          expect(userPromptText).toContain(content);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.2, 4.2**
   *
   * When file content is large enough to be truncated, the truncated form
   * (not the original) should appear in the prompt. This verifies the
   * integration between truncateContent and buildPerFilePrompt.
   */
  it('truncated file content is present in the per-file prompt for large files', () => {
    // Generate strings that exceed 50 KB to trigger truncation
    const largeContentArb = fc.string({ minLength: 51201, maxLength: 60000 });

    fc.assert(
      fc.property(
        filePathArb,
        largeContentArb,
        nonEmptyString,
        requestTypeArb,
        (filePath: string, rawContent: string, userPrompt: string, requestType: string) => {
          const truncated = truncateContent(rawContent);
          const { userPromptText } = buildPerFilePrompt(
            filePath,
            truncated,
            userPrompt,
            requestType,
          );

          // The truncated content must appear in the prompt
          expect(userPromptText).toContain(truncated);
          // The user's documentation request must still be present
          expect(userPromptText).toContain(userPrompt);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.2, 4.2**
   *
   * Both file content AND user request must be present simultaneously
   * in the same prompt output for any valid combination of inputs.
   */
  it('both file content and user request are present simultaneously', () => {
    fc.assert(
      fc.property(
        filePathArb,
        nonEmptyString,
        nonEmptyString,
        requestTypeArb,
        (filePath: string, content: string, userPrompt: string, requestType: string) => {
          const { systemPrompt, userPromptText } = buildPerFilePrompt(
            filePath,
            content,
            userPrompt,
            requestType,
          );

          // Both must be present in the combined output
          const combined = systemPrompt + '\n' + userPromptText;
          expect(combined).toContain(content);
          expect(combined).toContain(userPrompt);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: documentation-persona-repo-scanner, Property 5: Documentation request type detection
/**
 * Property 5: Documentation request type detection
 *
 * **Validates: Requirements 4.1**
 *
 * For any user prompt string, the request type classifier shall return
 * "diagram" if the prompt contains diagram-related keywords, "overview" if
 * it contains overview-related keywords, "folder" if it contains
 * folder-related keywords, and "default" otherwise, with no prompt being
 * classified into more than one specific type.
 */
describe('Property 5: Documentation request type detection', () => {
  const VALID_TYPES = ['diagram', 'overview', 'folder', 'default'] as const;

  // Keywords that trigger each type (case-insensitive)
  const diagramKeywords = ['diagram'];
  const overviewKeywords = ['overview', 'architecture'];
  const folderKeywords = ['folder', 'structure'];

  /**
   * **Validates: Requirements 4.1**
   *
   * The classifier always returns one of the four valid types for any input.
   */
  it('always returns a valid request type for any arbitrary string', () => {
    fc.assert(
      fc.property(fc.string(), (prompt: string) => {
        const result = detectRequestType(prompt);
        expect(VALID_TYPES).toContain(result);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 4.1**
   *
   * Prompts containing a diagram keyword (and no higher-priority keyword)
   * are classified as "diagram".
   */
  it('returns "diagram" when the prompt contains a diagram keyword', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...diagramKeywords),
        fc.string(),
        fc.string(),
        (keyword: string, prefix: string, suffix: string) => {
          // Ensure prefix/suffix don't accidentally contain higher-priority keywords
          const safePrefix = prefix.replace(/diagram|overview|architecture|folder|structure/gi, '');
          const safeSuffix = suffix.replace(/diagram|overview|architecture|folder|structure/gi, '');
          const prompt = safePrefix + keyword + safeSuffix;
          expect(detectRequestType(prompt)).toBe('diagram');
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.1**
   *
   * Prompts containing an overview keyword but no diagram keyword
   * are classified as "overview".
   */
  it('returns "overview" when the prompt contains an overview keyword but no diagram keyword', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...overviewKeywords),
        fc.string(),
        fc.string(),
        (keyword: string, prefix: string, suffix: string) => {
          // Strip all trigger keywords, then inject only the overview keyword
          const safePrefix = prefix.replace(/diagram|overview|architecture|folder|structure/gi, '');
          const safeSuffix = suffix.replace(/diagram|overview|architecture|folder|structure/gi, '');
          const prompt = safePrefix + keyword + safeSuffix;
          expect(detectRequestType(prompt)).toBe('overview');
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.1**
   *
   * Prompts containing a folder keyword but no diagram or overview keywords
   * are classified as "folder".
   */
  it('returns "folder" when the prompt contains a folder keyword but no diagram/overview keywords', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...folderKeywords),
        fc.string(),
        fc.string(),
        (keyword: string, prefix: string, suffix: string) => {
          const safePrefix = prefix.replace(/diagram|overview|architecture|folder|structure/gi, '');
          const safeSuffix = suffix.replace(/diagram|overview|architecture|folder|structure/gi, '');
          const prompt = safePrefix + keyword + safeSuffix;
          expect(detectRequestType(prompt)).toBe('folder');
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.1**
   *
   * Prompts with no recognised keywords are classified as "default".
   */
  it('returns "default" when the prompt contains no recognised keywords', () => {
    fc.assert(
      fc.property(fc.string(), (prompt: string) => {
        const sanitised = prompt.replace(/diagram|overview|architecture|folder|structure/gi, '');
        expect(detectRequestType(sanitised)).toBe('default');
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 4.1**
   *
   * Classification is case-insensitive: the same keyword in any casing
   * produces the same result.
   */
  it('classification is case-insensitive', () => {
    const allKeywords = [...diagramKeywords, ...overviewKeywords, ...folderKeywords];

    fc.assert(
      fc.property(
        fc.constantFrom(...allKeywords),
        (keyword: string) => {
          const lower = detectRequestType(keyword.toLowerCase());
          const upper = detectRequestType(keyword.toUpperCase());
          const mixed = detectRequestType(
            keyword.split('').map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase())).join(''),
          );
          expect(lower).toBe(upper);
          expect(lower).toBe(mixed);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.1**
   *
   * Priority: "diagram" beats "overview" beats "folder". When multiple
   * keywords are present, the highest-priority type wins.
   */
  it('respects priority: diagram > overview > folder', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...overviewKeywords),
        fc.constantFrom(...folderKeywords),
        (overviewKw: string, folderKw: string) => {
          // diagram + overview → diagram
          expect(detectRequestType(`diagram ${overviewKw}`)).toBe('diagram');
          // diagram + folder → diagram
          expect(detectRequestType(`diagram ${folderKw}`)).toBe('diagram');
          // overview + folder → overview
          expect(detectRequestType(`${overviewKw} ${folderKw}`)).toBe('overview');
          // all three → diagram
          expect(detectRequestType(`diagram ${overviewKw} ${folderKw}`)).toBe('diagram');
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.1**
   *
   * The classifier is deterministic: calling it twice with the same input
   * always produces the same output.
   */
  it('is deterministic — same input always yields same output', () => {
    fc.assert(
      fc.property(fc.string(), (prompt: string) => {
        const first = detectRequestType(prompt);
        const second = detectRequestType(prompt);
        expect(first).toBe(second);
      }),
      { numRuns: 200 },
    );
  });
});

// Feature: documentation-persona-repo-scanner, Property 6: Scan resilience to per-file errors
/**
 * Property 6: Scan resilience to per-file errors
 *
 * **Validates: Requirements 3.6**
 *
 * For any set of files where a subset produces AI errors, the scanner shall
 * continue processing all remaining files, and the final CacheStore shall
 * contain SummaryRecords for exactly the files that did not produce errors
 * (excluding empty and binary files).
 */

import { queryEasyAI } from '../aiService';
import { GitignoreFilter } from '../gitignoreFilter';

const mockedQueryEasyAI = queryEasyAI as jest.MockedFunction<typeof queryEasyAI>;

// Spy on GitignoreFilter.fromDirHandle so we can control the filter
jest.spyOn(GitignoreFilter, 'fromDirHandle');
const mockedFromDirHandle = GitignoreFilter.fromDirHandle as jest.MockedFunction<
  typeof GitignoreFilter.fromDirHandle
>;

/**
 * Build a mock FileSystemDirectoryHandle that exposes a flat set of files.
 * Each file has non-empty text content.
 */
function buildFlatDirHandle(fileNames: string[]): FileSystemDirectoryHandle {
  const fileHandles = new Map<string, any>();

  for (const name of fileNames) {
    fileHandles.set(name, {
      kind: 'file',
      name,
      getFile: jest.fn().mockResolvedValue({
        text: jest.fn().mockResolvedValue(`// content of ${name}`),
        size: 20,
      }),
    });
  }

  const entries = async function* () {
    for (const [name, handle] of fileHandles) {
      yield [name, handle] as [string, FileSystemFileHandle];
    }
  };

  return {
    kind: 'directory',
    name: 'test-repo',
    entries: jest.fn().mockImplementation(() => entries()),
    getFileHandle: jest.fn().mockImplementation((name: string) => {
      const h = fileHandles.get(name);
      if (!h) throw new Error(`File not found: ${name}`);
      return Promise.resolve(h);
    }),
    getDirectoryHandle: jest.fn().mockRejectedValue(new Error('No subdirs')),
    keys: jest.fn(),
    values: jest.fn(),
    resolve: jest.fn(),
    isSameEntry: jest.fn(),
    queryPermission: jest.fn(),
    requestPermission: jest.fn(),
  } as unknown as FileSystemDirectoryHandle;
}

describe('Property 6: Scan resilience to per-file errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 3.6**
   *
   * For any partition of files into success/error sets, the cache contains
   * SummaryRecords for exactly the successful files plus __directory_tree__.
   */
  it('cache contains exactly the non-erroring files plus __directory_tree__', async () => {
    // Arbitrary: generate 1–8 unique file names with .ts extension (avoids binary filtering)
    const fileNamesArb = fc
      .uniqueArray(
        fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/),
        { minLength: 1, maxLength: 8 },
      )
      .map((names) => names.map((n) => `${n}.ts`));

    // For each set of files, generate a boolean mask indicating which files error
    const testCaseArb = fileNamesArb.chain((files) =>
      fc.tuple(
        fc.constant(files),
        fc.array(fc.boolean(), { minLength: files.length, maxLength: files.length }),
      ),
    );

    await fc.assert(
      fc.asyncProperty(testCaseArb, async ([fileNames, errorMask]) => {
        // Partition files
        const errorFiles = new Set<string>();
        const successFiles: string[] = [];
        fileNames.forEach((name, i) => {
          if (errorMask[i]) {
            errorFiles.add(name);
          } else {
            successFiles.push(name);
          }
        });

        // Setup mocks
        mockedDetectGitRepo.mockResolvedValue(true);

        // Return a permissive filter that ignores nothing
        mockedFromDirHandle.mockResolvedValue(new GitignoreFilter([]));

        // queryEasyAI: throw for error files, return summary for success files.
        // Match on the exact "File path: <name>\n" line to avoid substring collisions.
        mockedQueryEasyAI.mockImplementation(
          async (_sys: string, userPrompt: string) => {
            for (const errFile of errorFiles) {
              if (userPrompt.startsWith(`File path: ${errFile}\n`)) {
                throw new Error(`AI error for ${errFile}`);
              }
            }
            return 'summary';
          },
        );

        const handle = buildFlatDirHandle(fileNames);
        const options = buildOptions(handle);

        const result = await scanRepository(options);

        // Should not be cancelled
        expect(result.cancelled).toBe(false);

        // Cache should contain __directory_tree__ + one record per successful file
        const allRecords = result.cache.getAll();
        const recordPaths = allRecords.map((r) => r.filePath);

        // __directory_tree__ is always present
        expect(recordPaths).toContain('__directory_tree__');

        // Every successful file should be in the cache
        for (const f of successFiles) {
          expect(recordPaths).toContain(f);
        }

        // No erroring file should be in the cache
        for (const f of errorFiles) {
          expect(recordPaths).not.toContain(f);
        }

        // Total count: __directory_tree__ + successful files
        expect(result.cache.size).toBe(1 + successFiles.length);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: documentation-persona-repo-scanner, Property 9: Cancellation clears all cached state
/**
 * Property 9: Cancellation clears all cached state
 *
 * **Validates: Requirements 6.3**
 *
 * For any in-progress scan that is cancelled via AbortSignal, the CacheStore
 * shall be empty after cancellation completes, and the scan result shall
 * indicate `cancelled: true`.
 */
describe('Property 9: Cancellation clears all cached state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 6.3**
   *
   * For any set of files and any abort point N (0 ≤ N < totalFiles),
   * aborting the signal after N files have been processed causes the
   * scanner to return cancelled: true with an empty cache (size === 0).
   */
  it('aborting at any point yields cancelled: true and empty cache', async () => {
    // Generate 2–8 unique file names with .ts extension
    const fileNamesArb = fc
      .uniqueArray(
        fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/),
        { minLength: 2, maxLength: 8 },
      )
      .map((names) => names.map((n) => `${n}.ts`));

    // Pair file names with a random abort-after count in [0, length-2].
    // The signal is aborted after processing abortAfterN files inside
    // queryEasyAI. The scanner checks signal.aborted at the TOP of the
    // next iteration, so we need at least one more file remaining after
    // the abort point for the check to trigger.
    const testCaseArb = fileNamesArb.chain((files) =>
      fc.tuple(
        fc.constant(files),
        fc.integer({ min: 0, max: Math.max(0, files.length - 2) }),
      ),
    );

    await fc.assert(
      fc.asyncProperty(testCaseArb, async ([fileNames, abortAfterN]) => {
        // Setup mocks
        mockedDetectGitRepo.mockResolvedValue(true);
        mockedFromDirHandle.mockResolvedValue(new GitignoreFilter([]));

        const controller = new AbortController();
        let filesProcessed = 0;

        // queryEasyAI: count processed files and abort the signal after N files
        mockedQueryEasyAI.mockImplementation(async () => {
          filesProcessed++;
          if (filesProcessed > abortAfterN) {
            controller.abort();
          }
          return 'summary';
        });

        const handle = buildFlatDirHandle(fileNames);
        const options: ScanOptions = {
          dirHandle: handle,
          userPrompt: 'Generate project overview',
          onProgress: jest.fn(),
          signal: controller.signal,
        };

        const result = await scanRepository(options);

        // The scan must report cancellation
        expect(result.cancelled).toBe(true);
        // The cache must be empty after cancellation
        expect(result.cache.size).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: documentation-persona-repo-scanner, Property 10: Large file truncation
/**
 * Property 10: Large file truncation
 *
 * **Validates: Requirements 7.1, 7.2**
 *
 * For any file content string exceeding 50 KB, the truncated output shall
 * contain exactly the first 50 KB of the original content followed by a
 * truncation note, and the total length shall be the 50 KB prefix plus the
 * note length. For any file content of 50 KB or less, the content shall be
 * passed through unchanged.
 */
describe('Property 10: Large file truncation', () => {
  const MAX_FILE_SIZE = 50 * 1024; // 51200
  const TRUNCATION_NOTE = '\n\n[Content truncated — file exceeds 50 KB]';

  /**
   * **Validates: Requirements 7.1, 7.2**
   *
   * For any string of length <= 51200, truncateContent returns it unchanged.
   */
  it('passes through content unchanged when length <= MAX_FILE_SIZE', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: MAX_FILE_SIZE }),
        (content: string) => {
          const result = truncateContent(content);
          expect(result).toBe(content);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.1, 7.2**
   *
   * For any string of length > 51200, truncateContent returns exactly the
   * first 51200 chars followed by the truncation note.
   */
  it('truncates content to first MAX_FILE_SIZE chars + truncation note when length > MAX_FILE_SIZE', () => {
    // Generate strings that are strictly longer than MAX_FILE_SIZE
    const largeStringArb = fc.string({ minLength: MAX_FILE_SIZE + 1, maxLength: MAX_FILE_SIZE + 5000 });

    fc.assert(
      fc.property(largeStringArb, (content: string) => {
        const result = truncateContent(content);
        const expectedPrefix = content.slice(0, MAX_FILE_SIZE);

        // Result must start with the first MAX_FILE_SIZE chars
        expect(result.slice(0, MAX_FILE_SIZE)).toBe(expectedPrefix);
        // Result must end with the truncation note
        expect(result.slice(MAX_FILE_SIZE)).toBe(TRUNCATION_NOTE);
        // Full result must equal prefix + note
        expect(result).toBe(expectedPrefix + TRUNCATION_NOTE);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.1, 7.2**
   *
   * The total length of truncated output equals MAX_FILE_SIZE + truncation
   * note length for any input exceeding MAX_FILE_SIZE.
   */
  it('truncated output length equals MAX_FILE_SIZE + truncation note length', () => {
    const largeStringArb = fc.string({ minLength: MAX_FILE_SIZE + 1, maxLength: MAX_FILE_SIZE + 5000 });

    fc.assert(
      fc.property(largeStringArb, (content: string) => {
        const result = truncateContent(content);
        expect(result.length).toBe(MAX_FILE_SIZE + TRUNCATION_NOTE.length);
      }),
      { numRuns: 100 },
    );
  });
});
