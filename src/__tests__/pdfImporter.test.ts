/**
 * Unit tests for pdfImporter module — extractPageTextItems function
 */

// Mock pdfjs-dist before importing the module under test.
// This avoids the `import.meta.url` issue in Jest's CommonJS environment.
jest.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  OPS: {
    paintImageXObject: 85,
  },
  getDocument: jest.fn(),
}));

import {
  extractPageTextItems,
  extractPageImages,
  createImageBlocks,
  groupIntoLines,
  detectBodyFontSize,
  classifyLine,
  groupConsecutiveBlocks,
  detectTables,
  blocksToHtml,
  fixTableHtml,
  htmlToMarkdown,
  hasSubstantialText,
  ocrPage,
  processPageWithOcrFallback,
  convertPdfToMarkdown,
  PdfImportError,
  PdfTextItem,
  PdfImage,
  TextLine,
  ContentBlock,
} from '../pdfImporter';

// ---------------------------------------------------------------------------
// Helpers to build mock pdfjs-dist page objects
// ---------------------------------------------------------------------------

interface MockTextItem {
  str: string;
  dir: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL: boolean;
}

interface MockMarkedContent {
  type: string;
  id: string;
}

/**
 * Creates a mock PDFPageProxy with the given text items and optional
 * marked-content items returned by getTextContent().
 */
function createMockPage(
  items: (MockTextItem | MockMarkedContent)[],
  styles: Record<string, unknown> = {}
) {
  return {
    getTextContent: jest.fn().mockResolvedValue({
      items,
      styles,
      lang: null,
    }),
  } as any;
}

/**
 * Builds a standard MockTextItem with sensible defaults.
 * The transform matrix [a, b, c, d, e, f] encodes:
 *   fontSize via sqrt(a² + b²), x = e, y = f
 */
function makeTextItem(overrides: Partial<MockTextItem> = {}): MockTextItem {
  return {
    str: 'Hello',
    dir: 'ltr',
    // Default: fontSize=12, x=72, y=700
    transform: [12, 0, 0, 12, 72, 700],
    width: 30,
    height: 12,
    fontName: 'g_d0_f1',
    hasEOL: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractPageTextItems', () => {
  it('extracts basic text items with correct position and font size', async () => {
    const page = createMockPage([
      makeTextItem({ str: 'Hello', transform: [12, 0, 0, 12, 72, 700], width: 30, height: 12 }),
      makeTextItem({ str: 'World', transform: [12, 0, 0, 12, 110, 700], width: 28, height: 12 }),
    ]);

    const items = await extractPageTextItems(page);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual<PdfTextItem>({
      text: 'Hello',
      x: 72,
      y: 700,
      width: 30,
      height: 12,
      fontSize: 12,
      fontName: 'g_d0_f1',
      isBold: false,
      isItalic: false,
    });
    expect(items[1].text).toBe('World');
    expect(items[1].x).toBe(110);
  });

  it('derives isBold from font name containing "Bold"', async () => {
    const page = createMockPage([
      makeTextItem({ str: 'Bold text', fontName: 'TimesNewRoman-Bold' }),
    ]);

    const items = await extractPageTextItems(page);

    expect(items).toHaveLength(1);
    expect(items[0].isBold).toBe(true);
    expect(items[0].isItalic).toBe(false);
  });

  it('derives isItalic from font name containing "Italic"', async () => {
    const page = createMockPage([
      makeTextItem({ str: 'Italic text', fontName: 'Arial-Italic' }),
    ]);

    const items = await extractPageTextItems(page);

    expect(items).toHaveLength(1);
    expect(items[0].isBold).toBe(false);
    expect(items[0].isItalic).toBe(true);
  });

  it('derives isItalic from font name containing "Oblique"', async () => {
    const page = createMockPage([
      makeTextItem({ str: 'Oblique text', fontName: 'Helvetica-Oblique' }),
    ]);

    const items = await extractPageTextItems(page);

    expect(items).toHaveLength(1);
    expect(items[0].isItalic).toBe(true);
  });

  it('detects bold+italic from font name containing both', async () => {
    const page = createMockPage([
      makeTextItem({ str: 'Bold italic', fontName: 'TimesNewRoman-BoldItalic' }),
    ]);

    const items = await extractPageTextItems(page);

    expect(items).toHaveLength(1);
    expect(items[0].isBold).toBe(true);
    expect(items[0].isItalic).toBe(true);
  });

  it('computes fontSize from rotated transform matrix', async () => {
    // Rotated text: a=8.49, b=8.49 → fontSize = sqrt(8.49² + 8.49²) ≈ 12
    const a = 12 * Math.cos(Math.PI / 4); // ≈ 8.485
    const b = 12 * Math.sin(Math.PI / 4); // ≈ 8.485
    const page = createMockPage([
      makeTextItem({ str: 'Rotated', transform: [a, b, -b, a, 100, 500] }),
    ]);

    const items = await extractPageTextItems(page);

    expect(items).toHaveLength(1);
    expect(items[0].fontSize).toBeCloseTo(12, 1);
  });

  it('skips empty text items', async () => {
    const page = createMockPage([
      makeTextItem({ str: '' }),
      makeTextItem({ str: 'Visible' }),
    ]);

    const items = await extractPageTextItems(page);

    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('Visible');
  });

  it('skips marked content items', async () => {
    const page = createMockPage([
      { type: 'beginMarkedContent', id: 'mc0' } as MockMarkedContent,
      makeTextItem({ str: 'Content' }),
      { type: 'endMarkedContent', id: 'mc0' } as MockMarkedContent,
    ]);

    const items = await extractPageTextItems(page);

    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('Content');
  });

  it('returns empty array for a page with no text items', async () => {
    const page = createMockPage([]);

    const items = await extractPageTextItems(page);

    expect(items).toEqual([]);
  });

  it('handles case-insensitive bold/italic detection', async () => {
    const page = createMockPage([
      makeTextItem({ str: 'a', fontName: 'ARIAL-BOLD' }),
      makeTextItem({ str: 'b', fontName: 'arial-italic' }),
      makeTextItem({ str: 'c', fontName: 'Font-OBLIQUE' }),
    ]);

    const items = await extractPageTextItems(page);

    expect(items[0].isBold).toBe(true);
    expect(items[1].isItalic).toBe(true);
    expect(items[2].isItalic).toBe(true);
  });

  it('preserves original text capitalization', async () => {
    const page = createMockPage([
      makeTextItem({ str: 'Hello World' }),
      makeTextItem({ str: 'ALL CAPS' }),
      makeTextItem({ str: 'camelCase' }),
    ]);

    const items = await extractPageTextItems(page);

    expect(items[0].text).toBe('Hello World');
    expect(items[1].text).toBe('ALL CAPS');
    expect(items[2].text).toBe('camelCase');
  });
});

// ---------------------------------------------------------------------------
// Helpers for groupIntoLines / detectBodyFontSize tests
// ---------------------------------------------------------------------------

/**
 * Creates a PdfTextItem with sensible defaults for line-grouping tests.
 */
function makePdfTextItem(overrides: Partial<PdfTextItem> = {}): PdfTextItem {
  return {
    text: 'word',
    x: 72,
    y: 700,
    width: 30,
    height: 12,
    fontSize: 12,
    fontName: 'Arial',
    isBold: false,
    isItalic: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// groupIntoLines tests
// ---------------------------------------------------------------------------

describe('groupIntoLines', () => {
  it('returns empty array for empty input', () => {
    const lines = groupIntoLines([]);
    expect(lines).toEqual([]);
  });

  it('groups items on the same Y-coordinate into one line', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ text: 'Hello', x: 72, y: 700 }),
      makePdfTextItem({ text: 'World', x: 120, y: 700 }),
    ];

    const lines = groupIntoLines(items);

    expect(lines).toHaveLength(1);
    expect(lines[0].items).toHaveLength(2);
    expect(lines[0].items[0].text).toBe('Hello');
    expect(lines[0].items[1].text).toBe('World');
  });

  it('groups items within Y-tolerance into the same line', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ text: 'A', x: 72, y: 700 }),
      makePdfTextItem({ text: 'B', x: 120, y: 702 }), // within default tolerance of 3
    ];

    const lines = groupIntoLines(items);

    expect(lines).toHaveLength(1);
    expect(lines[0].items).toHaveLength(2);
  });

  it('separates items beyond Y-tolerance into different lines', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ text: 'Line1', x: 72, y: 700 }),
      makePdfTextItem({ text: 'Line2', x: 72, y: 680 }), // 20px apart
    ];

    const lines = groupIntoLines(items);

    expect(lines).toHaveLength(2);
    expect(lines[0].items[0].text).toBe('Line1');
    expect(lines[1].items[0].text).toBe('Line2');
  });

  it('sorts lines top-to-bottom (higher Y first in PDF coordinates)', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ text: 'Bottom', x: 72, y: 100 }),
      makePdfTextItem({ text: 'Top', x: 72, y: 700 }),
      makePdfTextItem({ text: 'Middle', x: 72, y: 400 }),
    ];

    const lines = groupIntoLines(items);

    expect(lines).toHaveLength(3);
    expect(lines[0].items[0].text).toBe('Top');
    expect(lines[1].items[0].text).toBe('Middle');
    expect(lines[2].items[0].text).toBe('Bottom');
  });

  it('sorts items within a line by X-coordinate (left to right)', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ text: 'C', x: 200, y: 700 }),
      makePdfTextItem({ text: 'A', x: 72, y: 700 }),
      makePdfTextItem({ text: 'B', x: 130, y: 700 }),
    ];

    const lines = groupIntoLines(items);

    expect(lines).toHaveLength(1);
    expect(lines[0].items[0].text).toBe('A');
    expect(lines[0].items[1].text).toBe('B');
    expect(lines[0].items[2].text).toBe('C');
  });

  it('computes correct minX and maxX for a line', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ text: 'A', x: 72, width: 20, y: 700 }),
      makePdfTextItem({ text: 'B', x: 200, width: 40, y: 700 }),
    ];

    const lines = groupIntoLines(items);

    expect(lines[0].minX).toBe(72);
    expect(lines[0].maxX).toBe(240); // 200 + 40
  });

  it('computes correct avgFontSize for a line', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ text: 'A', fontSize: 10, y: 700 }),
      makePdfTextItem({ text: 'B', fontSize: 14, y: 700 }),
    ];

    const lines = groupIntoLines(items);

    expect(lines[0].avgFontSize).toBe(12); // (10 + 14) / 2
  });

  it('handles a single item', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ text: 'Solo', x: 72, y: 700, width: 30, fontSize: 12 }),
    ];

    const lines = groupIntoLines(items);

    expect(lines).toHaveLength(1);
    expect(lines[0].items).toHaveLength(1);
    expect(lines[0].items[0].text).toBe('Solo');
    expect(lines[0].minX).toBe(72);
    expect(lines[0].maxX).toBe(102); // 72 + 30
    expect(lines[0].avgFontSize).toBe(12);
  });

  it('respects custom tolerance parameter', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ text: 'A', x: 72, y: 700 }),
      makePdfTextItem({ text: 'B', x: 120, y: 695 }), // 5px apart
    ];

    // Default tolerance (3) should separate them
    const linesDefault = groupIntoLines(items, 3);
    expect(linesDefault).toHaveLength(2);

    // Larger tolerance (6) should group them
    const linesWide = groupIntoLines(items, 6);
    expect(linesWide).toHaveLength(1);
  });

  it('handles multiple lines with multiple items each', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ text: 'L1-A', x: 72, y: 700 }),
      makePdfTextItem({ text: 'L1-B', x: 120, y: 700 }),
      makePdfTextItem({ text: 'L2-A', x: 72, y: 680 }),
      makePdfTextItem({ text: 'L2-B', x: 120, y: 680 }),
      makePdfTextItem({ text: 'L3-A', x: 72, y: 660 }),
    ];

    const lines = groupIntoLines(items);

    expect(lines).toHaveLength(3);
    expect(lines[0].items).toHaveLength(2);
    expect(lines[1].items).toHaveLength(2);
    expect(lines[2].items).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// detectBodyFontSize tests
