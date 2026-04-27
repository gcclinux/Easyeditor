/**
 * PDF to Markdown Importer
 *
 * Converts PDF files into GFM-compliant Markdown by extracting text with
 * positional/font metadata via pdfjs-dist, reconstructing semantic structure
 * (headings, paragraphs, lists, tables), and converting through an intermediate
 * HTML stage using Turndown.
 *
 * For scanned PDFs with no selectable text, tesseract.js provides OCR fallback.
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Configure the PDF.js worker.
// In Vite, we use the ?url suffix to get the resolved asset URL for the worker file.
// This ensures the worker is correctly bundled and served in both dev and production.
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for the PDF-to-Markdown conversion. */
export interface PdfImportOptions {
  /** Callback invoked after each page is processed, for progress reporting. */
  onPageProgress?: (current: number, total: number) => void;
  /** Maximum pages to process (default: unlimited). */
  maxPages?: number;
  /** If true, skip pdfjs-dist text extraction and go directly to OCR. */
  forceOcr?: boolean;
}

/** Error codes for PDF import failures. */
export type PdfImportErrorCode =
  | 'PASSWORD_PROTECTED'
  | 'CORRUPTED'
  | 'PARSE_ERROR'
  | 'UNKNOWN';

/** Custom error class for PDF import failures with a machine-readable code. */
export class PdfImportError extends Error {
  constructor(
    message: string,
    public readonly code: PdfImportErrorCode
  ) {
    super(message);
    this.name = 'PdfImportError';
  }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** A single text item extracted from a PDF page with positional metadata. */
export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  isBold: boolean;
  isItalic: boolean;
}

/** A logical line of text (items on the same Y-coordinate, sorted by X). */
export interface TextLine {
  items: PdfTextItem[];
  y: number;
  minX: number;
  maxX: number;
  avgFontSize: number;
}

/** Inline formatting span within a text block. */
export interface InlineFormatting {
  start: number;
  end: number;
  style: 'bold' | 'italic' | 'bolditalic';
}

/** A structural block identified by the analysis phase. */
export type ContentBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; text: string; formatting: InlineFormatting[] }
  | { type: 'paragraph'; lines: string[]; formatting: InlineFormatting[] }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'image'; blobUrl: string; altText: string };

/** Extracted image from a PDF page. */
export interface PdfImage {
  data: Uint8Array;
  contentType: string;
  width: number;
  height: number;
  pageIndex: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Internal functions
// ---------------------------------------------------------------------------

/**
 * Extracts text items with positional and font metadata from a single PDF page.
 *
 * Uses `page.getTextContent()` to retrieve raw text items, then maps each to a
 * `PdfTextItem` with computed font size, position, and bold/italic flags derived
 * from the font name.
 *
 * @param page - A pdfjs-dist PDFPageProxy for the page to extract from
 * @returns Array of PdfTextItem objects with text and metadata
 */
export async function extractPageTextItems(
  page: pdfjsLib.PDFPageProxy
): Promise<PdfTextItem[]> {
  const textContent = await page.getTextContent();
  const result: PdfTextItem[] = [];

  for (const item of textContent.items) {
    // Skip marked content items (they have a 'type' property instead of 'str')
    if ('type' in item) {
      continue;
    }

    const textItem = item as TextItem;

    // Skip empty text items
    if (!textItem.str) {
      continue;
    }

    // The transform matrix is [a, b, c, d, e, f]:
    //   a = horizontal scaling, b = horizontal skewing
    //   c = vertical skewing,   d = vertical scaling
    //   e = horizontal position (x), f = vertical position (y)
    const [a, b, , , e, f] = textItem.transform;

    // Font size is derived from the transform matrix.
    // For rotated text, use the magnitude: sqrt(a² + b²)
    // For non-rotated text, this simplifies to |a| (since b=0)
    const fontSize = Math.sqrt(a * a + b * b);

    const x = e;
    const y = f;
    const width = textItem.width;
    const height = textItem.height;
    const fontName = textItem.fontName;

    // Derive bold/italic from font name patterns.
    // Common font naming conventions include "Bold", "Italic", "Oblique"
    // in the font name string (e.g., "TimesNewRoman-Bold", "Arial-BoldItalic").
    const fontNameLower = fontName.toLowerCase();
    const isBold = fontNameLower.includes('bold');
    const isItalic =
      fontNameLower.includes('italic') || fontNameLower.includes('oblique');

    result.push({
      text: textItem.str,
      x,
      y,
      width,
      height,
      fontSize,
      fontName,
      isBold,
      isItalic,
    });
  }

  return result;
}

/**
 * Extracts embedded images from a single PDF page by inspecting the operator
 * list for `OPS.paintImageXObject` operations.
 *
 * For each image operation found, retrieves the image object from the page's
 * object store (`page.objs`) and extracts its raw pixel data, dimensions, and
 * content type.
 *
 * Individual image extraction failures are caught and logged — they do not
 * halt processing of remaining images on the page.
 *
 * @param page - A pdfjs-dist PDFPageProxy for the page to extract images from
 * @param pageIndex - The zero-based page index (used for ordering in the output)
 * @returns Array of PdfImage objects extracted from the page
 */
export async function extractPageImages(
  page: pdfjsLib.PDFPageProxy,
  pageIndex: number
): Promise<PdfImage[]> {
  const images: PdfImage[] = [];

  let operatorList: { fnArray: number[]; argsArray: any[] };
  try {
    operatorList = await page.getOperatorList();
  } catch (err) {
    console.warn(`Failed to get operator list for page ${pageIndex}:`, err);
    return images;
  }

  const paintImageXObjectOp = pdfjsLib.OPS.paintImageXObject;

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    if (operatorList.fnArray[i] !== paintImageXObjectOp) {
      continue;
    }

    try {
      // The args for paintImageXObject are [imageName, width, height]
      const args = operatorList.argsArray[i];
      const imageName: string = args[0];

      // Retrieve the image object from the page's object store
      const imgObj = page.objs.get(imageName) as {
        data: Uint8Array;
        width: number;
        height: number;
      } | null;

      if (!imgObj || !imgObj.data) {
        continue;
      }

      // Default to image/png since pdfjs-dist provides raw pixel data
      const contentType = 'image/png';

      images.push({
        data: imgObj.data instanceof Uint8Array ? imgObj.data : new Uint8Array(imgObj.data),
        contentType,
        width: imgObj.width,
        height: imgObj.height,
        pageIndex,
        y: 0, // Position will be refined in later tasks when integrating with content blocks
      });
    } catch (err) {
      console.warn(
        `Failed to extract image at operator index ${i} on page ${pageIndex}:`,
        err
      );
      // Skip this image and continue with the rest
    }
  }

