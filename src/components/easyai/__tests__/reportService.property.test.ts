/**
 * Property-based tests for reportService
 * Feature: ai-content-report, Property 2: Description field character limit
 *
 * **Validates: Requirements 2.3**
 *
 * Property 2: For any string input to the description field, the resulting
 * `description` value in a submitted `ReportEntry` SHALL have a length of
 * at most 500 characters.
 */

import * as fc from 'fast-check';
import { submitReport, getReports, REPORT_CATEGORIES, ReportEntry } from '../reportService';

const STORAGE_KEY = 'easyeditor-ai-reports';

/** Generate a random valid category from the predefined list. */
const categoryArb = fc.constantFrom(...REPORT_CATEGORIES);

/** Generate a random string of length 0–1000 for the description field. */
const descriptionArb = fc.string({ minLength: 0, maxLength: 1000 });

/** Generate a random ISO timestamp from a safe integer range. */
const timestampArb = fc.integer({ min: 946684800000, max: 4102444799999 }).map((ms) => new Date(ms).toISOString());

/** Generate a random AI action or null. */
const aiActionArb = fc.oneof(
  fc.constantFrom('markdown', 'mermaid', 'rewrite', 'plantuml', 'table', 'code', 'userstory'),
  fc.constant(null),
);

// Feature: ai-content-report, Property 2: Description field character limit
describe('Property 2: Description field character limit', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // **Validates: Requirements 2.3**
  // For any random description string of length 0–1000, after submitReport
  // the stored description length must be ≤ 500
  it('stored description length is always ≤ 500 for any input string', () => {
    fc.assert(
      fc.property(
        categoryArb,
        descriptionArb,
        timestampArb,
        aiActionArb,
        (category, description, timestamp, aiAction) => {
          localStorage.clear();

          const entry: ReportEntry = {
            category,
            description,
            timestamp,
            aiAction,
          };

          const result = submitReport(entry);
          expect(result).toBe(true);

          const reports = getReports();
          expect(reports.length).toBe(1);
          expect(reports[0].description.length).toBeLessThanOrEqual(500);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: ai-content-report, Property 3: Report submission round-trip
 *
 * **Validates: Requirements 3.1, 3.2**
 *
 * Property 3: For any valid ReportEntry (with a valid category, description
 * of 0–500 characters, UTC timestamp, and AI action type), submitting the
 * entry via submitReport and then reading from localStorage via getReports
 * SHALL return a list containing an entry equivalent to the one submitted.
 */

// Feature: ai-content-report, Property 3: Report submission round-trip
describe('Property 3: Report submission round-trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  /** Generate a random valid description (0–500 chars). */
  const validDescriptionArb = fc.string({ minLength: 0, maxLength: 500 });

  // **Validates: Requirements 3.1, 3.2**
  // For any valid ReportEntry, submitReport returns true and getReports
  // contains a matching entry.
  it('submitted report is retrievable via getReports with matching fields', () => {
    fc.assert(
      fc.property(
        categoryArb,
        validDescriptionArb,
        timestampArb,
        aiActionArb,
        (category, description, timestamp, aiAction) => {
          localStorage.clear();

          const entry: ReportEntry = {
            category,
            description,
            timestamp,
            aiAction,
          };

          const result = submitReport(entry);
          expect(result).toBe(true);

          const reports = getReports();
          expect(reports.length).toBeGreaterThanOrEqual(1);

          const match = reports.find(
            (r) =>
              r.category === entry.category &&
              r.description === entry.description &&
              r.timestamp === entry.timestamp &&
              r.aiAction === entry.aiAction,
          );
          expect(match).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: ai-content-report, Property 4: Report log max size invariant
 *
 * **Validates: Requirements 3.5, 6.3**
 *
 * Property 4: For any sequence of submitReport calls and for any storage
 * backend (localStorage or the Tauri on-disk JSON file), the number of
 * entries stored SHALL never exceed 100. When a submission would cause the
 * count to exceed 100, the oldest entry SHALL be removed first.
 */

import { persistToFile } from '../reportService';

// Feature: ai-content-report, Property 4: Report log max size invariant
describe('Property 4: Report log max size invariant', () => {
  /** Generate a random valid ReportEntry. */
  const reportEntryArb = fc.record({
    category: categoryArb,
    description: fc.string({ minLength: 0, maxLength: 500 }),
    timestamp: timestampArb,
    aiAction: aiActionArb,
  });

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  // **Validates: Requirements 3.5**
  // For any random sequence of 1–200 submissions, localStorage never exceeds 100 entries.
  it('localStorage never exceeds 100 entries after any number of submissions', () => {
    fc.assert(
      fc.property(
        fc.array(reportEntryArb, { minLength: 1, maxLength: 200 }),
        (entries) => {
          localStorage.clear();

          for (const entry of entries) {
            submitReport(entry);
          }

          const reports = getReports();
          expect(reports.length).toBeLessThanOrEqual(100);
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 3.5, 6.3**
  // When Tauri file persistence is mocked, the file contents also never exceed 100 entries.
  it('Tauri file contents never exceed 100 entries after any number of submissions', async () => {
    let writtenData = '';

    // Mock the Tauri modules that persistToFile dynamically imports
    jest.mock('@tauri-apps/plugin-fs', () => ({
      writeTextFile: jest.fn((_path: string, data: string) => {
        writtenData = data;
        return Promise.resolve();
      }),
    }), { virtual: true });

    jest.mock('@tauri-apps/api/path', () => ({
      appDataDir: jest.fn(() => Promise.resolve('/mock/app/data/')),
    }), { virtual: true });

    await fc.assert(
      fc.asyncProperty(
        fc.array(reportEntryArb, { minLength: 1, maxLength: 200 }),
        async (entries) => {
          localStorage.clear();
          writtenData = '';

          for (const entry of entries) {
            submitReport(entry);
          }

          const reports = getReports();
          expect(reports.length).toBeLessThanOrEqual(100);

          // Call persistToFile directly to verify the file cap logic.
          // In production this is fire-and-forget from submitReport,
          // but we invoke it explicitly to inspect the written data.
          await persistToFile(reports);

          expect(writtenData).toBeTruthy();
          const fileReports = JSON.parse(writtenData);
          expect(fileReports.length).toBeLessThanOrEqual(100);
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: ai-content-report, Property 5: File persistence round-trip
 *
 * **Validates: Requirements 6.1, 6.2**
 *
 * Property 5: For any valid ReportEntry, when submitReport is called in a
 * Tauri environment and the file write succeeds, the contents of the on-disk
 * JSON file SHALL contain an entry equivalent to the submitted one, and the
 * file contents SHALL be equivalent to the localStorage contents.
 */

// Feature: ai-content-report, Property 5: File persistence round-trip
describe('Property 5: File persistence round-trip', () => {
  /** Generate a random valid ReportEntry. */
  const reportEntryArb = fc.record({
    category: categoryArb,
    description: fc.string({ minLength: 0, maxLength: 500 }),
    timestamp: timestampArb,
    aiAction: aiActionArb,
  });

  /** Captured data written by the mocked writeTextFile. */
  let capturedFileData = '';

  beforeEach(() => {
    localStorage.clear();
    capturedFileData = '';

    // Reset module registry so dynamic import() in persistToFile picks up fresh mocks
    jest.resetModules();

    jest.doMock('@tauri-apps/plugin-fs', () => ({
      writeTextFile: jest.fn((_path: string, data: string) => {
        capturedFileData = data;
        return Promise.resolve();
      }),
    }), { virtual: true });

    jest.doMock('@tauri-apps/api/path', () => ({
      appDataDir: jest.fn(() => Promise.resolve('/mock/app/data/')),
    }), { virtual: true });
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  // **Validates: Requirements 6.1, 6.2**
  // For any valid ReportEntry, after submitReport + persistToFile, the file
  // JSON contains the submitted entry and matches getReports().
  it('file contents contain the submitted entry and match getReports()', async () => {
    // Re-import after doMock so persistToFile uses the mocked modules
    const { persistToFile: persistToFileMocked } = await import('../reportService');

    await fc.assert(
      fc.asyncProperty(
        reportEntryArb,
        async (entry) => {
          localStorage.clear();
          capturedFileData = '';

          const result = submitReport(entry);
          expect(result).toBe(true);

          const reports = getReports();
          expect(reports.length).toBe(1);

          // Explicitly call persistToFile to capture written data
          await persistToFileMocked(reports);

          expect(capturedFileData).toBeTruthy();
          const fileReports: ReportEntry[] = JSON.parse(capturedFileData);

          // File contents contain the submitted entry
          const match = fileReports.find(
            (r) =>
              r.category === entry.category &&
              r.description === entry.description &&
              r.timestamp === entry.timestamp &&
              r.aiAction === entry.aiAction,
          );
          expect(match).toBeDefined();

          // File contents are equivalent to localStorage contents
          expect(fileReports).toEqual(reports);
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 6.1, 6.2**
  // For any sequence of valid entries, file contents match localStorage after persistence.
  it('file contents match localStorage after multiple submissions', async () => {
    // Re-import after doMock so persistToFile uses the mocked modules
    const { persistToFile: persistToFileMocked } = await import('../reportService');

    await fc.assert(
      fc.asyncProperty(
        fc.array(reportEntryArb, { minLength: 1, maxLength: 50 }),
        async (entries) => {
          localStorage.clear();
          capturedFileData = '';

          for (const entry of entries) {
            submitReport(entry);
          }

          const reports = getReports();
          await persistToFileMocked(reports);

          expect(capturedFileData).toBeTruthy();
          const fileReports: ReportEntry[] = JSON.parse(capturedFileData);

          // File contents match localStorage
          expect(fileReports).toEqual(reports);

          // Every submitted entry (within the 100-cap) is present in the file
          const expectedEntries = entries.slice(-100).map((e) => ({
            ...e,
            description: e.description.slice(0, 500),
          }));
          expect(fileReports).toEqual(expectedEntries);
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: ai-content-report, Property 6: Graceful fallback on file write failure
 *
 * **Validates: Requirements 6.4**
 *
 * Property 6: For any valid ReportEntry, if persistToFile throws or returns
 * false, the entry SHALL still be present in localStorage (i.e., getReports()
 * contains the submitted entry), and submitReport SHALL still return true.
 */

// Feature: ai-content-report, Property 6: Graceful fallback on file write failure
describe('Property 6: Graceful fallback on file write failure', () => {
  /** Generate a random valid ReportEntry. */
  const reportEntryArb = fc.record({
    category: categoryArb,
    description: fc.string({ minLength: 0, maxLength: 500 }),
    timestamp: timestampArb,
    aiAction: aiActionArb,
  });

  beforeEach(() => {
    localStorage.clear();
    jest.resetModules();

    // Mock writeTextFile to always throw an error
    jest.doMock('@tauri-apps/plugin-fs', () => ({
      writeTextFile: jest.fn(() => {
        throw new Error('Simulated file write failure');
      }),
    }), { virtual: true });

    jest.doMock('@tauri-apps/api/path', () => ({
      appDataDir: jest.fn(() => Promise.resolve('/mock/app/data/')),
    }), { virtual: true });
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  // **Validates: Requirements 6.4**
  // For any valid ReportEntry, submitReport returns true and the entry is
  // present in localStorage even when file persistence fails.
  it('submitReport returns true and entry is in localStorage when file write throws', () => {
    fc.assert(
      fc.property(
        reportEntryArb,
        (entry) => {
          localStorage.clear();

          const result = submitReport(entry);
          expect(result).toBe(true);

          const reports = getReports();
          expect(reports.length).toBeGreaterThanOrEqual(1);

          const match = reports.find(
            (r) =>
              r.category === entry.category &&
              r.description === entry.description &&
              r.timestamp === entry.timestamp &&
              r.aiAction === entry.aiAction,
          );
          expect(match).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 6.4**
  // Directly calling persistToFile with a throwing writeTextFile returns false,
  // but the localStorage data remains intact.
  it('persistToFile returns false on write failure but localStorage is unaffected', async () => {
    const { persistToFile: persistToFileFailing } = await import('../reportService');

    await fc.assert(
      fc.asyncProperty(
        reportEntryArb,
        async (entry) => {
          localStorage.clear();

          // First submit the entry to localStorage
          const result = submitReport(entry);
          expect(result).toBe(true);

          const reportsBefore = getReports();
          expect(reportsBefore.length).toBe(1);

          // Now call persistToFile — it should return false due to the mock throwing
          const fileResult = await persistToFileFailing(reportsBefore);
          expect(fileResult).toBe(false);

          // localStorage should still contain the entry
          const reportsAfter = getReports();
          expect(reportsAfter.length).toBe(1);

          const match = reportsAfter.find(
            (r) =>
              r.category === entry.category &&
              r.description === entry.description &&
              r.timestamp === entry.timestamp &&
              r.aiAction === entry.aiAction,
          );
          expect(match).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: ai-content-report, Property 7: Download export content equivalence
 *
 * **Validates: Requirements 6.6**
 *
 * Property 7: For any non-empty set of ReportEntry records in localStorage,
 * the JSON content produced by downloadReportsAsFile (the Blob payload) SHALL
 * be parseable as a ReportEntry[] and SHALL be equivalent to the result of
 * getReports().
 */

import { downloadReportsAsFile } from '../reportService';

// Feature: ai-content-report, Property 7: Download export content equivalence
describe('Property 7: Download export content equivalence', () => {
  /** Generate a random valid ReportEntry. */
  const reportEntryArb = fc.record({
    category: categoryArb,
    description: fc.string({ minLength: 0, maxLength: 500 }),
    timestamp: timestampArb,
    aiAction: aiActionArb,
  });

  let capturedBlobContent: string;
  let OriginalBlob: typeof Blob;

  beforeEach(() => {
    localStorage.clear();
    capturedBlobContent = '';

    // Save original Blob
    OriginalBlob = global.Blob;

    // Mock Blob to capture the JSON string passed to it
    global.Blob = class MockBlob {
      constructor(parts: any[]) {
        capturedBlobContent = parts[0];
      }
    } as any;

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();

    // Mock document.createElement to return a stub <a> element
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: jest.fn(),
        } as unknown as HTMLElement;
      }
      return document.createElement(tag);
    });

    // Mock document.body.appendChild and removeChild
    jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
  });

  afterEach(() => {
    localStorage.clear();
    global.Blob = OriginalBlob;
    jest.restoreAllMocks();
  });

  // **Validates: Requirements 6.6**
  // For any sequence of 1–100 valid ReportEntry objects submitted via submitReport,
  // calling downloadReportsAsFile produces a Blob whose JSON content parses to an
  // array equivalent to getReports().
  it('Blob content from downloadReportsAsFile equals getReports()', () => {
    fc.assert(
      fc.property(
        fc.array(reportEntryArb, { minLength: 1, maxLength: 100 }),
        (entries) => {
          localStorage.clear();
          capturedBlobContent = '';

          // Submit all entries
          for (const entry of entries) {
            submitReport(entry);
          }

          const reportsBeforeDownload = getReports();
          expect(reportsBeforeDownload.length).toBeGreaterThan(0);

          // Trigger the download — Blob mock captures the JSON payload
          downloadReportsAsFile();

          // The captured content must be valid JSON
          expect(capturedBlobContent).toBeTruthy();
          const parsed: ReportEntry[] = JSON.parse(capturedBlobContent);

          // Parsed Blob content must be equivalent to getReports()
          expect(parsed).toEqual(reportsBeforeDownload);
        },
      ),
      { numRuns: 100 },
    );
  });
});