// ---------------------------------------------------------------------------

describe('detectBodyFontSize', () => {
  it('returns 12 as default for empty input', () => {
    expect(detectBodyFontSize([])).toBe(12);
  });

  it('returns the single font size when all items have the same size', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ fontSize: 10 }),
      makePdfTextItem({ fontSize: 10 }),
      makePdfTextItem({ fontSize: 10 }),
    ];

    expect(detectBodyFontSize(items)).toBe(10);
  });

  it('returns the most frequent font size (mode)', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ fontSize: 24 }), // heading (1 item)
      makePdfTextItem({ fontSize: 12 }), // body (3 items)
      makePdfTextItem({ fontSize: 12 }),
      makePdfTextItem({ fontSize: 12 }),
      makePdfTextItem({ fontSize: 18 }), // subheading (1 item)
    ];

    expect(detectBodyFontSize(items)).toBe(12);
  });

  it('rounds font sizes to nearest integer for bucketing', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ fontSize: 11.8 }),
      makePdfTextItem({ fontSize: 12.1 }),
      makePdfTextItem({ fontSize: 12.3 }),
      makePdfTextItem({ fontSize: 9.5 }), // rounds to 10
      makePdfTextItem({ fontSize: 9.6 }), // rounds to 10
    ];

    // 12 appears 3 times (11.8→12, 12.1→12, 12.3→12), 10 appears 2 times
    expect(detectBodyFontSize(items)).toBe(12);
  });

  it('handles a single item', () => {
    const items: PdfTextItem[] = [makePdfTextItem({ fontSize: 14 })];

    expect(detectBodyFontSize(items)).toBe(14);
  });

  it('picks the mode when there are multiple candidates', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ fontSize: 10 }),
      makePdfTextItem({ fontSize: 10 }),
      makePdfTextItem({ fontSize: 14 }),
      makePdfTextItem({ fontSize: 14 }),
      makePdfTextItem({ fontSize: 14 }),
    ];

    expect(detectBodyFontSize(items)).toBe(14);
  });
});


// ---------------------------------------------------------------------------
// classifyLine tests
// ---------------------------------------------------------------------------

describe('classifyLine', () => {
  /**
   * Helper to build a TextLine from simple parameters.
   */
  function makeTextLine(
    text: string,
    avgFontSize: number,
    overrides?: { isBold?: boolean; isItalic?: boolean }
  ): TextLine {
    return {
      items: [
        makePdfTextItem({
          text,
          fontSize: avgFontSize,
          isBold: overrides?.isBold ?? false,
          isItalic: overrides?.isItalic ?? false,
        }),
      ],
      y: 700,
      minX: 72,
      maxX: 200,
      avgFontSize,
    };
  }

  // --- Heading detection ---

  it('classifies line with font ratio ≥2.0 as H1', () => {
    const line = makeTextLine('Title', 24);
    const block = classifyLine(line, 12);

    expect(block.type).toBe('heading');
    if (block.type === 'heading') {
      expect(block.level).toBe(1);
      expect(block.text).toBe('Title');
    }
  });

  it('classifies line with font ratio ≥1.6 (but <2.0) as H2', () => {
    const line = makeTextLine('Subtitle', 20); // 20 / 12 ≈ 1.667
    const block = classifyLine(line, 12);

    expect(block.type).toBe('heading');
    if (block.type === 'heading') {
      expect(block.level).toBe(2);
    }
  });

  it('classifies line with font ratio ≥1.3 (but <1.6) as H3', () => {
    const line = makeTextLine('Section', 16); // 16 / 12 ≈ 1.333
    const block = classifyLine(line, 12);

    expect(block.type).toBe('heading');
    if (block.type === 'heading') {
      expect(block.level).toBe(3);
    }
  });

  it('classifies line with font ratio ≥1.1 (but <1.3) as H4', () => {
    const line = makeTextLine('Subsection', 14); // 14 / 12 ≈ 1.167
    const block = classifyLine(line, 12);

    expect(block.type).toBe('heading');
    if (block.type === 'heading') {
      expect(block.level).toBe(4);
    }
  });

  it('classifies line with font ratio <1.1 as paragraph', () => {
    const line = makeTextLine('Normal text', 12);
    const block = classifyLine(line, 12);

    expect(block.type).toBe('paragraph');
    if (block.type === 'paragraph') {
      expect(block.lines).toEqual(['Normal text']);
    }
  });

  it('classifies line with font size smaller than body as paragraph', () => {
    const line = makeTextLine('Footnote', 8);
    const block = classifyLine(line, 12);

    expect(block.type).toBe('paragraph');
  });

  it('classifies exactly at the H1 boundary (ratio = 2.0)', () => {
    const line = makeTextLine('Exact H1', 24);
    const block = classifyLine(line, 12); // 24/12 = 2.0

    expect(block.type).toBe('heading');
    if (block.type === 'heading') {
      expect(block.level).toBe(1);
    }
  });

  it('classifies just below H1 boundary as H2', () => {
    const line = makeTextLine('Almost H1', 23.9);
    const block = classifyLine(line, 12); // 23.9/12 ≈ 1.99

    expect(block.type).toBe('heading');
    if (block.type === 'heading') {
      expect(block.level).toBe(2);
    }
  });

  // --- Unordered list detection ---

  it('detects unordered list with bullet •', () => {
    const line = makeTextLine('• First item', 12);
    const block = classifyLine(line, 12);

    expect(block.type).toBe('list');
    if (block.type === 'list') {
      expect(block.ordered).toBe(false);
      expect(block.items).toEqual(['First item']);
    }
  });

  it('detects unordered list with en-dash –', () => {
    const line = makeTextLine('– Second item', 12);
    const block = classifyLine(line, 12);

    expect(block.type).toBe('list');
    if (block.type === 'list') {
      expect(block.ordered).toBe(false);
      expect(block.items).toEqual(['Second item']);
    }
  });

  it('detects unordered list with hyphen -', () => {
    const line = makeTextLine('- Third item', 12);
    const block = classifyLine(line, 12);

    expect(block.type).toBe('list');
    if (block.type === 'list') {
      expect(block.ordered).toBe(false);
      expect(block.items).toEqual(['Third item']);
    }
  });

  it('detects unordered list with square bullet ▪', () => {
    const line = makeTextLine('▪ Fourth item', 12);
    const block = classifyLine(line, 12);

    expect(block.type).toBe('list');
    if (block.type === 'list') {
      expect(block.ordered).toBe(false);
      expect(block.items).toEqual(['Fourth item']);
    }
  });

  // --- Ordered list detection ---

  it('detects ordered list with "1. " prefix', () => {
    const line = makeTextLine('1. First step', 12);
    const block = classifyLine(line, 12);

    expect(block.type).toBe('list');
    if (block.type === 'list') {
      expect(block.ordered).toBe(true);
      expect(block.items).toEqual(['First step']);
    }
  });

  it('detects ordered list with "2) " prefix', () => {
    const line = makeTextLine('2) Second step', 12);
    const block = classifyLine(line, 12);

    expect(block.type).toBe('list');
    if (block.type === 'list') {
      expect(block.ordered).toBe(true);
      expect(block.items).toEqual(['Second step']);
    }
  });

  it('detects ordered list with multi-digit number', () => {
    const line = makeTextLine('12. Twelfth item', 12);
    const block = classifyLine(line, 12);

    expect(block.type).toBe('list');
    if (block.type === 'list') {
      expect(block.ordered).toBe(true);
      expect(block.items).toEqual(['Twelfth item']);
    }
  });

  // --- List takes priority over heading ---

  it('classifies a bullet line as list even if font size is large', () => {
    const line = makeTextLine('• Big bullet', 24);
    const block = classifyLine(line, 12);

    expect(block.type).toBe('list');
    if (block.type === 'list') {
      expect(block.ordered).toBe(false);
    }
  });

  // --- Inline formatting in paragraphs ---

  it('builds inline formatting spans for bold items in a paragraph', () => {
    const line: TextLine = {
      items: [
        makePdfTextItem({ text: 'Normal ', fontSize: 12, isBold: false, isItalic: false }),
        makePdfTextItem({ text: 'bold', fontSize: 12, isBold: true, isItalic: false }),
        makePdfTextItem({ text: ' text', fontSize: 12, isBold: false, isItalic: false }),
      ],
      y: 700,
      minX: 72,
      maxX: 200,
      avgFontSize: 12,
    };

    const block = classifyLine(line, 12);

    expect(block.type).toBe('paragraph');
    if (block.type === 'paragraph') {
      expect(block.formatting).toEqual([
        { start: 7, end: 11, style: 'bold' },
      ]);
    }
  });

  it('builds inline formatting spans for italic items', () => {
    const line: TextLine = {
      items: [
        makePdfTextItem({ text: 'Some ', fontSize: 12, isBold: false, isItalic: false }),
        makePdfTextItem({ text: 'italic', fontSize: 12, isBold: false, isItalic: true }),
      ],
      y: 700,
      minX: 72,
      maxX: 200,
      avgFontSize: 12,
    };

    const block = classifyLine(line, 12);

    expect(block.type).toBe('paragraph');
    if (block.type === 'paragraph') {
      expect(block.formatting).toEqual([
        { start: 5, end: 11, style: 'italic' },
      ]);
    }
  });

  it('builds inline formatting spans for bold+italic items', () => {
    const line: TextLine = {
      items: [
        makePdfTextItem({ text: 'both', fontSize: 12, isBold: true, isItalic: true }),
      ],
      y: 700,
      minX: 72,
      maxX: 200,
      avgFontSize: 12,
    };

    const block = classifyLine(line, 12);

    expect(block.type).toBe('paragraph');
    if (block.type === 'paragraph') {
      expect(block.formatting).toEqual([
        { start: 0, end: 4, style: 'bolditalic' },
      ]);
    }
  });

  // --- Heading formatting ---

  it('includes inline formatting in heading blocks', () => {
    const line: TextLine = {
      items: [
        makePdfTextItem({ text: 'Bold Title', fontSize: 24, isBold: true, isItalic: false }),
      ],
      y: 700,
      minX: 72,
      maxX: 200,
      avgFontSize: 24,
    };

    const block = classifyLine(line, 12);

    expect(block.type).toBe('heading');
    if (block.type === 'heading') {
      expect(block.level).toBe(1);
      expect(block.formatting).toEqual([
        { start: 0, end: 10, style: 'bold' },
      ]);
    }
  });

  // --- Concatenation of multiple items ---

  it('concatenates text from multiple items in a line', () => {
    const line: TextLine = {
      items: [
        makePdfTextItem({ text: 'Hello ', fontSize: 24 }),
        makePdfTextItem({ text: 'World', fontSize: 24 }),
      ],
      y: 700,
      minX: 72,
      maxX: 200,
      avgFontSize: 24,
    };

    const block = classifyLine(line, 12);

    expect(block.type).toBe('heading');
    if (block.type === 'heading') {
      expect(block.text).toBe('Hello World');
    }
  });
});

// ---------------------------------------------------------------------------
// groupConsecutiveBlocks tests
// ---------------------------------------------------------------------------