  return images;
}

/**
 * Groups an array of PdfTextItems into logical TextLine objects based on
 * Y-coordinate proximity. Items within `tolerance` pixels of each other
 * vertically are considered part of the same line.
 *
 * Lines are sorted top-to-bottom by Y-coordinate, and items within each
 * line are sorted left-to-right by X-coordinate.
 *
 * @param items - The text items to group
 * @param tolerance - Maximum Y-distance (in PDF units) for items to be on the same line (default: 3)
 * @returns Array of TextLine objects sorted by Y-coordinate
 */
export function groupIntoLines(items: PdfTextItem[], tolerance: number = 3): TextLine[] {
  if (items.length === 0) {
    return [];
  }

  // Sort items by Y descending (PDF coordinate system: higher Y = higher on page),
  // then by X ascending for stable ordering.
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) > tolerance) {
      return b.y - a.y; // higher Y first (top of page)
    }
    return a.x - b.x;
  });

  const lines: TextLine[] = [];
  let currentLineItems: PdfTextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) <= tolerance) {
      // Same line
      currentLineItems.push(item);
    } else {
      // New line — finalize the current one
      lines.push(buildTextLine(currentLineItems));
      currentLineItems = [item];
      currentY = item.y;
    }
  }

  // Finalize the last line
  lines.push(buildTextLine(currentLineItems));

  return lines;
}

/**
 * Builds a TextLine from a set of items that belong to the same logical line.
 * Sorts items by X-coordinate and computes aggregate properties.
 */
function buildTextLine(items: PdfTextItem[]): TextLine {
  // Sort items left-to-right by X-coordinate
  const sortedItems = [...items].sort((a, b) => a.x - b.x);

  const minX = Math.min(...sortedItems.map((it) => it.x));
  const maxX = Math.max(...sortedItems.map((it) => it.x + it.width));
  const avgFontSize =
    sortedItems.reduce((sum, it) => sum + it.fontSize, 0) / sortedItems.length;
  const y = sortedItems.reduce((sum, it) => sum + it.y, 0) / sortedItems.length;

  return {
    items: sortedItems,
    y,
    minX,
    maxX,
    avgFontSize,
  };
}

/**
 * Detects the body (most common) font size across all text items.
 *
 * Rounds each font size to the nearest integer for bucketing, then returns
 * the mode (most frequent value). If no items are provided, returns 12 as
 * a sensible default.
 *
 * @param allItems - All PdfTextItems across all pages
 * @returns The most common font size (rounded to nearest integer)
 */
export function detectBodyFontSize(allItems: PdfTextItem[]): number {
  if (allItems.length === 0) {
    return 12;
  }

  const buckets = new Map<number, number>();

  for (const item of allItems) {
    const rounded = Math.round(item.fontSize);
    buckets.set(rounded, (buckets.get(rounded) ?? 0) + 1);
  }

  let maxCount = 0;
  let mode = 12;

  for (const [size, count] of buckets) {
    if (count > maxCount) {
      maxCount = count;
      mode = size;
    }
  }

  return mode;
}

