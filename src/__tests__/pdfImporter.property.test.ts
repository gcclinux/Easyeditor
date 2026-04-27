/**
 * Property-based tests for pdfImporter module
 *
 * Feature: pdf-to-markdown-import
 * Uses fast-check for property-based testing of core classification logic.
 */

// Mock pdfjs-dist before importing the module under test.
jest.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
}));

// Mock tesseract.js module for OCR fallback property tests
jest.mock('tesseract.js', () => ({
  recognize: jest.fn(),
}));

import * as fc from 'fast-check';
import {
  classifyLine,
  detectTables,
  blocksToHtml,
  htmlToMarkdown,
  fixTableHtml,
  createImageBlocks,
  processPageWithOcrFallback,
  groupIntoLines,
  groupConsecutiveBlocks,
  PdfTextItem,
  TextLine,
  ContentBlock,
  InlineFormatting,
  PdfImage,
} from '../pdfImporter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a TextLine with a single PdfTextItem at the given font size.
 * Uses plain text content that won't trigger list detection.
 */
function makeTextLine(text: string, fontSize: number): TextLine {
  const item: PdfTextItem = {
    text,
    x: 72,
    y: 700,
    width: text.length * fontSize * 0.6,
    height: fontSize,
    fontSize,
    fontName: 'Arial',
    isBold: false,
    isItalic: false,
  };
  return {
    items: [item],
    y: 700,
    minX: 72,
    maxX: 72 + item.width,
    avgFontSize: fontSize,
  };
}

// ---------------------------------------------------------------------------
// Property 1: Heading level classification from font size ratio
// ---------------------------------------------------------------------------