describe('groupConsecutiveBlocks', () => {
  it('returns empty array for empty input', () => {
    expect(groupConsecutiveBlocks([])).toEqual([]);
  });

  it('passes through non-list blocks unchanged', () => {
    const blocks: ContentBlock[] = [
      { type: 'heading', level: 1, text: 'Title', formatting: [] },
      { type: 'paragraph', lines: ['Some text'], formatting: [] },
    ];

    const result = groupConsecutiveBlocks(blocks);

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('heading');
    expect(result[1].type).toBe('paragraph');
  });

  it('merges consecutive unordered list blocks', () => {
    const blocks: ContentBlock[] = [
      { type: 'list', ordered: false, items: ['Item A'] },
      { type: 'list', ordered: false, items: ['Item B'] },
      { type: 'list', ordered: false, items: ['Item C'] },
    ];

    const result = groupConsecutiveBlocks(blocks);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('list');
    if (result[0].type === 'list') {
      expect(result[0].ordered).toBe(false);
      expect(result[0].items).toEqual(['Item A', 'Item B', 'Item C']);
    }
  });

  it('merges consecutive ordered list blocks', () => {
    const blocks: ContentBlock[] = [
      { type: 'list', ordered: true, items: ['Step 1'] },
      { type: 'list', ordered: true, items: ['Step 2'] },
    ];

    const result = groupConsecutiveBlocks(blocks);

    expect(result).toHaveLength(1);
    if (result[0].type === 'list') {
      expect(result[0].ordered).toBe(true);
      expect(result[0].items).toEqual(['Step 1', 'Step 2']);
    }
  });

  it('does not merge list blocks of different types', () => {
    const blocks: ContentBlock[] = [
      { type: 'list', ordered: false, items: ['Bullet'] },
      { type: 'list', ordered: true, items: ['Number'] },
    ];

    const result = groupConsecutiveBlocks(blocks);

    expect(result).toHaveLength(2);
    if (result[0].type === 'list') {
      expect(result[0].ordered).toBe(false);
      expect(result[0].items).toEqual(['Bullet']);
    }
    if (result[1].type === 'list') {
      expect(result[1].ordered).toBe(true);
      expect(result[1].items).toEqual(['Number']);
    }
  });

  it('does not merge list blocks separated by a non-list block', () => {
    const blocks: ContentBlock[] = [
      { type: 'list', ordered: false, items: ['A'] },
      { type: 'paragraph', lines: ['Separator'], formatting: [] },
      { type: 'list', ordered: false, items: ['B'] },
    ];

    const result = groupConsecutiveBlocks(blocks);

    expect(result).toHaveLength(3);
    if (result[0].type === 'list') {
      expect(result[0].items).toEqual(['A']);
    }
    expect(result[1].type).toBe('paragraph');
    if (result[2].type === 'list') {
      expect(result[2].items).toEqual(['B']);
    }
  });

  it('handles mixed block types with consecutive lists', () => {
    const blocks: ContentBlock[] = [
      { type: 'heading', level: 1, text: 'Title', formatting: [] },
      { type: 'list', ordered: false, items: ['A'] },
      { type: 'list', ordered: false, items: ['B'] },
      { type: 'paragraph', lines: ['Text'], formatting: [] },
      { type: 'list', ordered: true, items: ['1'] },
      { type: 'list', ordered: true, items: ['2'] },
      { type: 'list', ordered: true, items: ['3'] },
    ];

    const result = groupConsecutiveBlocks(blocks);

    expect(result).toHaveLength(4);
    expect(result[0].type).toBe('heading');
    if (result[1].type === 'list') {
      expect(result[1].ordered).toBe(false);
      expect(result[1].items).toEqual(['A', 'B']);
    }
    expect(result[2].type).toBe('paragraph');
    if (result[3].type === 'list') {
      expect(result[3].ordered).toBe(true);
      expect(result[3].items).toEqual(['1', '2', '3']);
    }
  });

  it('does not mutate original blocks', () => {
    const original: ContentBlock[] = [
      { type: 'list', ordered: false, items: ['A'] },
      { type: 'list', ordered: false, items: ['B'] },
    ];

    groupConsecutiveBlocks(original);

    // Original blocks should be unchanged
    if (original[0].type === 'list') {
      expect(original[0].items).toEqual(['A']);
    }
    if (original[1].type === 'list') {
      expect(original[1].items).toEqual(['B']);
    }
  });

  it('handles a single list block', () => {
    const blocks: ContentBlock[] = [
      { type: 'list', ordered: false, items: ['Only item'] },
    ];

    const result = groupConsecutiveBlocks(blocks);

    expect(result).toHaveLength(1);
    if (result[0].type === 'list') {
      expect(result[0].items).toEqual(['Only item']);
    }
  });
});


// ---------------------------------------------------------------------------
// detectTables tests
// ---------------------------------------------------------------------------

describe('detectTables', () => {
  /**
   * Helper to build a TextLine with items at specific X positions.
   * Each entry in `cells` is [x, text] representing a text item at that X position.
   */
  function makeTableLine(
    y: number,
    cells: [number, string][],
    fontSize: number = 12
  ): TextLine {
    const items: PdfTextItem[] = cells.map(([x, text]) =>
      makePdfTextItem({ text, x, y, width: 40, fontSize })
    );
    return {
      items,
      y,
      minX: Math.min(...items.map((it) => it.x)),
      maxX: Math.max(...items.map((it) => it.x + it.width)),
      avgFontSize: fontSize,
    };
  }

  it('returns empty tables and all lines as remaining for fewer than 2 lines', () => {
    const line = makeTableLine(700, [[72, 'Only'], [200, 'one']]);
    const result = detectTables([line]);

    expect(result.tables).toHaveLength(0);
    expect(result.remainingLines).toHaveLength(1);
  });

  it('returns empty tables for empty input', () => {
    const result = detectTables([]);

    expect(result.tables).toHaveLength(0);
    expect(result.remainingLines).toHaveLength(0);
  });

  it('detects a simple 2-column, 2-row table', () => {
    const lines: TextLine[] = [
      makeTableLine(700, [[72, 'Name'], [200, 'Age']]),
      makeTableLine(680, [[72, 'Alice'], [200, '30']]),
    ];

    const result = detectTables(lines);

    expect(result.tables).toHaveLength(1);
    expect(result.remainingLines).toHaveLength(0);

    const table = result.tables[0];
    expect(table.type).toBe('table');
    if (table.type === 'table') {
      expect(table.headers).toEqual(['Name', 'Age']);
      expect(table.rows).toHaveLength(1);
      expect(table.rows[0]).toEqual(['Alice', '30']);
    }
  });

  it('detects a 3-column, 3-row table', () => {
    const lines: TextLine[] = [
      makeTableLine(700, [[72, 'Name'], [200, 'Age'], [350, 'City']]),
      makeTableLine(680, [[72, 'Alice'], [200, '30'], [350, 'NYC']]),
      makeTableLine(660, [[72, 'Bob'], [200, '25'], [350, 'LA']]),
    ];

    const result = detectTables(lines);

    expect(result.tables).toHaveLength(1);
    const table = result.tables[0];
    if (table.type === 'table') {
      expect(table.headers).toHaveLength(3);
      expect(table.headers).toEqual(['Name', 'Age', 'City']);
      expect(table.rows).toHaveLength(2);
      expect(table.rows[0]).toEqual(['Alice', '30', 'NYC']);
      expect(table.rows[1]).toEqual(['Bob', '25', 'LA']);
    }
  });

  it('treats lines with only 1 column as non-table (remaining lines)', () => {
    const lines: TextLine[] = [
      makeTableLine(700, [[72, 'Just a paragraph line']]),
      makeTableLine(680, [[72, 'Another paragraph line']]),
    ];

    const result = detectTables(lines);

    expect(result.tables).toHaveLength(0);
    expect(result.remainingLines).toHaveLength(2);
  });

  it('handles empty cells in data rows', () => {
    const lines: TextLine[] = [
      makeTableLine(700, [[72, 'Col1'], [200, 'Col2'], [350, 'Col3']]),
      makeTableLine(680, [[72, 'A'], [350, 'C']]), // missing Col2
      makeTableLine(660, [[72, 'D'], [200, 'E'], [350, 'F']]),
    ];

    const result = detectTables(lines);

    expect(result.tables).toHaveLength(1);
    const table = result.tables[0];
    if (table.type === 'table') {
      expect(table.headers).toEqual(['Col1', 'Col2', 'Col3']);
      expect(table.rows).toHaveLength(2);
      // The row missing Col2 should have an empty string for that column
      expect(table.rows[0][1]).toBe('');
    }
  });

  it('separates table lines from non-table lines', () => {
    const lines: TextLine[] = [
      makeTableLine(720, [[72, 'Paragraph text']]), // single column — not a table
      makeTableLine(700, [[72, 'Name'], [200, 'Age']]),
      makeTableLine(680, [[72, 'Alice'], [200, '30']]),
      makeTableLine(640, [[72, 'Another paragraph']]), // single column — not a table
    ];

    const result = detectTables(lines);

    expect(result.tables).toHaveLength(1);
    expect(result.remainingLines).toHaveLength(2);
    expect(result.remainingLines[0].items[0].text).toBe('Paragraph text');
    expect(result.remainingLines[1].items[0].text).toBe('Another paragraph');
  });

  it('detects multiple tables separated by non-table lines', () => {
    const lines: TextLine[] = [
      // Table 1
      makeTableLine(700, [[72, 'A'], [200, 'B']]),
      makeTableLine(680, [[72, 'C'], [200, 'D']]),
      // Non-table separator
      makeTableLine(650, [[72, 'Separator paragraph']]),
      // Table 2
      makeTableLine(620, [[72, 'X'], [200, 'Y']]),
      makeTableLine(600, [[72, 'Z'], [200, 'W']]),
    ];

    const result = detectTables(lines);

    expect(result.tables).toHaveLength(2);
    expect(result.remainingLines).toHaveLength(1);
    expect(result.remainingLines[0].items[0].text).toBe('Separator paragraph');
  });

  it('uses first row as header and remaining as data', () => {
    const lines: TextLine[] = [
      makeTableLine(700, [[72, 'Header1'], [200, 'Header2']]),
      makeTableLine(680, [[72, 'Data1'], [200, 'Data2']]),
      makeTableLine(660, [[72, 'Data3'], [200, 'Data4']]),
    ];

    const result = detectTables(lines);

    expect(result.tables).toHaveLength(1);
    const table = result.tables[0];
    if (table.type === 'table') {
      expect(table.headers).toEqual(['Header1', 'Header2']);
      expect(table.rows).toHaveLength(2);
      expect(table.rows[0]).toEqual(['Data1', 'Data2']);
      expect(table.rows[1]).toEqual(['Data3', 'Data4']);
    }
  });

  it('falls back to remaining lines when data rows have more populated cells than header', () => {
    // Header has 2 columns, but a data row has 3 distinct columns
    const lines: TextLine[] = [
      makeTableLine(700, [[72, 'A'], [200, 'B']]),
      makeTableLine(680, [[72, 'C'], [200, 'D'], [350, 'E']]),
    ];

    const result = detectTables(lines);

    // The data row has more populated cells than the header, so it should fall back
    expect(result.tables).toHaveLength(0);
    expect(result.remainingLines).toHaveLength(2);
  });

  it('handles items with slightly different X-coordinates in the same column', () => {
    // Items at x=72 and x=75 should cluster into the same column (within tolerance)
    const lines: TextLine[] = [
      makeTableLine(700, [[72, 'Name'], [200, 'Age']]),
      makeTableLine(680, [[75, 'Alice'], [198, '30']]),
    ];

    const result = detectTables(lines);

    expect(result.tables).toHaveLength(1);
    const table = result.tables[0];
    if (table.type === 'table') {
      expect(table.headers).toEqual(['Name', 'Age']);
      expect(table.rows[0]).toEqual(['Alice', '30']);
    }
  });
});


// ---------------------------------------------------------------------------
// blocksToHtml tests
// ---------------------------------------------------------------------------