/**
 * Classifies a single TextLine as a heading, list item, or paragraph ContentBlock.
 *
 * Classification logic:
 * 1. Check for list prefixes first (bullets or numbered patterns)
 * 2. If not a list, check font size ratio against body font size for headings
 * 3. Otherwise, classify as a paragraph with inline formatting spans
 *
 * @param line - The TextLine to classify
 * @param bodyFontSize - The detected body font size for ratio comparison
 * @returns A ContentBlock representing the classified line
 */
export function classifyLine(line: TextLine, bodyFontSize: number): ContentBlock {
  const fullText = line.items.map((it) => it.text).join('');

  // --- List detection (checked first, before heading) ---
  const unorderedBullets = ['•', '–', '-', '▪'];
  const trimmedText = fullText.trimStart();

  // Check for unordered list: starts with a bullet character
  for (const bullet of unorderedBullets) {
    if (trimmedText.startsWith(bullet)) {
      const itemText = trimmedText.slice(bullet.length).trimStart();
      return { type: 'list', ordered: false, items: [itemText] };
    }
  }

  // Check for ordered list: starts with digits followed by . or ) and a space
  const orderedMatch = trimmedText.match(/^\d+[\.\)]\s/);
  if (orderedMatch) {
    const itemText = trimmedText.slice(orderedMatch[0].length);
    return { type: 'list', ordered: true, items: [itemText] };
  }

  // --- Heading detection via font size ratio ---
  const ratio = line.avgFontSize / bodyFontSize;

  if (ratio >= 2.0) {
    return { type: 'heading', level: 1, text: fullText, formatting: buildInlineFormatting(line.items) };
  }
  if (ratio >= 1.6) {
    return { type: 'heading', level: 2, text: fullText, formatting: buildInlineFormatting(line.items) };
  }
  if (ratio >= 1.3) {
    return { type: 'heading', level: 3, text: fullText, formatting: buildInlineFormatting(line.items) };
  }
  if (ratio >= 1.1) {
    return { type: 'heading', level: 4, text: fullText, formatting: buildInlineFormatting(line.items) };
  }

  // --- Default: paragraph ---
  return { type: 'paragraph', lines: [fullText], formatting: buildInlineFormatting(line.items) };
}

/**
 * Builds InlineFormatting spans from a sequence of PdfTextItems.
 *
 * Walks through items, tracking character offsets, and creates formatting
 * spans for bold, italic, or bold+italic items.
 *
 * @param items - The text items in a line
 * @returns Array of InlineFormatting spans
 */
function buildInlineFormatting(items: PdfTextItem[]): InlineFormatting[] {
  const spans: InlineFormatting[] = [];
  let offset = 0;

  for (const item of items) {
    const len = item.text.length;
    if (len === 0) {
      continue;
    }

    if (item.isBold && item.isItalic) {
      spans.push({ start: offset, end: offset + len, style: 'bolditalic' });
    } else if (item.isBold) {
      spans.push({ start: offset, end: offset + len, style: 'bold' });
    } else if (item.isItalic) {
      spans.push({ start: offset, end: offset + len, style: 'italic' });
    }

    offset += len;
  }

  return spans;
}

/**
 * Detects table structures from a set of TextLines using grid-aligned text clustering.
 *
 * Algorithm:
 * 1. Collect all text item X-coordinates across all lines and cluster them
 *    (items within a tolerance are considered the same column).
 * 2. If ≥2 distinct X-clusters are found with items in ≥2 lines, the region
 *    is a candidate table.
 * 3. For each candidate table, map items to their column cluster to extract
 *    cell text. The first row becomes headers, remaining rows become data.
 * 4. If column counts are inconsistent across rows, fall back to plain paragraphs.
 *
 * @param lines - The TextLines to analyze for table structures
 * @returns An object with detected table ContentBlocks and remaining non-table lines
 */