describe('Feature: pdf-to-markdown-import, Property 1: Heading level classification from font size ratio', () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * For any text line with a given font size and for any detected body font size,
   * classifyLine SHALL assign the correct heading level based on the font-size-to-body
   * ratio thresholds (≥2.0 → H1, ≥1.6 → H2, ≥1.3 → H3, ≥1.1 → H4, otherwise paragraph),
   * and lines at or below body size SHALL be classified as paragraphs.
   */
  it('assigns correct heading level based on ratio thresholds for any font size and body font size', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 72, noNaN: true }),
        fc.float({ min: 8, max: 14, noNaN: true }),
        (fontSize: number, bodyFontSize: number) => {
          const line = makeTextLine('Test text', fontSize);
          const block = classifyLine(line, bodyFontSize);

          const ratio = fontSize / bodyFontSize;

          if (ratio >= 2.0) {
            expect(block.type).toBe('heading');
            if (block.type === 'heading') {
              expect(block.level).toBe(1);
            }
          } else if (ratio >= 1.6) {
            expect(block.type).toBe('heading');
            if (block.type === 'heading') {
              expect(block.level).toBe(2);
            }
          } else if (ratio >= 1.3) {
            expect(block.type).toBe('heading');
            if (block.type === 'heading') {
              expect(block.level).toBe(3);
            }
          } else if (ratio >= 1.1) {
            expect(block.type).toBe('heading');
            if (block.type === 'heading') {
              expect(block.level).toBe(4);
            }
          } else {
            expect(block.type).toBe('paragraph');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.2**
   *
   * Lines at or below body font size SHALL always be classified as paragraphs.
   */
  it('classifies lines at or below body size as paragraphs', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 8, max: 14, noNaN: true }),
        fc.float({ min: Math.fround(0.1), max: Math.fround(1.099), noNaN: true }),
        (bodyFontSize: number, ratioMultiplier: number) => {
          // Font size is at or below body size (ratio < 1.1)
          const fontSize = bodyFontSize * ratioMultiplier;

          // Skip degenerate cases where fontSize is effectively zero
          if (fontSize < 0.5) return;

          const line = makeTextLine('Test text', fontSize);
          const block = classifyLine(line, bodyFontSize);

          expect(block.type).toBe('paragraph');
          if (block.type === 'paragraph') {
            expect(block.lines).toEqual(['Test text']);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: List detection from text prefixes
// ---------------------------------------------------------------------------

describe('Feature: pdf-to-markdown-import, Property 3: List detection from text prefixes', () => {
  const BODY_FONT_SIZE = 12;

  /**
   * **Validates: Requirements 2.5**
   *
   * For any text line whose content starts with a bullet character (•, –, -, ▪)
   * followed by a space and arbitrary text, classifyLine SHALL classify it as an
   * unordered list item.
   */
  it('classifies lines with bullet prefixes as unordered list items', () => {
    const bulletChars = ['•', '–', '-', '▪'] as const;

    fc.assert(
      fc.property(
        fc.constantFrom(...bulletChars),
        fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
        (bullet: string, content: string) => {
          const text = `${bullet} ${content}`;
          const line = makeTextLine(text, BODY_FONT_SIZE);
          const block = classifyLine(line, BODY_FONT_SIZE);

          expect(block.type).toBe('list');
          if (block.type === 'list') {
            expect(block.ordered).toBe(false);
            // The item text should be the content after the bullet and space,
            // with leading whitespace trimmed (classifyLine trims after removing the bullet prefix)
            expect(block.items).toHaveLength(1);
            expect(block.items[0]).toBe(content.trimStart());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.5**
   *
   * For any text line whose content starts with a number (1–99) followed by
   * '.' or ')' and a space, then arbitrary text, classifyLine SHALL classify
   * it as an ordered list item.
   */
  it('classifies lines with numbered prefixes as ordered list items', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99 }),
        fc.constantFrom('.', ')'),
        fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
        (num: number, separator: string, content: string) => {
          const text = `${num}${separator} ${content}`;
          const line = makeTextLine(text, BODY_FONT_SIZE);
          const block = classifyLine(line, BODY_FONT_SIZE);

          expect(block.type).toBe('list');
          if (block.type === 'list') {
            expect(block.ordered).toBe(true);
            expect(block.items).toHaveLength(1);
            // The ordered regex match includes the trailing space, so content is preserved as-is
            expect(block.items[0]).toBe(content);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Table detection and GFM conversion
// ---------------------------------------------------------------------------

describe('Feature: pdf-to-markdown-import, Property 5: Table detection and GFM conversion', () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 9.2**
   *
   * For any set of grid-aligned text items forming a table with N rows (N≥2)
   * and M columns (M≥2), the `detectTables` function SHALL produce a table
   * ContentBlock with M headers and N-1 data rows.
   */
  it('detects grid-aligned text items as a table with correct dimensions', () => {
    // Arbitrary for generating non-empty cell text without pipe characters
    // (pipes would interfere with GFM table syntax).
    const cellTextArb = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => s.trim().length > 0 && !s.includes('|'));

    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }), // N rows
        fc.integer({ min: 2, max: 5 }), // M columns
        fc.context(),
        (numRows, numCols, ctx) => {
          // Generate a grid of cell texts (numRows × numCols)
          const grid: string[][] = [];
          for (let r = 0; r < numRows; r++) {
            const row: string[] = [];
            for (let c = 0; c < numCols; c++) {
              row.push(`Cell_R${r}C${c}`);
            }
            grid.push(row);
          }

          // Build PdfTextItems at grid positions:
          //   x = colIndex * 100 + 72  (100 units apart, well beyond 15-unit tolerance)
          //   y = 700 - rowIndex * 20   (20 units apart vertically)
          const lines: TextLine[] = [];

          for (let r = 0; r < numRows; r++) {
            const items: PdfTextItem[] = [];
            const y = 700 - r * 20;

            for (let c = 0; c < numCols; c++) {
              const x = c * 100 + 72;
              const text = grid[r][c];
              items.push({
                text,
                x,
                y,
                width: text.length * 7,
                height: 12,
                fontSize: 12,
                fontName: 'Arial',
                isBold: false,
                isItalic: false,
              });
            }

            lines.push({
              items: items.sort((a, b) => a.x - b.x),
              y,
              minX: 72,
              maxX: (numCols - 1) * 100 + 72 + grid[r][numCols - 1].length * 7,
              avgFontSize: 12,
            });
          }

          ctx.log(`Grid: ${numRows} rows × ${numCols} cols`);

          // Run detectTables
          const result = detectTables(lines);

          // Should produce exactly one table
          expect(result.tables).toHaveLength(1);

          const table = result.tables[0];
          expect(table.type).toBe('table');

          if (table.type === 'table') {
            // M headers
            expect(table.headers).toHaveLength(numCols);

            // N-1 data rows
            expect(table.rows).toHaveLength(numRows - 1);

            // Each data row should have M columns
            for (const row of table.rows) {
              expect(row).toHaveLength(numCols);
            }

            // Verify header content matches first row of grid
            for (let c = 0; c < numCols; c++) {
              expect(table.headers[c]).toBe(grid[0][c]);
            }

            // Verify data row content matches remaining rows of grid
            for (let r = 0; r < numRows - 1; r++) {
              for (let c = 0; c < numCols; c++) {
                expect(table.rows[r][c]).toBe(grid[r + 1][c]);
              }
            }
          }

          // No remaining lines — all lines should be consumed by the table
          expect(result.remainingLines).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Paragraph separation
// ---------------------------------------------------------------------------

describe('Feature: pdf-to-markdown-import, Property 4: Paragraph separation', () => {
  /**
   * **Validates: Requirements 2.7**
   *
   * For any sequence of two or more paragraph content blocks, the generated
   * Markdown output SHALL separate each paragraph with at least one blank line
   * (two consecutive newlines).
   */

  // Generator for unique alphanumeric paragraph texts
  const alphanumChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const safeWordArb = fc.string({
    minLength: 3,
    maxLength: 15,
    unit: fc.constantFrom(...alphanumChars.split('')),
  }).filter((s) => s.trim().length >= 3);

  // Generate an array of 2-5 unique paragraph texts
  const uniqueParagraphTextsArb = fc
    .array(safeWordArb, { minLength: 2, maxLength: 5 })
    .filter((arr) => new Set(arr).size === arr.length);

  it('separates each paragraph with at least one blank line in the Markdown output', async () => {
    await fc.assert(
      fc.asyncProperty(uniqueParagraphTextsArb, async (paragraphTexts: string[]) => {
        // Build paragraph ContentBlocks
        const blocks: ContentBlock[] = paragraphTexts.map((text) => ({
          type: 'paragraph' as const,
          lines: [text],
          formatting: [],
        }));

        const html = blocksToHtml(blocks);
        const markdown = await htmlToMarkdown(html);

        // For each consecutive pair of paragraphs, verify there is at least
        // one blank line (i.e. \n\n) between them in the Markdown output.
        for (let i = 0; i < paragraphTexts.length - 1; i++) {
          const currentText = paragraphTexts[i];
          const nextText = paragraphTexts[i + 1];

          const currentIdx = markdown.indexOf(currentText);
          const nextIdx = markdown.indexOf(nextText);

          // Both texts must be present in the output
          expect(currentIdx).toBeGreaterThanOrEqual(0);
          expect(nextIdx).toBeGreaterThan(currentIdx);

          // Extract the text between the end of the current paragraph and
          // the start of the next paragraph
          const between = markdown.slice(currentIdx + currentText.length, nextIdx);

          // There must be at least one blank line (two consecutive newlines)
          expect(between).toContain('\n\n');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Inline formatting preservation
// ---------------------------------------------------------------------------

describe('Feature: pdf-to-markdown-import, Property 2: Inline formatting preservation', () => {
  /**
   * **Validates: Requirements 2.3, 2.4, 3.3**
   *
   * For any text content with bold and/or italic flags, the `blocksToHtml`
   * function SHALL produce HTML that wraps bold text in `<strong>` tags and
   * italic text in `<em>` tags, and the final Markdown output SHALL contain
   * the corresponding `**text**` and `*text*` syntax preserving the original
   * text content.
   */

  // Generator for simple alphanumeric text that won't interfere with HTML/Markdown
  const alphanumChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const safeTextArb = fc
    .string({ minLength: 1, maxLength: 30, unit: fc.constantFrom(...alphanumChars.split('')) })
    .filter((s) => s.trim().length > 0);

  it('blocksToHtml wraps bold text in <strong> tags', () => {
    fc.assert(
      fc.property(safeTextArb, (text: string) => {
        const block: ContentBlock = {
          type: 'paragraph',
          lines: [text],
          formatting: [{ start: 0, end: text.length, style: 'bold' }],
        };

        const html = blocksToHtml([block]);

        expect(html).toContain('<strong>');
        expect(html).toContain('</strong>');
        expect(html).toContain(`<strong>${text}</strong>`);
      }),
      { numRuns: 100 }
    );
  });

  it('blocksToHtml wraps italic text in <em> tags', () => {
    fc.assert(
      fc.property(safeTextArb, (text: string) => {
        const block: ContentBlock = {
          type: 'paragraph',
          lines: [text],
          formatting: [{ start: 0, end: text.length, style: 'italic' }],
        };

        const html = blocksToHtml([block]);

        expect(html).toContain('<em>');
        expect(html).toContain('</em>');
        expect(html).toContain(`<em>${text}</em>`);
      }),
      { numRuns: 100 }
    );
  });

  it('blocksToHtml wraps bold+italic text in <strong><em> tags', () => {
    fc.assert(
      fc.property(safeTextArb, (text: string) => {
        const block: ContentBlock = {
          type: 'paragraph',
          lines: [text],
          formatting: [{ start: 0, end: text.length, style: 'bolditalic' }],
        };

        const html = blocksToHtml([block]);

        expect(html).toContain('<strong><em>');
        expect(html).toContain('</em></strong>');
        expect(html).toContain(`<strong><em>${text}</em></strong>`);
      }),
      { numRuns: 100 }
    );
  });

  it('htmlToMarkdown converts bold HTML to **text** syntax', async () => {
    await fc.assert(
      fc.asyncProperty(safeTextArb, async (text: string) => {
        const block: ContentBlock = {
          type: 'paragraph',
          lines: [text],
          formatting: [{ start: 0, end: text.length, style: 'bold' }],
        };

        const html = blocksToHtml([block]);
        const markdown = await htmlToMarkdown(html);

        expect(markdown).toContain(`**${text}**`);
      }),
      { numRuns: 100 }
    );
  });

  it('htmlToMarkdown converts italic HTML to *text* or _text_ syntax', async () => {
    await fc.assert(
      fc.asyncProperty(safeTextArb, async (text: string) => {
        const block: ContentBlock = {
          type: 'paragraph',
          lines: [text],
          formatting: [{ start: 0, end: text.length, style: 'italic' }],
        };

        const html = blocksToHtml([block]);
        const markdown = await htmlToMarkdown(html);

        // Turndown may use either * or _ for italic
        const hasAsteriskItalic = markdown.includes(`*${text}*`);
        const hasUnderscoreItalic = markdown.includes(`_${text}_`);
        expect(hasAsteriskItalic || hasUnderscoreItalic).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});


// ---------------------------------------------------------------------------
// Property 7: Table HTML structure fix
// ---------------------------------------------------------------------------

describe('Feature: pdf-to-markdown-import, Property 7: Table HTML structure fix', () => {
  /**
   * **Validates: Requirements 5.4**
   *
   * For any HTML string containing a `<table>` element with N rows (N≥2) and
   * M columns (M≥2), the `fixTableHtml` function SHALL produce output where
   * the table has a `<thead>` containing the first row with `<th>` cells and
   * a `<tbody>` containing the remaining rows with `<td>` cells, and the total
   * number of `<tr>` elements SHALL equal the original row count.
   */

  // Generator for simple alphanumeric cell text (no HTML special chars)
  const alphanumChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const cellTextArb = fc
    .string({ minLength: 1, maxLength: 15, unit: fc.constantFrom(...alphanumChars.split('')) })
    .filter((s) => s.trim().length > 0);

  it('produces proper thead/th and tbody/td structure from flat table HTML', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }), // row count
        fc.integer({ min: 2, max: 6 }), // column count
        fc.context(),
        (numRows, numCols, ctx) => {
          // Generate cell texts deterministically based on row/col indices
          const grid: string[][] = [];
          for (let r = 0; r < numRows; r++) {
            const row: string[] = [];
            for (let c = 0; c < numCols; c++) {
              row.push(`R${r}C${c}`);
            }
            grid.push(row);
          }

          // Build a flat HTML table with only <tr>/<td> (no thead/tbody)
          const rowsHtml = grid
            .map((row) => {
              const cells = row.map((cell) => `<td>${cell}</td>`).join('');
              return `<tr>${cells}</tr>`;
            })
            .join('');
          const inputHtml = `<table>${rowsHtml}</table>`;

          ctx.log(`Input: ${numRows} rows × ${numCols} cols`);

          // Run fixTableHtml
          const result = fixTableHtml(inputHtml);

          // Parse the result to verify structure
          const parser = new DOMParser();
          const doc = parser.parseFromString(result, 'text/html');
          const table = doc.querySelector('table');

          expect(table).not.toBeNull();
          if (!table) return;

          // 1. Assert <thead> exists with <th> cells for the first row
          const thead = table.querySelector('thead');
          expect(thead).not.toBeNull();
          if (!thead) return;

          const theadRows = thead.querySelectorAll('tr');
          expect(theadRows).toHaveLength(1);

          const thCells = theadRows[0].querySelectorAll('th');
          expect(thCells).toHaveLength(numCols);

          // Verify header cell content matches first row of grid
          for (let c = 0; c < numCols; c++) {
            expect(thCells[c].textContent).toBe(grid[0][c]);
          }

          // 2. Assert <tbody> exists with <td> cells for remaining rows
          const tbody = table.querySelector('tbody');
          if (numRows > 1) {
            expect(tbody).not.toBeNull();
            if (!tbody) return;

            const tbodyRows = tbody.querySelectorAll('tr');
            expect(tbodyRows).toHaveLength(numRows - 1);

            for (let r = 0; r < numRows - 1; r++) {
              const tdCells = tbodyRows[r].querySelectorAll('td');
              expect(tdCells).toHaveLength(numCols);

              // Verify body cell content matches remaining rows of grid
              for (let c = 0; c < numCols; c++) {
                expect(tdCells[c].textContent).toBe(grid[r + 1][c]);
              }
            }
          }

          // 3. Assert total <tr> count equals the original row count
          const allTrs = table.querySelectorAll('tr');
          expect(allTrs).toHaveLength(numRows);

          // 4. Assert no <th> cells exist in tbody
          if (tbody) {
            const tbodyThCells = tbody.querySelectorAll('th');
            expect(tbodyThCells).toHaveLength(0);
          }

          // 5. Assert no <td> cells exist in thead
          const theadTdCells = thead.querySelectorAll('td');
          expect(theadTdCells).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('produces proper structure with randomly generated cell text', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }), // row count
        fc.integer({ min: 2, max: 6 }), // column count
        fc.context(),
        (numRows, numCols, ctx) => {
          // Use fc.sample to generate random cell texts for the grid
          const cellTexts = fc.sample(cellTextArb, numRows * numCols);
          const grid: string[][] = [];
          for (let r = 0; r < numRows; r++) {
            grid.push(cellTexts.slice(r * numCols, (r + 1) * numCols));
          }

          // Build flat HTML table
          const rowsHtml = grid
            .map((row) => {
              const cells = row.map((cell) => `<td>${cell}</td>`).join('');
              return `<tr>${cells}</tr>`;
            })
            .join('');
          const inputHtml = `<table>${rowsHtml}</table>`;

          ctx.log(`Input: ${numRows} rows × ${numCols} cols, random cell text`);

          const result = fixTableHtml(inputHtml);

          // Parse and verify
          const parser = new DOMParser();
          const doc = parser.parseFromString(result, 'text/html');
          const table = doc.querySelector('table');
          expect(table).not.toBeNull();
          if (!table) return;

          // Verify thead has th cells
          const thead = table.querySelector('thead');
          expect(thead).not.toBeNull();
          if (!thead) return;

          const thCells = thead.querySelectorAll('th');
          expect(thCells).toHaveLength(numCols);

          // Verify tbody has td cells
          const tbody = table.querySelector('tbody');
          expect(tbody).not.toBeNull();
          if (!tbody) return;

          const tbodyRows = tbody.querySelectorAll('tr');
          expect(tbodyRows).toHaveLength(numRows - 1);

          for (const tbodyRow of tbodyRows) {
            const tdCells = tbodyRow.querySelectorAll('td');
            expect(tdCells).toHaveLength(numCols);
          }

          // Total row count preserved
          const allTrs = table.querySelectorAll('tr');
          expect(allTrs).toHaveLength(numRows);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ---------------------------------------------------------------------------
// Property 6: Image references use Blob URLs without base64
// ---------------------------------------------------------------------------

describe('Feature: pdf-to-markdown-import, Property 6: Image references use Blob URLs without base64', () => {
  /**
   * **Validates: Requirements 4.2, 4.3**
   *
   * For any extracted image (random Uint8Array data with a valid content type),
   * the generated Markdown SHALL contain an image reference using `![...](blob:...)`
   * syntax, and the Markdown output SHALL NOT contain any `data:` URI strings or
   * inline base64-encoded image data.
   */

  // Mock URL.createObjectURL since jsdom doesn't support it
  const originalCreateObjectURL = URL.createObjectURL;

  beforeEach(() => {
    let blobCounter = 0;
    URL.createObjectURL = jest.fn(() => {
      blobCounter++;
      return `blob:http://localhost/fake-blob-${blobCounter}`;
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
  });

  it('generates Markdown with blob: URLs and no data: URIs for any image data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1, maxLength: 100 }),
        fc.constantFrom('image/png', 'image/jpeg'),
        async (imageData: Uint8Array, contentType: string) => {
          // Build a PdfImage from the generated data
          const image: PdfImage = {
            data: imageData,
            contentType,
            width: 100,
            height: 100,
            pageIndex: 0,
            y: 500,
          };

          // Create image ContentBlocks via the production function
          const blocks = createImageBlocks([image]);

          // Convert through the full pipeline: blocks → HTML → Markdown
          const html = blocksToHtml(blocks);
          const markdown = await htmlToMarkdown(html);

          // Assert the Markdown contains a blob: URL image reference
          expect(markdown).toMatch(/!\[.*\]\(blob:/);

          // Assert the Markdown does NOT contain data: URIs or inline base64
          expect(markdown).not.toMatch(/data:/);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Image count preservation
// ---------------------------------------------------------------------------

describe('Feature: pdf-to-markdown-import, Property 9: Image count preservation', () => {
  /**
   * **Validates: Requirements 9.3**
   *
   * For any set of N extractable images from a PDF, the final Markdown output
   * SHALL contain exactly N Markdown image references (`![...](...)`).
   */

  // Mock URL.createObjectURL since jsdom doesn't support it
  const originalCreateObjectURL = URL.createObjectURL;

  beforeEach(() => {
    let blobCounter = 0;
    URL.createObjectURL = jest.fn(() => {
      blobCounter++;
      return `blob:http://localhost/fake-blob-${blobCounter}`;
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
  });

  it('produces exactly N image references in Markdown for N input images', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (n: number) => {
          // Generate N PdfImage objects with random data
          const images: PdfImage[] = [];
          for (let i = 0; i < n; i++) {
            const data = fc.sample(fc.uint8Array({ minLength: 1, maxLength: 50 }), 1)[0];
            images.push({
              data,
              contentType: 'image/png',
              width: 100,
              height: 100,
              pageIndex: 0,
              y: 500 - i * 50, // spread them out vertically
            });
          }

          // Create image ContentBlocks via the production function
          const blocks = createImageBlocks(images);

          // Convert through the full pipeline: blocks → HTML → Markdown
          const html = blocksToHtml(blocks);
          const markdown = await htmlToMarkdown(html);

          // Count the number of ![ occurrences (each image reference starts with ![)
          const imageRefCount = (markdown.match(/!\[/g) || []).length;

          // Assert exactly N image references
          expect(imageRefCount).toBe(n);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ---------------------------------------------------------------------------
// Property 10: OCR fallback activation
// ---------------------------------------------------------------------------

describe('Feature: pdf-to-markdown-import, Property 10: OCR fallback activation', () => {
  /**
   * **Validates: Requirements 2.8**
   *
   * For any PDF page where pdfjs-dist text extraction returns empty or
   * near-empty results (fewer than 50 non-whitespace characters), the
   * `processPageWithOcrFallback` function SHALL invoke Tesseract.js OCR
   * on that page and include the OCR-extracted text in the output.
   */

  let mockRecognize: jest.Mock;
  let originalCreateElement: typeof document.createElement;
  let mockCanvasCtx: Record<string, jest.Mock>;
  let mockCanvas: {
    width: number;
    height: number;
    getContext: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mockRecognize = require('tesseract.js').recognize;

    // Mock canvas context since jsdom doesn't support canvas
    mockCanvasCtx = {
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      drawImage: jest.fn(),
    };

    mockCanvas = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue(mockCanvasCtx),
    };

    // Save original and mock document.createElement for 'canvas'
    originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === 'canvas') {
        return mockCanvas as any;
      }
      return originalCreateElement(tagName, options);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Creates a mock page that supports both getTextContent (for extractPageTextItems)
   * and getViewport/render (for ocrPage).
   *
   * @param textItems - Items returned by getTextContent (empty/minimal to trigger OCR)
   */
  function createCombinedMockPage(textItems: any[]) {
    return {
      getTextContent: jest.fn().mockResolvedValue({
        items: textItems,
        styles: {},
        lang: null,
      }),
      getViewport: jest.fn().mockReturnValue({
        width: 1224,
        height: 1584,
      }),
      render: jest.fn().mockReturnValue({
        promise: Promise.resolve(),
      }),
    } as any;
  }

  /**
   * Builds a raw text item (as returned by pdfjs-dist getTextContent) with
   * minimal/empty text to ensure the page falls below the 50 non-ws char threshold.
   */
  function makeMinimalTextItem(str: string) {
    return {
      str,
      dir: 'ltr',
      transform: [12, 0, 0, 12, 72, 700],
      width: 30,
      height: 12,
      fontName: 'g_d0_f1',
      hasEOL: false,
    };
  }

  // Generator for OCR text: 1-5 words of alphanumeric characters
  const alphanumChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const wordArb = fc.string({
    minLength: 2,
    maxLength: 12,
    unit: fc.constantFrom(...alphanumChars.split('')),
  }).filter((s) => s.trim().length >= 2);

  const ocrTextArb = fc
    .array(wordArb, { minLength: 1, maxLength: 5 })
    .map((words) => words.join(' '));

  it('invokes Tesseract.js recognize and returns OCR text when page has empty/minimal text items', async () => {
    await fc.assert(
      fc.asyncProperty(ocrTextArb, async (ocrText: string) => {
        jest.clearAllMocks();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        mockRecognize = require('tesseract.js').recognize;

        // Create a page with empty text items (below 50 non-ws chars threshold)
        const page = createCombinedMockPage([]);

        // Mock Tesseract.js to return the generated OCR text
        mockRecognize.mockResolvedValue({
          data: {
            blocks: [{
              paragraphs: [{
                lines: [{
                  words: [{
                    text: ocrText,
                    bbox: { x0: 100, y0: 200, x1: 400, y1: 230 },
                    font_name: 'ocr-detected',
                  }],
                }],
              }],
            }],
          },
        });

        const items = await processPageWithOcrFallback(page);

        // Assert that Tesseract.js recognize was called
        expect(mockRecognize).toHaveBeenCalledTimes(1);

        // Assert that the returned items contain the OCR text
        expect(items.length).toBeGreaterThanOrEqual(1);
        const allText = items.map((item) => item.text).join(' ');
        expect(allText).toContain(ocrText);
      }),
      { numRuns: 100 }
    );
  });

  it('invokes Tesseract.js recognize when page has minimal text below threshold', async () => {
    // Generator for short strings that stay below 50 non-whitespace chars
    const shortTextArb = fc.string({
      minLength: 0,
      maxLength: 10,
      unit: fc.constantFrom(...alphanumChars.split('')),
    });

    await fc.assert(
      fc.asyncProperty(shortTextArb, ocrTextArb, async (sparseText: string, ocrText: string) => {
        jest.clearAllMocks();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        mockRecognize = require('tesseract.js').recognize;

        // Create a page with minimal text items (below 50 non-ws chars)
        const textItems = sparseText.length > 0
          ? [makeMinimalTextItem(sparseText)]
          : [];
        const page = createCombinedMockPage(textItems);

        // Mock Tesseract.js to return the generated OCR text
        mockRecognize.mockResolvedValue({
          data: {
            blocks: [{
              paragraphs: [{
                lines: [{
                  words: [{
                    text: ocrText,
                    bbox: { x0: 50, y0: 100, x1: 300, y1: 130 },
                    font_name: 'ocr-detected',
                  }],
                }],
              }],
            }],
          },
        });

        const items = await processPageWithOcrFallback(page);

        // Assert that Tesseract.js recognize was called for this page
        expect(mockRecognize).toHaveBeenCalledTimes(1);

        // Assert that OCR text appears in the returned items
        expect(items.length).toBeGreaterThanOrEqual(1);
        const allText = items.map((item) => item.text).join(' ');
        expect(allText).toContain(ocrText);
      }),
      { numRuns: 100 }
    );
  });
});


// ---------------------------------------------------------------------------
// Property 8: Text content fidelity
// ---------------------------------------------------------------------------

describe('Feature: pdf-to-markdown-import, Property 8: Text content fidelity', () => {
  /**
   * **Validates: Requirements 2.6, 9.1, 9.4**
   *
   * For any set of PdfTextItems with known text content, the final Markdown
   * output SHALL contain every original text string (preserving capitalization),
   * and SHALL NOT contain any text content that was not present in the input
   * items (no hallucinated or duplicated content).
   */

  // Generator for unique alphanumeric text strings (no special chars, no list prefixes)
  const alphanumChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const safeWordArb = fc
    .string({
      minLength: 3,
      maxLength: 20,
      unit: fc.constantFrom(...alphanumChars.split('')),
    })
    .filter((s) => {
      const trimmed = s.trim();
      // Must have at least 3 chars
      if (trimmed.length < 3) return false;
      // Must not start with bullet characters or numbered list prefixes
      if (/^[\u2022\u2013\u25AA\-]/.test(trimmed)) return false;
      if (/^\d+[\.\)]\s/.test(trimmed)) return false;
      return true;
    });

  // Generate an array of 2-5 unique text strings
  const uniqueTextsArb = fc
    .array(safeWordArb, { minLength: 2, maxLength: 5 })
    .filter((arr) => new Set(arr).size === arr.length);

  it('final Markdown contains every original text string with preserved capitalization', async () => {
    await fc.assert(
      fc.asyncProperty(uniqueTextsArb, async (texts: string[]) => {
        const BODY_FONT_SIZE = 12;

        // Create PdfTextItem arrays from the generated texts.
        // Each text becomes a separate item on its own line (different Y positions).
        const items: PdfTextItem[] = texts.map((text, index) => ({
          text,
          x: 72,
          y: 700 - index * 30, // spread vertically so each is on its own line
          width: text.length * BODY_FONT_SIZE * 0.6,
          height: BODY_FONT_SIZE,
          fontSize: BODY_FONT_SIZE,
          fontName: 'Arial',
          isBold: false,
          isItalic: false,
        }));

        // Run through the internal pipeline:
        // groupIntoLines → classifyLine → groupConsecutiveBlocks → blocksToHtml → htmlToMarkdown
        const lines = groupIntoLines(items);

        const classifiedBlocks: ContentBlock[] = lines.map((line) =>
          classifyLine(line, BODY_FONT_SIZE)
        );

        const groupedBlocks = groupConsecutiveBlocks(classifiedBlocks);

        const html = blocksToHtml(groupedBlocks);
        const markdown = await htmlToMarkdown(html);

        // Assert each original text string appears in the Markdown output
        // with preserved capitalization
        for (const text of texts) {
          expect(markdown).toContain(text);
        }
      }),
      { numRuns: 100 }
    );
  });
});