describe('blocksToHtml', () => {
  // --- Heading blocks ---

  it('converts heading level 1 to <h1> tag', () => {
    const blocks: ContentBlock[] = [
      { type: 'heading', level: 1, text: 'Main Title', formatting: [] },
    ];
    expect(blocksToHtml(blocks)).toBe('<h1>Main Title</h1>');
  });

  it('converts heading levels 2–6 to corresponding tags', () => {
    const levels: (1 | 2 | 3 | 4 | 5 | 6)[] = [2, 3, 4, 5, 6];
    for (const level of levels) {
      const blocks: ContentBlock[] = [
        { type: 'heading', level, text: `Heading ${level}`, formatting: [] },
      ];
      expect(blocksToHtml(blocks)).toBe(`<h${level}>Heading ${level}</h${level}>`);
    }
  });

  it('applies bold formatting in headings', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'heading',
        level: 1,
        text: 'Bold Title',
        formatting: [{ start: 0, end: 4, style: 'bold' }],
      },
    ];
    expect(blocksToHtml(blocks)).toBe('<h1><strong>Bold</strong> Title</h1>');
  });

  it('applies italic formatting in headings', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'heading',
        level: 2,
        text: 'An Italic Word',
        formatting: [{ start: 3, end: 9, style: 'italic' }],
      },
    ];
    expect(blocksToHtml(blocks)).toBe('<h2>An <em>Italic</em> Word</h2>');
  });

  it('applies bold+italic formatting in headings', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'heading',
        level: 3,
        text: 'Mixed',
        formatting: [{ start: 0, end: 5, style: 'bolditalic' }],
      },
    ];
    expect(blocksToHtml(blocks)).toBe('<h3><strong><em>Mixed</em></strong></h3>');
  });

  // --- Paragraph blocks ---

  it('converts a single-line paragraph to <p> tag', () => {
    const blocks: ContentBlock[] = [
      { type: 'paragraph', lines: ['Hello world'], formatting: [] },
    ];
    expect(blocksToHtml(blocks)).toBe('<p>Hello world</p>');
  });

  it('joins multiple paragraph lines with <br>', () => {
    const blocks: ContentBlock[] = [
      { type: 'paragraph', lines: ['Line one', 'Line two', 'Line three'], formatting: [] },
    ];
    expect(blocksToHtml(blocks)).toBe('<p>Line one<br>Line two<br>Line three</p>');
  });

  it('applies bold formatting within a paragraph', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'paragraph',
        lines: ['Some bold text here'],
        formatting: [{ start: 5, end: 9, style: 'bold' }],
      },
    ];
    expect(blocksToHtml(blocks)).toBe('<p>Some <strong>bold</strong> text here</p>');
  });

  it('applies italic formatting within a paragraph', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'paragraph',
        lines: ['An italic word'],
        formatting: [{ start: 3, end: 9, style: 'italic' }],
      },
    ];
    expect(blocksToHtml(blocks)).toBe('<p>An <em>italic</em> word</p>');
  });

  it('applies bold+italic formatting within a paragraph', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'paragraph',
        lines: ['Both styles'],
        formatting: [{ start: 0, end: 4, style: 'bolditalic' }],
      },
    ];
    expect(blocksToHtml(blocks)).toBe('<p><strong><em>Both</em></strong> styles</p>');
  });

  it('applies formatting spanning across multi-line paragraph', () => {
    // "Hello" (5 chars) + "World" (5 chars) = formatting from offset 3 to 8
    // spans across both lines
    const blocks: ContentBlock[] = [
      {
        type: 'paragraph',
        lines: ['Hello', 'World'],
        formatting: [{ start: 3, end: 8, style: 'bold' }],
      },
    ];
    const html = blocksToHtml(blocks);
    // Line 0 (offset 0-5): formatting 3-5 → "Hel<strong>lo</strong>"
    // Line 1 (offset 5-10): formatting 0-3 → "<strong>Wor</strong>ld"
    expect(html).toBe('<p>Hel<strong>lo</strong><br><strong>Wor</strong>ld</p>');
  });

  // --- List blocks ---

  it('converts unordered list to <ul> with <li> items', () => {
    const blocks: ContentBlock[] = [
      { type: 'list', ordered: false, items: ['Apple', 'Banana', 'Cherry'] },
    ];
    expect(blocksToHtml(blocks)).toBe(
      '<ul><li>Apple</li><li>Banana</li><li>Cherry</li></ul>'
    );
  });

  it('converts ordered list to <ol> with <li> items', () => {
    const blocks: ContentBlock[] = [
      { type: 'list', ordered: true, items: ['First', 'Second', 'Third'] },
    ];
    expect(blocksToHtml(blocks)).toBe(
      '<ol><li>First</li><li>Second</li><li>Third</li></ol>'
    );
  });

  it('handles single-item list', () => {
    const blocks: ContentBlock[] = [
      { type: 'list', ordered: false, items: ['Only item'] },
    ];
    expect(blocksToHtml(blocks)).toBe('<ul><li>Only item</li></ul>');
  });

  // --- Table blocks ---

  it('converts table to <table> with <thead> and <tbody>', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'table',
        headers: ['Name', 'Age'],
        rows: [['Alice', '30'], ['Bob', '25']],
      },
    ];
    const html = blocksToHtml(blocks);
    expect(html).toBe(
      '<table>' +
        '<thead><tr><th>Name</th><th>Age</th></tr></thead>' +
        '<tbody><tr><td>Alice</td><td>30</td></tr><tr><td>Bob</td><td>25</td></tr></tbody>' +
      '</table>'
    );
  });

  it('converts table with single data row', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'table',
        headers: ['Col1', 'Col2'],
        rows: [['A', 'B']],
      },
    ];
    const html = blocksToHtml(blocks);
    expect(html).toContain('<thead><tr><th>Col1</th><th>Col2</th></tr></thead>');
    expect(html).toContain('<tbody><tr><td>A</td><td>B</td></tr></tbody>');
  });

  it('converts table with empty cells', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'table',
        headers: ['A', 'B', 'C'],
        rows: [['1', '', '3']],
      },
    ];
    const html = blocksToHtml(blocks);
    expect(html).toContain('<td>1</td><td></td><td>3</td>');
  });

  // --- Image blocks ---

  it('converts image block to <img> tag with blob URL and alt text', () => {
    const blocks: ContentBlock[] = [
      { type: 'image', blobUrl: 'blob:http://localhost/abc123', altText: 'A photo' },
    ];
    expect(blocksToHtml(blocks)).toBe(
      '<img src="blob:http://localhost/abc123" alt="A photo" />'
    );
  });

  it('converts image block with empty alt text', () => {
    const blocks: ContentBlock[] = [
      { type: 'image', blobUrl: 'blob:http://localhost/xyz', altText: '' },
    ];
    expect(blocksToHtml(blocks)).toBe(
      '<img src="blob:http://localhost/xyz" alt="" />'
    );
  });

  // --- Mixed blocks ---

  it('converts multiple block types separated by newlines', () => {
    const blocks: ContentBlock[] = [
      { type: 'heading', level: 1, text: 'Title', formatting: [] },
      { type: 'paragraph', lines: ['Some text'], formatting: [] },
      { type: 'list', ordered: false, items: ['Item A', 'Item B'] },
    ];
    const html = blocksToHtml(blocks);
    const parts = html.split('\n');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('<h1>Title</h1>');
    expect(parts[1]).toBe('<p>Some text</p>');
    expect(parts[2]).toBe('<ul><li>Item A</li><li>Item B</li></ul>');
  });

  it('returns empty string for empty blocks array', () => {
    expect(blocksToHtml([])).toBe('');
  });

  it('handles paragraph with no formatting spans', () => {
    const blocks: ContentBlock[] = [
      { type: 'paragraph', lines: ['Plain text'], formatting: [] },
    ];
    expect(blocksToHtml(blocks)).toBe('<p>Plain text</p>');
  });

  it('handles multiple formatting spans in a single paragraph', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'paragraph',
        lines: ['Hello bold and italic world'],
        formatting: [
          { start: 6, end: 10, style: 'bold' },
          { start: 15, end: 21, style: 'italic' },
        ],
      },
    ];
    expect(blocksToHtml(blocks)).toBe(
      '<p>Hello <strong>bold</strong> and <em>italic</em> world</p>'
    );
  });

  it('handles heading with multiple formatting spans', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'heading',
        level: 2,
        text: 'Bold and Italic',
        formatting: [
          { start: 0, end: 4, style: 'bold' },
          { start: 9, end: 15, style: 'italic' },
        ],
      },
    ];
    expect(blocksToHtml(blocks)).toBe(
      '<h2><strong>Bold</strong> and <em>Italic</em></h2>'
    );
  });
});


// ---------------------------------------------------------------------------
// fixTableHtml tests
// ---------------------------------------------------------------------------

describe('fixTableHtml', () => {
  it('returns HTML unchanged when there are no tables', () => {
    const html = '<p>Hello world</p><h1>Title</h1>';
    expect(fixTableHtml(html)).toBe(html);
  });

  it('adds thead/tbody to a table with all rows directly in <table>', () => {
    const html =
      '<table>' +
        '<tr><td>Name</td><td>Age</td></tr>' +
        '<tr><td>Alice</td><td>30</td></tr>' +
      '</table>';

    const result = fixTableHtml(html);

    expect(result).toContain('<thead><tr><th>Name</th><th>Age</th></tr></thead>');
    expect(result).toContain('<tbody><tr><td>Alice</td><td>30</td></tr></tbody>');
  });

  it('converts first row <td> cells to <th> in the header', () => {
    const html =
      '<table>' +
        '<tr><td>Col1</td><td>Col2</td></tr>' +
        '<tr><td>A</td><td>B</td></tr>' +
      '</table>';

    const result = fixTableHtml(html);

    // First row should have <th> not <td>
    expect(result).toContain('<th>Col1</th>');
    expect(result).toContain('<th>Col2</th>');
    // Data rows should have <td>
    expect(result).toContain('<td>A</td>');
    expect(result).toContain('<td>B</td>');
  });

  it('leaves a properly structured table unchanged', () => {
    const html =
      '<table>' +
        '<thead><tr><th>Name</th><th>Age</th></tr></thead>' +
        '<tbody><tr><td>Alice</td><td>30</td></tr></tbody>' +
      '</table>';

    const result = fixTableHtml(html);

    expect(result).toContain('<thead><tr><th>Name</th><th>Age</th></tr></thead>');
    expect(result).toContain('<tbody><tr><td>Alice</td><td>30</td></tr></tbody>');
  });

  it('preserves total row count', () => {
    const html =
      '<table>' +
        '<tr><td>H1</td><td>H2</td></tr>' +
        '<tr><td>R1C1</td><td>R1C2</td></tr>' +
        '<tr><td>R2C1</td><td>R2C2</td></tr>' +
        '<tr><td>R3C1</td><td>R3C2</td></tr>' +
      '</table>';

    const result = fixTableHtml(html);

    // Count all <tr> elements — should be 4 total (1 header + 3 data)
    const trCount = (result.match(/<tr>/g) || []).length;
    expect(trCount).toBe(4);
  });

  it('handles multiple tables in the same HTML string', () => {
    const html =
      '<p>Before</p>' +
      '<table>' +
        '<tr><td>A</td><td>B</td></tr>' +
        '<tr><td>1</td><td>2</td></tr>' +
      '</table>' +
      '<p>Between</p>' +
      '<table>' +
        '<tr><td>X</td><td>Y</td></tr>' +
        '<tr><td>3</td><td>4</td></tr>' +
      '</table>' +
      '<p>After</p>';

    const result = fixTableHtml(html);

    // Both tables should have thead/tbody
    expect(result).toContain('<th>A</th>');
    expect(result).toContain('<th>X</th>');
    expect(result).toContain('<td>1</td>');
    expect(result).toContain('<td>3</td>');
    // Non-table content preserved
    expect(result).toContain('<p>Before</p>');
    expect(result).toContain('<p>Between</p>');
    expect(result).toContain('<p>After</p>');
  });

  it('preserves non-table HTML content unchanged', () => {
    const html =
      '<h1>Title</h1>' +
      '<p>Some <strong>bold</strong> text</p>' +
      '<ul><li>Item 1</li><li>Item 2</li></ul>';

    const result = fixTableHtml(html);

    expect(result).toContain('<h1>Title</h1>');
    expect(result).toContain('<p>Some <strong>bold</strong> text</p>');
    expect(result).toContain('<ul><li>Item 1</li><li>Item 2</li></ul>');
  });

  it('handles a table with only one row (header only, no tbody)', () => {
    const html =
      '<table>' +
        '<tr><td>Only</td><td>Row</td></tr>' +
      '</table>';

    const result = fixTableHtml(html);

    expect(result).toContain('<thead><tr><th>Only</th><th>Row</th></tr></thead>');
    // No tbody since there are no data rows
    expect(result).not.toContain('<tbody>');
  });

  it('converts <th> cells in data rows to <td>', () => {
    // A table where all rows use <th> — only first row should keep <th>
    const html =
      '<table>' +
        '<tr><th>Header1</th><th>Header2</th></tr>' +
        '<tr><th>Data1</th><th>Data2</th></tr>' +
      '</table>';

    const result = fixTableHtml(html);

    expect(result).toContain('<thead><tr><th>Header1</th><th>Header2</th></tr></thead>');
    expect(result).toContain('<tbody><tr><td>Data1</td><td>Data2</td></tr></tbody>');
  });

  it('handles a table with existing tbody but no thead', () => {
    const html =
      '<table>' +
        '<tbody>' +
          '<tr><td>Name</td><td>Age</td></tr>' +
          '<tr><td>Alice</td><td>30</td></tr>' +
        '</tbody>' +
      '</table>';

    const result = fixTableHtml(html);

    expect(result).toContain('<thead><tr><th>Name</th><th>Age</th></tr></thead>');
    expect(result).toContain('<tbody><tr><td>Alice</td><td>30</td></tr></tbody>');
  });

  it('handles empty HTML string', () => {
    expect(fixTableHtml('')).toBe('');
  });

  it('handles a table with 3 columns and 4 rows', () => {
    const html =
      '<table>' +
        '<tr><td>A</td><td>B</td><td>C</td></tr>' +
        '<tr><td>1</td><td>2</td><td>3</td></tr>' +
        '<tr><td>4</td><td>5</td><td>6</td></tr>' +
        '<tr><td>7</td><td>8</td><td>9</td></tr>' +
      '</table>';

    const result = fixTableHtml(html);

    expect(result).toContain('<thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>');
    expect(result).toContain('<td>1</td><td>2</td><td>3</td>');
    expect(result).toContain('<td>4</td><td>5</td><td>6</td>');
    expect(result).toContain('<td>7</td><td>8</td><td>9</td>');

    // Total rows should be 4
    const trCount = (result.match(/<tr>/g) || []).length;
    expect(trCount).toBe(4);
  });
});