export function detectTables(lines: TextLine[]): { tables: ContentBlock[]; remainingLines: TextLine[] } {
  if (lines.length < 2) {
    return { tables: [], remainingLines: [...lines] };
  }

  // Collect all X-coordinates from all items across all lines
  const allXCoords: number[] = [];
  for (const line of lines) {
    for (const item of line.items) {
      allXCoords.push(item.x);
    }
  }

  if (allXCoords.length === 0) {
    return { tables: [], remainingLines: [...lines] };
  }

  // Cluster X-coordinates to detect columns
  const xClusters = clusterValues(allXCoords, 15);

  // Need at least 2 columns for a table
  if (xClusters.length < 2) {
    return { tables: [], remainingLines: [...lines] };
  }

  // Sort clusters by their center value (left to right)
  xClusters.sort((a, b) => a.center - b.center);

  // Try to find contiguous runs of lines that form tables.
  // A line is a "table row candidate" if it has items mapping to ≥2 distinct columns.
  const tables: ContentBlock[] = [];
  const remainingLines: TextLine[] = [];

  let i = 0;
  while (i < lines.length) {
    // Check if this line has items in ≥2 columns
    const colMapping = mapLineToColumns(lines[i], xClusters);
    const distinctCols = new Set(Object.keys(colMapping)).size;

    if (distinctCols < 2) {
      remainingLines.push(lines[i]);
      i++;
      continue;
    }

    // Start collecting a candidate table region
    const candidateLines: TextLine[] = [lines[i]];
    let j = i + 1;

    while (j < lines.length) {
      const nextColMapping = mapLineToColumns(lines[j], xClusters);
      const nextDistinctCols = new Set(Object.keys(nextColMapping)).size;

      if (nextDistinctCols < 2) {
        break;
      }
      candidateLines.push(lines[j]);
      j++;
    }

    // Need ≥2 rows for a valid table
    if (candidateLines.length < 2) {
      remainingLines.push(lines[i]);
      i++;
      continue;
    }

    // Determine the columns actually used across all candidate lines
    const usedColumnIndices = new Set<number>();
    for (const line of candidateLines) {
      const mapping = mapLineToColumns(line, xClusters);
      for (const colIdx of Object.keys(mapping)) {
        usedColumnIndices.add(Number(colIdx));
      }
    }
    const sortedColumnIndices = Array.from(usedColumnIndices).sort((a, b) => a - b);
    const numColumns = sortedColumnIndices.length;

    if (numColumns < 2) {
      // Not enough columns — emit as remaining lines
      for (const line of candidateLines) {
        remainingLines.push(line);
      }
      i = j;
      continue;
    }

    // Build rows: for each candidate line, extract cell text for each column
    const rows: string[][] = [];
    let consistent = true;

    for (const line of candidateLines) {
      const mapping = mapLineToColumns(line, xClusters);
      const row: string[] = [];

      for (const colIdx of sortedColumnIndices) {
        row.push(mapping[colIdx] ?? '');
      }

      rows.push(row);

      // Check consistency: each row should have the same number of non-empty cells
      // as the first row, or at least the same total column count
      const nonEmptyCells = row.filter(cell => cell.trim() !== '').length;
      if (rows.length === 1) {
        // First row sets the expected column count
        continue;
      }
      // Allow rows with fewer non-empty cells (empty cells are OK)
      // But check that no row has items in columns outside the expected set
    }

    // Validate consistency: check that all rows have the same number of columns
    // (they all use sortedColumnIndices, so they should). But also check that
    // the actual item distribution is consistent — if some rows have items
    // that don't map to any cluster, that's inconsistent.
    if (!consistent) {
      for (const line of candidateLines) {
        remainingLines.push(line);
      }
      i = j;
      continue;
    }

    // Additional consistency check: verify that the number of distinct columns
    // per row doesn't vary wildly. If any row has a very different number of
    // populated cells compared to the header, fall back.
    const headerPopulated = rows[0].filter(c => c.trim() !== '').length;
    for (let r = 1; r < rows.length; r++) {
      const rowPopulated = rows[r].filter(c => c.trim() !== '').length;
      // If a data row has more populated cells than the header, that's inconsistent
      if (rowPopulated > headerPopulated) {
        consistent = false;
        break;
      }
    }

    if (!consistent) {
      for (const line of candidateLines) {
        remainingLines.push(line);
      }
      i = j;
      continue;
    }

    // Build the table ContentBlock
    const headers = rows[0];
    const dataRows = rows.slice(1);

    tables.push({
      type: 'table',
      headers,
      rows: dataRows,
    });

    i = j;
  }

  return { tables, remainingLines };
}

/**
 * Clusters an array of numeric values into groups where values within
 * `tolerance` of each other belong to the same cluster.
 *
 * @param values - The numeric values to cluster
 * @param tolerance - Maximum distance between values in the same cluster
 * @returns Array of clusters, each with a center value and member values
 */
function clusterValues(values: number[], tolerance: number): { center: number; members: number[] }[] {
  if (values.length === 0) {
    return [];
  }

  const sorted = [...values].sort((a, b) => a - b);
  const clusters: { center: number; members: number[] }[] = [];

  let currentMembers: number[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const currentCenter = currentMembers.reduce((s, v) => s + v, 0) / currentMembers.length;
    if (Math.abs(sorted[i] - currentCenter) <= tolerance) {
      currentMembers.push(sorted[i]);
    } else {
      clusters.push({
        center: currentMembers.reduce((s, v) => s + v, 0) / currentMembers.length,
        members: currentMembers,
      });
      currentMembers = [sorted[i]];
    }
  }

  // Finalize last cluster
  clusters.push({
    center: currentMembers.reduce((s, v) => s + v, 0) / currentMembers.length,
    members: currentMembers,
  });

  return clusters;
}

/**
 * Maps items in a TextLine to column indices based on X-coordinate clusters.
 * Returns an object where keys are column indices and values are the
 * concatenated text of items in that column.
 *
 * @param line - The TextLine to map
 * @param xClusters - The X-coordinate clusters representing columns
 * @returns Object mapping column index to cell text
 */
function mapLineToColumns(
  line: TextLine,
  xClusters: { center: number; members: number[] }[]
): Record<number, string> {
  const result: Record<number, string> = {};

  for (const item of line.items) {
    // Find the closest cluster for this item's X-coordinate
    let bestClusterIdx = 0;
    let bestDistance = Math.abs(item.x - xClusters[0].center);

    for (let c = 1; c < xClusters.length; c++) {
      const dist = Math.abs(item.x - xClusters[c].center);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestClusterIdx = c;
      }
    }

    // Append text to the column (items in the same column on the same line
    // are concatenated with a space)
    if (result[bestClusterIdx] !== undefined) {
      result[bestClusterIdx] += ' ' + item.text;
    } else {
      result[bestClusterIdx] = item.text;
    }
  }

  return result;
}

/**
 * Groups consecutive list ContentBlocks of the same type (ordered/unordered)
 * into single list blocks with multiple items.
 *
 * Non-list blocks pass through unchanged. Adjacent list blocks with the same
 * `ordered` flag are merged into one block whose `items` array contains all
 * the individual item texts.
 *
 * @param blocks - Array of ContentBlocks to process
 * @returns New array with consecutive same-type list blocks merged
 */
export function groupConsecutiveBlocks(blocks: ContentBlock[]): ContentBlock[] {
  if (blocks.length === 0) {
    return [];
  }

  const result: ContentBlock[] = [];

  for (const block of blocks) {
    if (block.type !== 'list') {
      result.push(block);
      continue;
    }

    const last = result[result.length - 1];
    if (last && last.type === 'list' && last.ordered === block.ordered) {
      // Merge into the existing list block
      last.items.push(...block.items);
    } else {
      // Start a new list block (copy items to avoid mutating the original)
      result.push({ type: 'list', ordered: block.ordered, items: [...block.items] });
    }
  }

  return result;
}

/**
 * Applies inline formatting spans to a plain text string, producing HTML
 * with `<strong>`, `<em>`, and `<strong><em>` tags.
 *
 * Formatting spans are sorted by start position and processed from right to
 * left so that earlier character offsets remain valid as tags are inserted.
 *
 * @param text - The plain text to format
 * @param formatting - Array of InlineFormatting spans to apply
 * @returns The text with HTML formatting tags inserted
 */
function applyInlineFormatting(text: string, formatting: InlineFormatting[]): string {
  if (formatting.length === 0) {
    return text;
  }

  // Sort spans by start position descending so we can insert from right to left
  // without invalidating earlier offsets.
  const sorted = [...formatting].sort((a, b) => b.start - a.start);

  let result = text;
  for (const span of sorted) {
    const before = result.slice(0, span.start);
    const content = result.slice(span.start, span.end);
    const after = result.slice(span.end);

    switch (span.style) {
      case 'bold':
        result = before + '<strong>' + content + '</strong>' + after;
        break;
      case 'italic':
        result = before + '<em>' + content + '</em>' + after;
        break;
      case 'bolditalic':
        result = before + '<strong><em>' + content + '</em></strong>' + after;
        break;
    }
  }

  return result;
}

/**
 * Converts an array of ContentBlocks into an HTML string.
 *
 * - Heading blocks → `<h1>`–`<h6>` tags with inline formatting applied to text
 * - Paragraph blocks → `<p>` tags with lines joined by `<br>` and inline formatting
 * - List blocks → `<ul>` or `<ol>` with `<li>` items
 * - Table blocks → `<table>` with `<thead>`/`<tbody>` structure
 * - Image blocks → `<img>` tags with blob URL src and alt text
 *
 * @param blocks - The ContentBlocks to convert
 * @returns An HTML string representing the blocks
 */
export function blocksToHtml(blocks: ContentBlock[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const level = block.level;
        const formattedText = applyInlineFormatting(block.text, block.formatting);
        parts.push(`<h${level}>${formattedText}</h${level}>`);
        break;
      }

      case 'paragraph': {
        const formattedLines = block.lines.map((line, index) => {
          // Calculate the character offset for this line's formatting spans.
          // Each previous line contributes its length to the offset.
          let lineOffset = 0;
          for (let i = 0; i < index; i++) {
            lineOffset += block.lines[i].length;
          }

          // Filter formatting spans that overlap with this line's character range
          const lineEnd = lineOffset + line.length;
          const lineFormatting: InlineFormatting[] = block.formatting
            .filter((f) => f.start < lineEnd && f.end > lineOffset)
            .map((f) => ({
              start: Math.max(0, f.start - lineOffset),
              end: Math.min(line.length, f.end - lineOffset),
              style: f.style,
            }));

          return applyInlineFormatting(line, lineFormatting);
        });

        parts.push(`<p>${formattedLines.join('<br>')}</p>`);
        break;
      }

      case 'list': {
        const tag = block.ordered ? 'ol' : 'ul';
        const items = block.items.map((item) => `<li>${item}</li>`).join('');
        parts.push(`<${tag}>${items}</${tag}>`);
        break;
      }

      case 'table': {
        const headerCells = block.headers.map((h) => `<th>${h}</th>`).join('');
        const headerRow = `<tr>${headerCells}</tr>`;
        const thead = `<thead>${headerRow}</thead>`;

        const bodyRows = block.rows
          .map((row) => {
            const cells = row.map((cell) => `<td>${cell}</td>`).join('');
            return `<tr>${cells}</tr>`;
          })
          .join('');
        const tbody = `<tbody>${bodyRows}</tbody>`;

        parts.push(`<table>${thead}${tbody}</table>`);
        break;
      }

      case 'image': {
        parts.push(`<img src="${block.blobUrl}" alt="${block.altText}" />`);
        break;
      }
    }
  }

  return parts.join('\n');
}