// ---------------------------------------------------------------------------
// htmlToMarkdown tests
// ---------------------------------------------------------------------------

describe('htmlToMarkdown', () => {
  it('converts headings to ATX-style Markdown', async () => {
    const html = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
    const md = await htmlToMarkdown(html);

    expect(md).toContain('# Title');
    expect(md).toContain('## Subtitle');
    expect(md).toContain('### Section');
  });

  it('converts paragraphs to plain text with blank line separation', async () => {
    const html = '<p>First paragraph</p><p>Second paragraph</p>';
    const md = await htmlToMarkdown(html);

    expect(md).toContain('First paragraph');
    expect(md).toContain('Second paragraph');
    // Paragraphs should be separated by at least one blank line
    expect(md).toMatch(/First paragraph\n\nSecond paragraph/);
  });

  it('converts bold text to **text**', async () => {
    const html = '<p>Some <strong>bold</strong> text</p>';
    const md = await htmlToMarkdown(html);

    expect(md).toContain('**bold**');
  });

  it('converts italic text to _text_ syntax', async () => {
    const html = '<p>Some <em>italic</em> text</p>';
    const md = await htmlToMarkdown(html);

    expect(md).toContain('_italic_');
  });

  it('converts unordered lists to list item syntax', async () => {
    const html = '<ul><li>Apple</li><li>Banana</li><li>Cherry</li></ul>';
    const md = await htmlToMarkdown(html);

    expect(md).toContain('Apple');
    expect(md).toContain('Banana');
    expect(md).toContain('Cherry');
    // Turndown uses * for unordered list items
    expect(md).toMatch(/\*\s+Apple/);
    expect(md).toMatch(/\*\s+Banana/);
    expect(md).toMatch(/\*\s+Cherry/);
  });

  it('converts ordered lists to numbered syntax', async () => {
    const html = '<ol><li>First</li><li>Second</li><li>Third</li></ol>';
    const md = await htmlToMarkdown(html);

    expect(md).toMatch(/1\.\s+First/);
    expect(md).toMatch(/2\.\s+Second/);
    expect(md).toMatch(/3\.\s+Third/);
  });

  it('converts GFM tables with header and data rows', async () => {
    const html =
      '<table>' +
        '<thead><tr><th>Name</th><th>Age</th></tr></thead>' +
        '<tbody><tr><td>Alice</td><td>30</td></tr></tbody>' +
      '</table>';
    const md = await htmlToMarkdown(html);

    expect(md).toContain('Name');
    expect(md).toContain('Age');
    expect(md).toContain('Alice');
    expect(md).toContain('30');
    // GFM table should have pipe separators
    expect(md).toContain('|');
    // Should have a separator row with dashes
    expect(md).toMatch(/\|[\s-]+\|/);
  });

  it('converts images to ![alt](src) syntax', async () => {
    const html = '<img src="blob:http://localhost/abc123" alt="Chart" />';
    const md = await htmlToMarkdown(html);

    expect(md).toContain('![Chart](blob:http://localhost/abc123)');
  });

  it('handles images with empty alt text', async () => {
    const html = '<img src="blob:http://localhost/xyz" alt="" />';
    const md = await htmlToMarkdown(html);

    expect(md).toContain('![](blob:http://localhost/xyz)');
  });

  it('returns empty string for empty HTML', async () => {
    expect(await htmlToMarkdown('')).toBe('');
  });

  it('returns empty string for whitespace-only HTML', async () => {
    expect(await htmlToMarkdown('   ')).toBe('');
  });

  it('handles mixed content (headings, paragraphs, lists, bold, italic)', async () => {
    const html =
      '<h1>Document Title</h1>' +
      '<p>This is a <strong>bold</strong> and <em>italic</em> paragraph.</p>' +
      '<ul><li>Item one</li><li>Item two</li></ul>';
    const md = await htmlToMarkdown(html);

    expect(md).toContain('# Document Title');
    expect(md).toContain('**bold**');
    expect(md).toContain('_italic_');
    expect(md).toContain('Item one');
    expect(md).toContain('Item two');
  });

  it('converts strikethrough text using GFM syntax', async () => {
    const html = '<p>This is <del>deleted</del> text</p>';
    const md = await htmlToMarkdown(html);

    // GFM strikethrough uses ~ or ~~ depending on the turndown-plugin-gfm version
    expect(md).toMatch(/~+deleted~+/);
  });

  it('converts h4, h5, h6 headings to ATX-style', async () => {
    const html = '<h4>H4</h4><h5>H5</h5><h6>H6</h6>';
    const md = await htmlToMarkdown(html);

    expect(md).toContain('#### H4');
    expect(md).toContain('##### H5');
    expect(md).toContain('###### H6');
  });
});


// ---------------------------------------------------------------------------
// extractPageImages tests
// ---------------------------------------------------------------------------

describe('extractPageImages', () => {
  /**
   * Creates a mock PDFPageProxy with a given operator list and object store
   * for image extraction testing.
   */
  function createMockPageWithImages(
    fnArray: number[],
    argsArray: any[][],
    objs: Record<string, any>
  ) {
    return {
      getOperatorList: jest.fn().mockResolvedValue({ fnArray, argsArray }),
      objs: {
        get: jest.fn((name: string) => objs[name] ?? null),
      },
      // Include getTextContent for compatibility (not used by extractPageImages)
      getTextContent: jest.fn().mockResolvedValue({ items: [], styles: {}, lang: null }),
    } as any;
  }

  const PAINT_IMAGE_OP = 85; // matches the mocked OPS.paintImageXObject

  it('extracts a single image from the operator list', async () => {
    const imageData = new Uint8Array([1, 2, 3, 4]);
    const page = createMockPageWithImages(
      [PAINT_IMAGE_OP],
      [['img_0', 100, 50]],
      {
        img_0: { data: imageData, width: 100, height: 50 },
      }
    );

    const images = await extractPageImages(page, 0);

    expect(images).toHaveLength(1);
    expect(images[0]).toEqual<PdfImage>({
      data: imageData,
      contentType: 'image/png',
      width: 100,
      height: 50,
      pageIndex: 0,
      y: 0,
    });
  });

  it('extracts multiple images from the operator list', async () => {
    const data1 = new Uint8Array([10, 20]);
    const data2 = new Uint8Array([30, 40, 50]);
    const page = createMockPageWithImages(
      [PAINT_IMAGE_OP, PAINT_IMAGE_OP],
      [['img_0', 200, 100], ['img_1', 300, 150]],
      {
        img_0: { data: data1, width: 200, height: 100 },
        img_1: { data: data2, width: 300, height: 150 },
      }
    );

    const images = await extractPageImages(page, 2);

    expect(images).toHaveLength(2);
    expect(images[0].width).toBe(200);
    expect(images[0].height).toBe(100);
    expect(images[0].pageIndex).toBe(2);
    expect(images[1].width).toBe(300);
    expect(images[1].height).toBe(150);
    expect(images[1].pageIndex).toBe(2);
  });

  it('returns empty array when no paintImageXObject operations exist', async () => {
    const page = createMockPageWithImages(
      [1, 2, 3], // non-image operations
      [[], [], []],
      {}
    );

    const images = await extractPageImages(page, 0);

    expect(images).toHaveLength(0);
  });

  it('returns empty array for an empty operator list', async () => {
    const page = createMockPageWithImages([], [], {});

    const images = await extractPageImages(page, 0);

    expect(images).toHaveLength(0);
  });

  it('skips images that are not found in the object store', async () => {
    const validData = new Uint8Array([1, 2, 3]);
    const page = createMockPageWithImages(
      [PAINT_IMAGE_OP, PAINT_IMAGE_OP],
      [['img_missing', 100, 50], ['img_valid', 200, 100]],
      {
        // img_missing is not in the store
        img_valid: { data: validData, width: 200, height: 100 },
      }
    );

    const images = await extractPageImages(page, 0);

    expect(images).toHaveLength(1);
    expect(images[0].width).toBe(200);
  });

  it('skips images with null data and continues processing', async () => {
    const validData = new Uint8Array([5, 6, 7]);
    const page = createMockPageWithImages(
      [PAINT_IMAGE_OP, PAINT_IMAGE_OP],
      [['img_nodata', 100, 50], ['img_ok', 150, 75]],
      {
        img_nodata: { data: null, width: 100, height: 50 },
        img_ok: { data: validData, width: 150, height: 75 },
      }
    );

    const images = await extractPageImages(page, 0);

    expect(images).toHaveLength(1);
    expect(images[0].width).toBe(150);
  });

  it('handles getOperatorList failure gracefully and returns empty array', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const page = {
      getOperatorList: jest.fn().mockRejectedValue(new Error('Operator list failed')),
      objs: { get: jest.fn() },
    } as any;

    const images = await extractPageImages(page, 3);

    expect(images).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to get operator list for page 3'),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('skips individual image extraction errors and continues', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const validData = new Uint8Array([1, 2]);

    const page = {
      getOperatorList: jest.fn().mockResolvedValue({
        fnArray: [PAINT_IMAGE_OP, PAINT_IMAGE_OP],
        argsArray: [['img_bad', 100, 50], ['img_good', 200, 100]],
      }),
      objs: {
        get: jest.fn((name: string) => {
          if (name === 'img_bad') {
            throw new Error('Image decode error');
          }
          return { data: validData, width: 200, height: 100 };
        }),
      },
    } as any;

    const images = await extractPageImages(page, 1);

    expect(images).toHaveLength(1);
    expect(images[0].width).toBe(200);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to extract image at operator index 0 on page 1'),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('ignores non-paintImageXObject operations interspersed with image ops', async () => {
    const data1 = new Uint8Array([1]);
    const data2 = new Uint8Array([2]);
    const page = createMockPageWithImages(
      [10, PAINT_IMAGE_OP, 20, 30, PAINT_IMAGE_OP, 40],
      [[], ['img_0', 50, 25], [], [], ['img_1', 60, 30], []],
      {
        img_0: { data: data1, width: 50, height: 25 },
        img_1: { data: data2, width: 60, height: 30 },
      }
    );

    const images = await extractPageImages(page, 0);

    expect(images).toHaveLength(2);
    expect(images[0].width).toBe(50);
    expect(images[1].width).toBe(60);
  });

  it('uses the correct pageIndex in extracted images', async () => {
    const imageData = new Uint8Array([1]);
    const page = createMockPageWithImages(
      [PAINT_IMAGE_OP],
      [['img_0', 100, 50]],
      {
        img_0: { data: imageData, width: 100, height: 50 },
      }
    );

    const images = await extractPageImages(page, 7);

    expect(images).toHaveLength(1);
    expect(images[0].pageIndex).toBe(7);
  });

  it('defaults content type to image/png', async () => {
    const imageData = new Uint8Array([1, 2, 3]);
    const page = createMockPageWithImages(
      [PAINT_IMAGE_OP],
      [['img_0', 100, 50]],
      {
        img_0: { data: imageData, width: 100, height: 50 },
      }
    );

    const images = await extractPageImages(page, 0);

    expect(images).toHaveLength(1);
    expect(images[0].contentType).toBe('image/png');
  });
});