/**
 * Fixes table HTML structure to ensure proper `<thead>`/`<tbody>` wrapping
 * for Turndown GFM compatibility.
 *
 * For each `<table>` element in the HTML:
 * 1. If the table already has a `<thead>` with `<th>` cells, leave it unchanged.
 * 2. Otherwise, take the first `<tr>` as the header row, convert its cells to
 *    `<th>`, wrap it in `<thead>`, and wrap the remaining rows in `<tbody>`
 *    with `<td>` cells.
 *
 * Non-table HTML content is preserved unchanged.
 *
 * @param html - The HTML string potentially containing `<table>` elements
 * @returns The HTML string with all tables having proper `<thead>`/`<tbody>` structure
 */
export function fixTableHtml(html: string): string {
  if (!html) {
    return '';
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
  const tables = doc.querySelectorAll('table');

  for (const table of tables) {
    // Check if the table already has a proper <thead> with <th> cells
    const existingThead = table.querySelector('thead');
    if (existingThead) {
      const thCells = existingThead.querySelectorAll('th');
      if (thCells.length > 0) {
        // Already has proper structure — leave unchanged
        continue;
      }
    }

    // Collect all rows from the table regardless of where they are
    // (could be direct children, in tbody, or in thead without <th>)
    const allRows = Array.from(table.querySelectorAll('tr'));
    if (allRows.length === 0) {
      continue;
    }

    // Clear the table's current content
    table.innerHTML = '';

    // First row becomes the header
    const headerRow = allRows[0];
    const thead = doc.createElement('thead');
    const theadTr = doc.createElement('tr');

    // Convert all cells in the first row to <th>
    const headerCells = Array.from(headerRow.querySelectorAll('td, th'));
    for (const cell of headerCells) {
      const th = doc.createElement('th');
      th.innerHTML = cell.innerHTML;
      theadTr.appendChild(th);
    }
    thead.appendChild(theadTr);
    table.appendChild(thead);

    // Remaining rows go into <tbody> with <td> cells
    if (allRows.length > 1) {
      const tbody = doc.createElement('tbody');
      for (let i = 1; i < allRows.length; i++) {
        const row = allRows[i];
        const tbodyTr = doc.createElement('tr');
        const cells = Array.from(row.querySelectorAll('td, th'));
        for (const cell of cells) {
          const td = doc.createElement('td');
          td.innerHTML = cell.innerHTML;
          tbodyTr.appendChild(td);
        }
        tbody.appendChild(tbodyTr);
      }
      table.appendChild(tbody);
    }
  }

  return doc.body.innerHTML;
}

/**
 * Converts an HTML string to GFM-compliant Markdown using Turndown with the
 * GFM plugin enabled.
 *
 * Configuration:
 * - ATX-style headings (`# Heading` instead of underline style)
 * - Fenced code blocks (triple backticks instead of indentation)
 * - GFM plugin for table and strikethrough support
 * - Custom rule to preserve `<img>` tags as Markdown image syntax with blob URLs
 *
 * @param html - The HTML string to convert
 * @returns The resulting Markdown string
 */
export async function htmlToMarkdown(html: string): Promise<string> {
  if (!html || html.trim() === '') {
    return '';
  }

  const TurndownService = (await import('turndown')).default;
  const { gfm } = await import('turndown-plugin-gfm');

  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });

  turndownService.use(gfm);

  // Custom rule to preserve <img> tags as Markdown image syntax,
  // especially for blob URLs from extracted PDF images.
  turndownService.addRule('images', {
    filter: 'img',
    replacement(_content: string, node: Node) {
      const el = node as HTMLElement;
      const src = el.getAttribute('src') || '';
      const alt = el.getAttribute('alt') || '';
      return `![${alt}](${src})`;
    },
  });

  return turndownService.turndown(html);
}

/**
 * Checks whether the extracted text items from a PDF page contain meaningful
 * (non-whitespace) content. Used per-page to decide whether OCR fallback is
 * needed for scanned or image-based PDFs.
 *
 * @param items - The PdfTextItems extracted from a single page
 * @returns `true` if the total non-whitespace character count exceeds 50
 */