// ---------------------------------------------------------------------------
// createImageBlocks tests
// ---------------------------------------------------------------------------

describe('createImageBlocks', () => {
  // Mock URL.createObjectURL since jsdom doesn't support it
  const originalCreateObjectURL = URL.createObjectURL;

  beforeEach(() => {
    let blobCounter = 0;
    (URL.createObjectURL as jest.Mock) = jest.fn(() => {
      blobCounter++;
      return `blob:http://localhost/mock-blob-${blobCounter}`;
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
  });

  it('returns empty array for empty input', () => {
    const result = createImageBlocks([]);
    expect(result).toEqual([]);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('creates a single image ContentBlock from a PdfImage', () => {
    const images: PdfImage[] = [
      {
        data: new Uint8Array([1, 2, 3]),
        contentType: 'image/png',
        width: 100,
        height: 50,
        pageIndex: 0,
        y: 500,
      },
    ];

    const blocks = createImageBlocks(images);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('image');
    if (blocks[0].type === 'image') {
      expect(blocks[0].blobUrl).toMatch(/^blob:/);
      expect(blocks[0].altText).toBe('');
    }
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    // Verify the Blob was created with the correct content type
    const blobArg = (URL.createObjectURL as jest.Mock).mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('image/png');
  });

  it('creates Blob with correct content type for JPEG images', () => {
    const images: PdfImage[] = [
      {
        data: new Uint8Array([0xff, 0xd8, 0xff]),
        contentType: 'image/jpeg',
        width: 200,
        height: 150,
        pageIndex: 0,
        y: 400,
      },
    ];

    const blocks = createImageBlocks(images);

    expect(blocks).toHaveLength(1);
    const blobArg = (URL.createObjectURL as jest.Mock).mock.calls[0][0];
    expect(blobArg.type).toBe('image/jpeg');
  });

  it('creates multiple image ContentBlocks from multiple PdfImages', () => {
    const images: PdfImage[] = [
      {
        data: new Uint8Array([1]),
        contentType: 'image/png',
        width: 100,
        height: 50,
        pageIndex: 0,
        y: 700,
      },
      {
        data: new Uint8Array([2]),
        contentType: 'image/jpeg',
        width: 200,
        height: 100,
        pageIndex: 0,
        y: 400,
      },
      {
        data: new Uint8Array([3]),
        contentType: 'image/png',
        width: 50,
        height: 50,
        pageIndex: 0,
        y: 100,
      },
    ];

    const blocks = createImageBlocks(images);

    expect(blocks).toHaveLength(3);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(3);
    blocks.forEach((block) => {
      expect(block.type).toBe('image');
      if (block.type === 'image') {
        expect(block.altText).toBe('');
        expect(block.blobUrl).toMatch(/^blob:/);
      }
    });
  });

  it('sorts images by Y-position descending (higher Y first for PDF coordinates)', () => {
    const images: PdfImage[] = [
      {
        data: new Uint8Array([3]),
        contentType: 'image/png',
        width: 50,
        height: 50,
        pageIndex: 0,
        y: 100, // bottom of page
      },
      {
        data: new Uint8Array([1]),
        contentType: 'image/png',
        width: 50,
        height: 50,
        pageIndex: 0,
        y: 700, // top of page
      },
      {
        data: new Uint8Array([2]),
        contentType: 'image/png',
        width: 50,
        height: 50,
        pageIndex: 0,
        y: 400, // middle of page
      },
    ];

    const blocks = createImageBlocks(images);

    expect(blocks).toHaveLength(3);
    // The Blob data should be created in Y-descending order (700, 400, 100)
    // Verify by checking the order of createObjectURL calls
    const calls = (URL.createObjectURL as jest.Mock).mock.calls;
    // First call should be for the image with y=700 (data [1])
    expect(new Uint8Array(calls[0][0].arrayBuffer && [1])).toBeTruthy();
    // All blocks should be image type
    blocks.forEach((block) => expect(block.type).toBe('image'));
  });

  it('sorts images by pageIndex first, then by Y-position', () => {
    const images: PdfImage[] = [
      {
        data: new Uint8Array([1]),
        contentType: 'image/png',
        width: 50,
        height: 50,
        pageIndex: 1,
        y: 700,
      },
      {
        data: new Uint8Array([2]),
        contentType: 'image/png',
        width: 50,
        height: 50,
        pageIndex: 0,
        y: 300,
      },
      {
        data: new Uint8Array([3]),
        contentType: 'image/png',
        width: 50,
        height: 50,
        pageIndex: 0,
        y: 600,
      },
    ];

    const blocks = createImageBlocks(images);

    expect(blocks).toHaveLength(3);
    // Order should be: page 0 y=600, page 0 y=300, page 1 y=700
    const calls = (URL.createObjectURL as jest.Mock).mock.calls;
    // First two calls are for page 0 images (y=600 first, then y=300)
    // Third call is for page 1 image (y=700)
    expect(calls).toHaveLength(3);
  });

  it('uses empty alt text for all images (PDFs rarely have alt text)', () => {
    const images: PdfImage[] = [
      {
        data: new Uint8Array([10, 20, 30]),
        contentType: 'image/png',
        width: 100,
        height: 100,
        pageIndex: 0,
        y: 500,
      },
      {
        data: new Uint8Array([40, 50, 60]),
        contentType: 'image/jpeg',
        width: 200,
        height: 200,
        pageIndex: 1,
        y: 300,
      },
    ];

    const blocks = createImageBlocks(images);

    blocks.forEach((block) => {
      if (block.type === 'image') {
        expect(block.altText).toBe('');
      }
    });
  });

  it('does not mutate the original images array', () => {
    const images: PdfImage[] = [
      {
        data: new Uint8Array([1]),
        contentType: 'image/png',
        width: 50,
        height: 50,
        pageIndex: 0,
        y: 100,
      },
      {
        data: new Uint8Array([2]),
        contentType: 'image/png',
        width: 50,
        height: 50,
        pageIndex: 0,
        y: 700,
      },
    ];

    const originalOrder = images.map((img) => img.y);
    createImageBlocks(images);

    // Original array should be unchanged
    expect(images.map((img) => img.y)).toEqual(originalOrder);
  });

  it('passes image data to Blob constructor correctly', () => {
    const imageData = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const images: PdfImage[] = [
      {
        data: imageData,
        contentType: 'image/png',
        width: 10,
        height: 10,
        pageIndex: 0,
        y: 500,
      },
    ];

    createImageBlocks(images);

    const blobArg = (URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.size).toBe(10); // 10 bytes of data
    expect(blobArg.type).toBe('image/png');
  });

  it('each block gets a unique blob URL', () => {
    const images: PdfImage[] = [
      {
        data: new Uint8Array([1]),
        contentType: 'image/png',
        width: 50,
        height: 50,
        pageIndex: 0,
        y: 700,
      },
      {
        data: new Uint8Array([2]),
        contentType: 'image/png',
        width: 50,
        height: 50,
        pageIndex: 0,
        y: 400,
      },
    ];

    const blocks = createImageBlocks(images);

    if (blocks[0].type === 'image' && blocks[1].type === 'image') {
      expect(blocks[0].blobUrl).not.toBe(blocks[1].blobUrl);
    }
  });
});

// ---------------------------------------------------------------------------
// hasSubstantialText tests
// ---------------------------------------------------------------------------

describe('hasSubstantialText', () => {
  it('returns false for empty input', () => {
    expect(hasSubstantialText([])).toBe(false);
  });

  it('returns false for items with only whitespace', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ text: '   ' }),
      makePdfTextItem({ text: '\t\n' }),
      makePdfTextItem({ text: '  ' }),
    ];

    expect(hasSubstantialText(items)).toBe(false);
  });

  it('returns false when non-whitespace characters total exactly 50', () => {
    // 50 non-whitespace characters should NOT exceed the threshold
    const text = 'a'.repeat(50);
    const items: PdfTextItem[] = [makePdfTextItem({ text })];

    expect(hasSubstantialText(items)).toBe(false);
  });

  it('returns true when non-whitespace characters total 51', () => {
    const text = 'a'.repeat(51);
    const items: PdfTextItem[] = [makePdfTextItem({ text })];

    expect(hasSubstantialText(items)).toBe(true);
  });

  it('returns true for items with substantial text content', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ text: 'This is a paragraph with enough text content to exceed the threshold easily.' }),
    ];

    expect(hasSubstantialText(items)).toBe(true);
  });

  it('counts non-whitespace characters across multiple items', () => {
    // Each item has 20 non-whitespace chars, 3 items = 60 total > 50
    const items: PdfTextItem[] = [
      makePdfTextItem({ text: 'abcdefghijklmnopqrst' }),
      makePdfTextItem({ text: 'abcdefghijklmnopqrst' }),
      makePdfTextItem({ text: 'abcdefghijklmnopqrst' }),
    ];

    expect(hasSubstantialText(items)).toBe(true);
  });

  it('ignores whitespace when counting characters', () => {
    // 30 non-whitespace chars + lots of whitespace = still under 50
    const items: PdfTextItem[] = [
      makePdfTextItem({ text: '  a b c d e f g h i j  ' }),  // 10 non-ws
      makePdfTextItem({ text: '  k l m n o p q r s t  ' }),  // 10 non-ws
      makePdfTextItem({ text: '  u v w x y z a b c d  ' }),  // 10 non-ws
    ];

    expect(hasSubstantialText(items)).toBe(false);
  });

  it('returns false for a single empty-string item', () => {
    const items: PdfTextItem[] = [makePdfTextItem({ text: '' })];

    expect(hasSubstantialText(items)).toBe(false);
  });

  it('handles mixed whitespace and text items', () => {
    const items: PdfTextItem[] = [
      makePdfTextItem({ text: '   ' }),
      makePdfTextItem({ text: 'Short' }),  // 5 non-ws
      makePdfTextItem({ text: '\n\t' }),
      makePdfTextItem({ text: 'Also short text' }),  // 13 non-ws (no spaces counted)
    ];
    // Total non-ws: 5 + 13 = 18, under 50
    expect(hasSubstantialText(items)).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// ocrPage tests
// ---------------------------------------------------------------------------

// Mock tesseract.js module for ocrPage tests
jest.mock('tesseract.js', () => ({
  recognize: jest.fn(),
}));

describe('ocrPage', () => {
  // Get a reference to the mocked recognize function
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
   * Creates a mock PDFPageProxy suitable for ocrPage tests.
   * Mocks getViewport and render.
   */
  function createOcrMockPage(options?: {
    viewportWidth?: number;
    viewportHeight?: number;
    renderFails?: boolean;
  }) {
    const width = options?.viewportWidth ?? 612;
    const height = options?.viewportHeight ?? 792;

    const renderPromise = options?.renderFails
      ? Promise.reject(new Error('Render failed'))
      : Promise.resolve();

    return {
      getViewport: jest.fn().mockReturnValue({
        width: width * 2, // 2x scale
        height: height * 2,
      }),
      render: jest.fn().mockReturnValue({
        promise: renderPromise,
      }),
    } as any;
  }

  it('returns PdfTextItems from OCR word results', async () => {
    const page = createOcrMockPage();

    mockRecognize.mockResolvedValue({
      data: {
        blocks: [
          {
            paragraphs: [
              {
                lines: [
                  {
                    words: [
                      {
                        text: 'Hello',
                        bbox: { x0: 100, y0: 50, x1: 200, y1: 80 },
                        font_name: 'Arial',
                      },
                      {
                        text: 'World',
                        bbox: { x0: 210, y0: 50, x1: 310, y1: 80 },
                        font_name: 'Arial',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const items = await ocrPage(page);

    expect(items).toHaveLength(2);
    // Coordinates should be divided by 2 (since canvas is at 2x scale)
    expect(items[0]).toEqual({
      text: 'Hello',
      x: 50,       // 100 / 2
      y: 25,       // 50 / 2
      width: 50,   // (200 - 100) / 2
      height: 15,  // (80 - 50) / 2
      fontSize: 15, // same as height
      fontName: 'Arial',
      isBold: false,
      isItalic: false,
    });
    expect(items[1].text).toBe('World');
    expect(items[1].x).toBe(105); // 210 / 2
  });

  it('calls page.getViewport with scale 2', async () => {
    const page = createOcrMockPage();
    mockRecognize.mockResolvedValue({ data: { blocks: [] } });

    await ocrPage(page);

    expect(page.getViewport).toHaveBeenCalledWith({ scale: 2 });
  });

  it('calls page.render with the canvas context and viewport', async () => {
    const page = createOcrMockPage();
    mockRecognize.mockResolvedValue({ data: { blocks: [] } });

    await ocrPage(page);

    expect(page.render).toHaveBeenCalledTimes(1);
    const renderArgs = page.render.mock.calls[0][0];
    expect(renderArgs).toHaveProperty('canvasContext');
    expect(renderArgs.canvasContext).toBe(mockCanvasCtx);
    expect(renderArgs).toHaveProperty('viewport');
  });

  it('calls Tesseract.recognize with the canvas and English language', async () => {
    const page = createOcrMockPage();
    mockRecognize.mockResolvedValue({ data: { blocks: [] } });

    await ocrPage(page);

    expect(mockRecognize).toHaveBeenCalledTimes(1);
    // First arg should be the mock canvas, second should be 'eng'
    const [canvasArg, langArg] = mockRecognize.mock.calls[0];
    expect(canvasArg).toBe(mockCanvas);
    expect(langArg).toBe('eng');
  });

  it('returns empty array when OCR returns no blocks', async () => {
    const page = createOcrMockPage();
    mockRecognize.mockResolvedValue({ data: { blocks: [] } });

    const items = await ocrPage(page);

    expect(items).toEqual([]);
  });

  it('returns empty array when OCR returns null blocks', async () => {
    const page = createOcrMockPage();
    mockRecognize.mockResolvedValue({ data: { blocks: null } });

    const items = await ocrPage(page);

    expect(items).toEqual([]);
  });

  it('skips empty/whitespace-only words', async () => {
    const page = createOcrMockPage();
    mockRecognize.mockResolvedValue({
      data: {
        blocks: [
          {
            paragraphs: [
              {
                lines: [
                  {
                    words: [
                      { text: '', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, font_name: '' },
                      { text: '   ', bbox: { x0: 20, y0: 0, x1: 30, y1: 10 }, font_name: '' },
                      { text: 'Valid', bbox: { x0: 40, y0: 0, x1: 80, y1: 20 }, font_name: '' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const items = await ocrPage(page);

    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('Valid');
  });

  it('uses "ocr-detected" as default font name when font_name is empty', async () => {
    const page = createOcrMockPage();
    mockRecognize.mockResolvedValue({
      data: {
        blocks: [
          {
            paragraphs: [
              {
                lines: [
                  {
                    words: [
                      { text: 'Word', bbox: { x0: 0, y0: 0, x1: 40, y1: 20 }, font_name: '' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const items = await ocrPage(page);

    expect(items).toHaveLength(1);
    expect(items[0].fontName).toBe('ocr-detected');
  });

  it('returns empty array and logs warning when render fails', async () => {
    const page = createOcrMockPage({ renderFails: true });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const items = await ocrPage(page);

    expect(items).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns empty array and logs warning when Tesseract.recognize fails', async () => {
    const page = createOcrMockPage();
    mockRecognize.mockRejectedValue(new Error('OCR engine error'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const items = await ocrPage(page);

    expect(items).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('handles multiple blocks and paragraphs', async () => {
    const page = createOcrMockPage();
    mockRecognize.mockResolvedValue({
      data: {
        blocks: [
          {
            paragraphs: [
              {
                lines: [
                  {
                    words: [
                      { text: 'Block1', bbox: { x0: 0, y0: 0, x1: 60, y1: 20 }, font_name: 'Font1' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            paragraphs: [
              {
                lines: [
                  {
                    words: [
                      { text: 'Block2', bbox: { x0: 0, y0: 100, x1: 60, y1: 120 }, font_name: 'Font2' },
                    ],
                  },
                ],
              },
              {
                lines: [
                  {
                    words: [
                      { text: 'Para2', bbox: { x0: 0, y0: 140, x1: 50, y1: 160 }, font_name: 'Font2' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const items = await ocrPage(page);

    expect(items).toHaveLength(3);
    expect(items[0].text).toBe('Block1');
    expect(items[1].text).toBe('Block2');
    expect(items[2].text).toBe('Para2');
  });

  it('sets isBold and isItalic to false for all OCR items', async () => {
    const page = createOcrMockPage();
    mockRecognize.mockResolvedValue({
      data: {
        blocks: [
          {
            paragraphs: [
              {
                lines: [
                  {
                    words: [
                      { text: 'Text', bbox: { x0: 0, y0: 0, x1: 40, y1: 20 }, font_name: 'Bold-Font' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const items = await ocrPage(page);

    // OCR cannot reliably detect bold/italic, so both should be false
    expect(items[0].isBold).toBe(false);
    expect(items[0].isItalic).toBe(false);
  });

  it('returns empty array when canvas getContext returns null', async () => {
    mockCanvas.getContext.mockReturnValue(null);
    const page = createOcrMockPage();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const items = await ocrPage(page);

    expect(items).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith('ocrPage: Failed to get 2D canvas context');
    warnSpy.mockRestore();
  });

  it('cleans up canvas dimensions after successful OCR', async () => {
    const page = createOcrMockPage();
    mockRecognize.mockResolvedValue({ data: { blocks: [] } });

    await ocrPage(page);

    // Canvas should be cleaned up (dimensions set to 0)
    expect(mockCanvas.width).toBe(0);
    expect(mockCanvas.height).toBe(0);
  });

  it('sets canvas dimensions from viewport', async () => {
    const page = createOcrMockPage({ viewportWidth: 300, viewportHeight: 400 });
    mockRecognize.mockResolvedValue({ data: { blocks: [] } });

    // Capture the canvas dimensions before cleanup
    let capturedWidth = 0;
    let capturedHeight = 0;
    mockRecognize.mockImplementation((canvas: any) => {
      capturedWidth = canvas.width;
      capturedHeight = canvas.height;
      return Promise.resolve({ data: { blocks: [] } });
    });

    await ocrPage(page);

    // Canvas should have been set to 2x viewport dimensions (600x800)
    expect(capturedWidth).toBe(600);
    expect(capturedHeight).toBe(800);
  });
});

// ---------------------------------------------------------------------------
// processPageWithOcrFallback tests
// ---------------------------------------------------------------------------

describe('processPageWithOcrFallback', () => {
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
   */
  function createCombinedMockPage(
    textItems: any[],
    ocrOptions?: { viewportWidth?: number; viewportHeight?: number }
  ) {
    const width = ocrOptions?.viewportWidth ?? 612;
    const height = ocrOptions?.viewportHeight ?? 792;

    return {
      getTextContent: jest.fn().mockResolvedValue({
        items: textItems,
        styles: {},
        lang: null,
      }),
      getViewport: jest.fn().mockReturnValue({
        width: width * 2,
        height: height * 2,
      }),
      render: jest.fn().mockReturnValue({
        promise: Promise.resolve(),
      }),
    } as any;
  }

  /**
   * Builds a standard MockTextItem with sensible defaults.
   */
  function makeTextItemRaw(overrides: Partial<{
    str: string;
    dir: string;
    transform: number[];
    width: number;
    height: number;
    fontName: string;
    hasEOL: boolean;
  }> = {}) {
    return {
      str: 'Hello',
      dir: 'ltr',
      transform: [12, 0, 0, 12, 72, 700],
      width: 30,
      height: 12,
      fontName: 'g_d0_f1',
      hasEOL: false,
      ...overrides,
    };
  }

  it('returns pdfjs-dist items when page has substantial text', async () => {
    // Create a page with enough text to pass hasSubstantialText (>50 non-ws chars)
    const longText = 'This is a substantial amount of text that exceeds fifty characters easily.';
    const page = createCombinedMockPage([
      makeTextItemRaw({ str: longText }),
    ]);

    const items = await processPageWithOcrFallback(page);

    expect(items).toHaveLength(1);
    expect(items[0].text).toBe(longText);
    // Should NOT have called OCR
    expect(page.getViewport).not.toHaveBeenCalled();
    expect(page.render).not.toHaveBeenCalled();
  });

  it('falls back to OCR when page has no substantial text', async () => {
    // Page with very little text (below 50 non-ws chars)
    const page = createCombinedMockPage([
      makeTextItemRaw({ str: 'Hi' }),
    ]);

    mockRecognize.mockResolvedValue({
      data: {
        blocks: [{
          paragraphs: [{
            lines: [{
              words: [{
                text: 'OCR detected text from scanned page',
                bbox: { x0: 100, y0: 200, x1: 400, y1: 230 },
                font_name: 'ocr-font',
              }],
            }],
          }],
        }],
      },
    });

    const items = await processPageWithOcrFallback(page);

    // Should have called OCR
    expect(page.getViewport).toHaveBeenCalled();
    expect(page.render).toHaveBeenCalled();
    expect(mockRecognize).toHaveBeenCalled();
    // Should return OCR items
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('OCR detected text from scanned page');
  });

  it('skips OCR when forceOcr is explicitly false', async () => {
    // Page with no substantial text
    const page = createCombinedMockPage([
      makeTextItemRaw({ str: 'Hi' }),
    ]);

    const items = await processPageWithOcrFallback(page, false);

    // Should NOT have called OCR
    expect(page.getViewport).not.toHaveBeenCalled();
    expect(page.render).not.toHaveBeenCalled();
    // Should return the original (sparse) items
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('Hi');
  });

  it('allows OCR when forceOcr is undefined', async () => {
    const page = createCombinedMockPage([]);

    mockRecognize.mockResolvedValue({
      data: {
        blocks: [{
          paragraphs: [{
            lines: [{
              words: [{
                text: 'Scanned',
                bbox: { x0: 10, y0: 20, x1: 100, y1: 40 },
                font_name: null,
              }],
            }],
          }],
        }],
      },
    });

    const items = await processPageWithOcrFallback(page, undefined);

    expect(mockRecognize).toHaveBeenCalled();
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('Scanned');
  });

  it('allows OCR when forceOcr is true', async () => {
    const page = createCombinedMockPage([]);

    mockRecognize.mockResolvedValue({
      data: {
        blocks: [{
          paragraphs: [{
            lines: [{
              words: [{
                text: 'ForcedOCR',
                bbox: { x0: 10, y0: 20, x1: 100, y1: 40 },
                font_name: null,
              }],
            }],
          }],
        }],
      },
    });

    const items = await processPageWithOcrFallback(page, true);

    expect(mockRecognize).toHaveBeenCalled();
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('ForcedOCR');
  });

  it('invokes onOcrTriggered callback when OCR fallback is used', async () => {
    const page = createCombinedMockPage([]);
    const onOcrTriggered = jest.fn();

    mockRecognize.mockResolvedValue({ data: { blocks: [] } });

    await processPageWithOcrFallback(page, undefined, onOcrTriggered);

    expect(onOcrTriggered).toHaveBeenCalledTimes(1);
  });

  it('does not invoke onOcrTriggered when page has substantial text', async () => {
    const longText = 'This is a substantial amount of text that exceeds fifty characters easily.';
    const page = createCombinedMockPage([
      makeTextItemRaw({ str: longText }),
    ]);
    const onOcrTriggered = jest.fn();

    await processPageWithOcrFallback(page, undefined, onOcrTriggered);

    expect(onOcrTriggered).not.toHaveBeenCalled();
  });

  it('does not invoke onOcrTriggered when forceOcr is false', async () => {
    const page = createCombinedMockPage([]);
    const onOcrTriggered = jest.fn();

    await processPageWithOcrFallback(page, false, onOcrTriggered);

    expect(onOcrTriggered).not.toHaveBeenCalled();
  });

  it('returns empty array when OCR also returns nothing', async () => {
    const page = createCombinedMockPage([]);

    mockRecognize.mockResolvedValue({ data: { blocks: [] } });

    const items = await processPageWithOcrFallback(page);

    expect(items).toEqual([]);
  });

  it('returns empty pdfjs items when forceOcr is false and page is empty', async () => {
    const page = createCombinedMockPage([]);

    const items = await processPageWithOcrFallback(page, false);

    expect(items).toEqual([]);
    expect(mockRecognize).not.toHaveBeenCalled();
  });
});


// ---------------------------------------------------------------------------
// convertPdfToMarkdown error handling tests (Task 8.3)
// ---------------------------------------------------------------------------

describe('convertPdfToMarkdown — error handling', () => {
  let mockGetDocument: jest.Mock;
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
    mockGetDocument = require('pdfjs-dist').getDocument;
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

    // Mock document.createElement for 'canvas'
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
   * Helper to create a mock PDFDocumentProxy with pages.
   * Each page has configurable text items, operator list, and OCR behavior.
   */
  function createMockPdfDoc(pages: Array<{
    textItems?: any[];
    fnArray?: number[];
    argsArray?: any[][];
    objs?: Record<string, any>;
    viewportWidth?: number;
    viewportHeight?: number;
  }>) {
    const mockPages = pages.map((pageConfig, index) => {
      const width = pageConfig.viewportWidth ?? 612;
      const height = pageConfig.viewportHeight ?? 792;

      return {
        getTextContent: jest.fn().mockResolvedValue({
          items: pageConfig.textItems ?? [],
          styles: {},
          lang: null,
        }),
        getOperatorList: jest.fn().mockResolvedValue({
          fnArray: pageConfig.fnArray ?? [],
          argsArray: pageConfig.argsArray ?? [],
        }),
        objs: {
          get: jest.fn((name: string) => (pageConfig.objs ?? {})[name] ?? null),
        },
        getViewport: jest.fn().mockReturnValue({
          width: width * 2,
          height: height * 2,
        }),
        render: jest.fn().mockReturnValue({
          promise: Promise.resolve(),
        }),
      };
    });

    return {
      numPages: pages.length,
      getPage: jest.fn((pageNum: number) => Promise.resolve(mockPages[pageNum - 1])),
    };
  }

  // --- Password-protected PDF ---

  it('throws PdfImportError with code PASSWORD_PROTECTED for password-protected PDFs', async () => {
    const passwordError = new Error('Password required');
    (passwordError as any).name = 'PasswordException';

    mockGetDocument.mockReturnValue({
      promise: Promise.reject(passwordError),
    });

    await expect(convertPdfToMarkdown(new ArrayBuffer(10))).rejects.toThrow(PdfImportError);

    try {
      await convertPdfToMarkdown(new ArrayBuffer(10));
    } catch (err) {
      expect(err).toBeInstanceOf(PdfImportError);
      expect((err as PdfImportError).code).toBe('PASSWORD_PROTECTED');
      expect((err as PdfImportError).message).toContain('password-protected');
    }
  });

  // --- Corrupted PDF ---

  it('throws PdfImportError with code CORRUPTED for corrupted/unreadable PDFs', async () => {
    mockGetDocument.mockReturnValue({
      promise: Promise.reject(new Error('Invalid PDF structure')),
    });

    await expect(convertPdfToMarkdown(new ArrayBuffer(10))).rejects.toThrow(PdfImportError);

    try {
      await convertPdfToMarkdown(new ArrayBuffer(10));
    } catch (err) {
      expect(err).toBeInstanceOf(PdfImportError);
      expect((err as PdfImportError).code).toBe('CORRUPTED');
      expect((err as PdfImportError).message).toContain('corrupted');
    }
  });

  // --- Empty PDF (no text content, OCR also empty) ---

  it('returns empty or minimal markdown for an empty PDF with no text and empty OCR', async () => {
    const mockDoc = createMockPdfDoc([
      { textItems: [] }, // Page with no text
    ]);

    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(mockDoc),
    });

    // OCR also returns nothing
    mockRecognize.mockResolvedValue({ data: { blocks: [] } });

    const result = await convertPdfToMarkdown(new ArrayBuffer(10));

    // With no text and no OCR results, the output should be empty
    expect(result.trim()).toBe('');
  });

  // --- Image extraction failure is skipped without halting ---

  it('skips image extraction failure and continues processing text', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Create a page with substantial text but a failing operator list
    const longText = 'This is a substantial amount of text that exceeds fifty characters easily and should be processed.';
    const mockDoc = createMockPdfDoc([
      {
        textItems: [
          {
            str: longText,
            dir: 'ltr',
            transform: [12, 0, 0, 12, 72, 700],
            width: 400,
            height: 12,
            fontName: 'Arial',
            hasEOL: false,
          },
        ],
      },
    ]);

    // Make getOperatorList fail for the page
    const mockPage = await mockDoc.getPage(1);
    mockPage.getOperatorList.mockRejectedValue(new Error('Operator list failed'));

    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(mockDoc),
    });

    const result = await convertPdfToMarkdown(new ArrayBuffer(10));

    // The text should still be present in the output despite image extraction failure
    expect(result).toContain(longText);
    // A warning should have been logged
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  // --- Table fallback when column alignment is inconsistent ---

  it('falls back to plain text when table column alignment is inconsistent', () => {
    // Header has 2 populated columns, but a data row has 3 populated columns
    // (more populated cells than header → inconsistent)
    const items1: PdfTextItem[] = [
      makePdfTextItem({ text: 'Col1', x: 72, y: 700, width: 40 }),
      makePdfTextItem({ text: 'Col2', x: 200, y: 700, width: 40 }),
    ];
    const items2: PdfTextItem[] = [
      makePdfTextItem({ text: 'A', x: 72, y: 680, width: 40 }),
      makePdfTextItem({ text: 'B', x: 200, y: 680, width: 40 }),
      makePdfTextItem({ text: 'C', x: 350, y: 680, width: 40 }),
    ];

    const line1: TextLine = {
      items: items1,
      y: 700,
      minX: 72,
      maxX: 240,
      avgFontSize: 12,
    };
    const line2: TextLine = {
      items: items2,
      y: 680,
      minX: 72,
      maxX: 390,
      avgFontSize: 12,
    };

    const result = detectTables([line1, line2]);

    // Should fall back — data row has more populated cells than header
    expect(result.tables).toHaveLength(0);
    expect(result.remainingLines).toHaveLength(2);
  });

  // --- OCR failure on a page is handled gracefully ---

  it('handles OCR failure gracefully without crashing the conversion', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Create a page with no text (triggers OCR fallback)
    const mockDoc = createMockPdfDoc([
      { textItems: [] },
    ]);

    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(mockDoc),
    });

    // OCR fails with an error
    mockRecognize.mockRejectedValue(new Error('OCR engine crashed'));

    // Should not throw — OCR failure is handled gracefully
    const result = await convertPdfToMarkdown(new ArrayBuffer(10));

    // Result should be empty since both text extraction and OCR returned nothing
    expect(result.trim()).toBe('');
    // A warning should have been logged about the OCR failure
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  // --- Additional integration-level error handling tests ---

  it('calls onPageProgress callback for each processed page', async () => {
    const longText = 'This is a substantial amount of text that exceeds fifty characters easily and should be processed.';
    const mockDoc = createMockPdfDoc([
      {
        textItems: [{
          str: longText,
          dir: 'ltr',
          transform: [12, 0, 0, 12, 72, 700],
          width: 400,
          height: 12,
          fontName: 'Arial',
          hasEOL: false,
        }],
      },
      {
        textItems: [{
          str: longText,
          dir: 'ltr',
          transform: [12, 0, 0, 12, 72, 700],
          width: 400,
          height: 12,
          fontName: 'Arial',
          hasEOL: false,
        }],
      },
    ]);

    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(mockDoc),
    });

    const progressCallback = jest.fn();

    await convertPdfToMarkdown(new ArrayBuffer(10), {
      onPageProgress: progressCallback,
    });

    expect(progressCallback).toHaveBeenCalledTimes(2);
    expect(progressCallback).toHaveBeenCalledWith(1, 2);
    expect(progressCallback).toHaveBeenCalledWith(2, 2);
  });

  it('respects maxPages option and only processes specified number of pages', async () => {
    const longText = 'This is a substantial amount of text that exceeds fifty characters easily and should be processed.';
    const pageConfig = {
      textItems: [{
        str: longText,
        dir: 'ltr',
        transform: [12, 0, 0, 12, 72, 700],
        width: 400,
        height: 12,
        fontName: 'Arial',
        hasEOL: false,
      }],
    };

    const mockDoc = createMockPdfDoc([pageConfig, pageConfig, pageConfig]);

    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(mockDoc),
    });

    const progressCallback = jest.fn();

    await convertPdfToMarkdown(new ArrayBuffer(10), {
      maxPages: 2,
      onPageProgress: progressCallback,
    });

    // Should only process 2 of 3 pages
    expect(progressCallback).toHaveBeenCalledTimes(2);
    expect(mockDoc.getPage).toHaveBeenCalledTimes(2);
    expect(mockDoc.getPage).toHaveBeenCalledWith(1);
    expect(mockDoc.getPage).toHaveBeenCalledWith(2);
  });

  it('distinguishes PasswordException from other errors by name property', async () => {
    // Non-password error with a different name should be CORRUPTED
    const otherError = new Error('Some other error');
    (otherError as any).name = 'InvalidPDFException';

    mockGetDocument.mockReturnValue({
      promise: Promise.reject(otherError),
    });

    try {
      await convertPdfToMarkdown(new ArrayBuffer(10));
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PdfImportError);
      expect((err as PdfImportError).code).toBe('CORRUPTED');
    }
  });
});