export function hasSubstantialText(items: PdfTextItem[]): boolean {
  let nonWhitespaceCount = 0;

  for (const item of items) {
    for (const ch of item.text) {
      if (ch.trim() !== '') {
        nonWhitespaceCount++;
        if (nonWhitespaceCount > 50) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Renders a PDF page to an off-screen canvas and runs Tesseract.js OCR to
 * extract text. Used as a fallback for scanned PDFs where `pdfjs-dist` text
 * extraction returns empty or near-empty results.
 *
 * Implementation:
 * 1. Gets the page viewport at 2× scale for better OCR accuracy
 * 2. Creates an off-screen canvas and renders the PDF page onto it
 * 3. Lazy-loads `tesseract.js` via dynamic `import()` (only when OCR is needed)
 * 4. Calls `Tesseract.recognize()` with English language
 * 5. Parses word-level results into `PdfTextItem` structures with approximate
 *    bounding boxes derived from Tesseract's word bbox output
 * 6. Cleans up the off-screen canvas after recognition
 *
 * The entire operation is wrapped in try/catch — if OCR fails for any reason,
 * a warning is logged and an empty array is returned so processing can continue.
 *
 * @param page - A pdfjs-dist PDFPageProxy for the page to OCR
 * @returns Array of PdfTextItem objects extracted via OCR
 */
export async function ocrPage(
  page: pdfjsLib.PDFPageProxy
): Promise<PdfTextItem[]> {
  let canvas: HTMLCanvasElement | null = null;

  try {
    // 1. Get viewport at 2x scale for better OCR accuracy
    const viewport = page.getViewport({ scale: 2 });

    // 2. Create an off-screen canvas and set dimensions
    canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('ocrPage: Failed to get 2D canvas context');
      return [];
    }

    // 3. Render the PDF page onto the canvas
    await page.render({ canvasContext: ctx, viewport }).promise;

    // 4. Lazy-load tesseract.js
    const Tesseract = await import('tesseract.js');

    // 5. Run OCR recognition with English language
    const result = await Tesseract.recognize(canvas, 'eng');

    // 6. Parse OCR results into PdfTextItem structures
    const items: PdfTextItem[] = [];

    if (result.data.blocks) {
      for (const block of result.data.blocks) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) {
              if (!word.text || word.text.trim() === '') {
                continue;
              }

              // Tesseract bbox is at the 2x-scaled canvas resolution.
              // Divide by 2 to get coordinates in the original PDF page space.
              const x = word.bbox.x0 / 2;
              const y = word.bbox.y0 / 2;
              const width = (word.bbox.x1 - word.bbox.x0) / 2;
              const height = (word.bbox.y1 - word.bbox.y0) / 2;

              // Approximate font size from the word height
              const fontSize = height;

              items.push({
                text: word.text,
                x,
                y,
                width,
                height,
                fontSize,
                fontName: word.font_name || 'ocr-detected',
                isBold: false,
                isItalic: false,
              });
            }
          }
        }
      }
    }

    return items;
  } catch (err) {
    console.warn('ocrPage: OCR failed for page, returning empty results:', err);
    return [];
  } finally {
    // 7. Clean up the off-screen canvas
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
      canvas = null;
    }
  }
}

/**
 * Converts an array of extracted PdfImage objects into image ContentBlocks.
 *
 * For each image:
 * 1. Creates a Blob from the raw pixel data with the correct content type
 * 2. Generates a Blob URL via `URL.createObjectURL`
 * 3. Builds an image ContentBlock with the Blob URL and empty alt text
 *    (PDFs rarely carry alt text for embedded images)
 *
 * The resulting blocks are sorted by Y-position (descending, matching PDF
 * coordinate order where higher Y = higher on page) so they can be merged
 * into the document's block sequence in the correct reading order.
 *
 * @param images - Array of PdfImage objects extracted from PDF pages
 * @returns Array of image ContentBlocks sorted by Y-position
 */
export function createImageBlocks(images: PdfImage[]): ContentBlock[] {
  if (images.length === 0) {
    return [];
  }

  // Sort images by pageIndex first, then by Y-position descending
  // (higher Y = higher on page in PDF coordinates)
  const sorted = [...images].sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) {
      return a.pageIndex - b.pageIndex;
    }
    return b.y - a.y;
  });

  return sorted.map((image) => {
    const blob = new Blob([image.data], { type: image.contentType });
    const blobUrl = URL.createObjectURL(blob);

    return {
      type: 'image' as const,
      blobUrl,
      altText: '',
    };
  });
}

// ---------------------------------------------------------------------------
// OCR fallback integration
// ---------------------------------------------------------------------------

/**
 * Processes a single PDF page by extracting text items and falling back to
 * OCR when the page has no substantial selectable text.
 *
 * Logic:
 * 1. Call `extractPageTextItems` to get text items from pdfjs-dist
 * 2. Check `hasSubstantialText` on the result
 * 3. If no substantial text and `forceOcr` is not explicitly `false`, call
 *    `ocrPage` and return those items instead
 * 4. Return the text items (either from pdfjs-dist or OCR)
 *
 * The optional `onOcrTriggered` callback is invoked when OCR fallback is
 * activated, allowing callers to show a toast or log the event.
 *
 * @param page - A pdfjs-dist PDFPageProxy for the page to process
 * @param forceOcr - If explicitly `false`, skip OCR fallback even for empty pages
 * @param onOcrTriggered - Optional callback invoked when OCR fallback is used
 * @returns Array of PdfTextItem objects (from pdfjs-dist or OCR)
 */
export async function processPageWithOcrFallback(
  page: pdfjsLib.PDFPageProxy,
  forceOcr?: boolean,
  onOcrTriggered?: () => void
): Promise<PdfTextItem[]> {
  const items = await extractPageTextItems(page);

  if (hasSubstantialText(items)) {
    return items;
  }

  // forceOcr must be explicitly false to skip OCR; undefined/true both allow it
  if (forceOcr === false) {
    return items;
  }

  // Trigger OCR fallback
  if (onOcrTriggered) {
    onOcrTriggered();
  }

  const ocrItems = await ocrPage(page);
  return ocrItems;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Converts a PDF ArrayBuffer into a Markdown string.
 *
 * Handles text extraction, structural analysis, image extraction,
 * HTML generation, and Turndown conversion.
 * Falls back to Tesseract.js OCR for scanned PDFs with no selectable text.
 *
 * @param arrayBuffer - The raw PDF file bytes
 * @param options - Optional configuration for the import
 * @returns The resulting Markdown string
 * @throws PdfImportError for password-protected, corrupted, or unreadable PDFs
 */
export async function convertPdfToMarkdown(
  arrayBuffer: ArrayBuffer,
  options?: PdfImportOptions
): Promise<string> {
  // 1. Load the PDF document
  let pdfDoc: pdfjsLib.PDFDocumentProxy;
  try {
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && (error as { name: string }).name === 'PasswordException') {
      throw new PdfImportError(
        'This PDF is password-protected and cannot be imported.',
        'PASSWORD_PROTECTED'
      );
    }
    throw new PdfImportError(
      'Failed to import PDF: the file appears to be corrupted.',
      'CORRUPTED'
    );
  }

  // 2. Determine page count and respect maxPages option
  const totalPages = pdfDoc.numPages;
  const pagesToProcess = options?.maxPages
    ? Math.min(totalPages, options.maxPages)
    : totalPages;

  // 3. Process pages sequentially — collect text items and images per page
  const allTextItems: PdfTextItem[] = [];
  const allImages: PdfImage[] = [];

  // OCR callback: invoked at most once when OCR fallback is first triggered
  let ocrTriggered = false;
  const ocrCallback = () => {
    if (!ocrTriggered) {
      ocrTriggered = true;
    }
  };

  for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const pageIndex = pageNum - 1;

    // a. Extract text items (with OCR fallback if needed)
    const pageTextItems = await processPageWithOcrFallback(
      page,
      options?.forceOcr,
      ocrCallback
    );
    allTextItems.push(...pageTextItems);

    // b. Extract images from the page
    const pageImages = await extractPageImages(page, pageIndex);
    allImages.push(...pageImages);

    // c. Report page progress
    if (options?.onPageProgress) {
      options.onPageProgress(pageNum, pagesToProcess);
    }

    // Yield to the event loop between pages to keep the UI responsive
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  // 4. Structural analysis on all collected text items
  const bodyFontSize = detectBodyFontSize(allTextItems);
  const lines = groupIntoLines(allTextItems);

  // 5. Detect tables from the lines
  const { tables, remainingLines } = detectTables(lines);

  // 6. Classify remaining lines into content blocks
  const classifiedBlocks: ContentBlock[] = remainingLines.map((line) =>
    classifyLine(line, bodyFontSize)
  );

  // 7. Group consecutive list blocks of the same type
  const groupedBlocks = groupConsecutiveBlocks(classifiedBlocks);

  // 8. Create image blocks from extracted images
  const imageBlocks = createImageBlocks(allImages);

  // 9. Merge all blocks: tables + classified text blocks + image blocks
  //    Tables and image blocks are interleaved by their position in the
  //    document. Since tables and text blocks come from the same line set
  //    (tables extracted first, remaining lines classified), we combine
  //    them in order: tables first, then grouped text blocks, then images
  //    appended at the end (images don't have precise Y-position relative
  //    to text blocks in the current extraction).
  const allBlocks: ContentBlock[] = [
    ...tables,
    ...groupedBlocks,
    ...imageBlocks,
  ];

  // 10. Convert blocks to HTML → fix table structure → convert to Markdown
  const html = blocksToHtml(allBlocks);
  const fixedHtml = fixTableHtml(html);
  const markdown = await htmlToMarkdown(fixedHtml);

  // 11. Release intermediate references to help GC
  allTextItems.length = 0;
  allImages.length = 0;

  return markdown;
}
