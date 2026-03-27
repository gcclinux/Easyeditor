/**
 * DocumentationGenerator — aggregates cached per-file summaries and
 * produces a single cohesive Markdown document via EasyAI.
 *
 * Uses a recursive merge strategy to stay within LLM context windows.
 * The batch threshold adapts based on the configured AI backend:
 *   - Ollama (local): 3000 chars (safe for small models ~8K context)
 *   - Gemini / Claude / Bedrock (cloud): 20000 chars (large context windows)
 */

import { queryEasyAI, loadEasyAIConfig } from './aiService';
import { CacheStore, SummaryRecord } from './cacheStore';

// ── Threshold configuration ────────────────────────────────────────

/** Safe default for local Ollama models with small context windows. */
export const BATCH_THRESHOLD_LOCAL = 3000;

/** Generous threshold for cloud APIs with large context windows. */
export const BATCH_THRESHOLD_CLOUD = 20000;

/** Kept for backward compatibility in tests. */
export const BATCH_THRESHOLD = BATCH_THRESHOLD_LOCAL;

/** Maximum chars for the directory tree in prompts. */
const MAX_TREE_LENGTH = 1500;

/**
 * Resolve the batch threshold based on the current AI backend config.
 */
export async function resolveBatchThreshold(): Promise<number> {
  try {
    const config = await loadEasyAIConfig();
    const agent = config.agent?.toLowerCase() ?? 'ollama';

    if (agent === 'gemini' || agent === 'claude' || agent === 'bedrock') {
      console.log(`[DocGenerator] Using cloud threshold (${BATCH_THRESHOLD_CLOUD}) for agent: ${config.agent}`);
      return BATCH_THRESHOLD_CLOUD;
    }

    console.log(`[DocGenerator] Using local threshold (${BATCH_THRESHOLD_LOCAL}) for agent: ${config.agent}`);
    return BATCH_THRESHOLD_LOCAL;
  } catch {
    return BATCH_THRESHOLD_LOCAL;
  }
}

// ── Public interfaces ──────────────────────────────────────────────

export interface GenerateOptions {
  cache: CacheStore;
  userPrompt: string;
  signal: AbortSignal;
}

// ── Helper: build aggregated prompt from cache records ─────────────

export function buildAggregatedPrompt(
  records: SummaryRecord[],
  userPrompt: string,
): string {
  const parts: string[] = [];

  parts.push(`Documentation request: ${userPrompt}`);
  parts.push('');

  // Always include the directory tree first (truncated if needed)
  for (const record of records) {
    if (record.filePath === '__directory_tree__') {
      parts.push('--- Project Directory Tree ---');
      if (record.summary.length > MAX_TREE_LENGTH) {
        parts.push(record.summary.slice(0, MAX_TREE_LENGTH) + '\n[... truncated]');
      } else {
        parts.push(record.summary);
      }
      parts.push('');
      break;
    }
  }

  for (const record of records) {
    if (record.filePath === '__directory_tree__') continue;
    parts.push(`--- ${record.filePath} (${record.fileType}) ---`);
    parts.push(record.summary);
    parts.push('');
  }

  return parts.join('\n');
}

// ── Helper: split records into batches under a given threshold ─────

export function splitIntoBatches(
  records: SummaryRecord[],
  threshold: number = BATCH_THRESHOLD_LOCAL,
): SummaryRecord[][] {
  const batches: SummaryRecord[][] = [];
  let currentBatch: SummaryRecord[] = [];
  let currentSize = 0;

  for (const record of records) {
    const recordSize = record.summary.length;

    if (currentBatch.length > 0 && currentSize + recordSize > threshold) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }

    currentBatch.push(record);
    currentSize += recordSize;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

// ── Helper: split strings into chunks under a given threshold ──────

function splitTextIntoBatches(texts: string[], threshold: number): string[][] {
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentSize = 0;

  for (const text of texts) {
    if (currentBatch.length > 0 && currentSize + text.length > threshold) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }
    currentBatch.push(text);
    currentSize += text.length;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

// ── Recursive merge ────────────────────────────────────────────────

async function recursiveMerge(
  sections: string[],
  userPrompt: string,
  signal: AbortSignal,
  threshold: number,
): Promise<string> {
  const totalSize = sections.reduce((s, t) => s + t.length, 0);

  // Base case: everything fits in one prompt
  if (totalSize <= threshold) {
    if (signal.aborted) return '';
    const prompt = `Documentation request: ${userPrompt}\n\n` +
      sections.map((s, i) => `--- Section ${i + 1} ---\n${s}`).join('\n\n');

    return queryEasyAI(
      'You are a documentation generator. Merge the following sections into a single cohesive ' +
      'Markdown document. Remove redundancy and produce well-structured output. ' +
      'Use ONLY the information provided — do NOT invent details.',
      prompt,
    );
  }

  // Recursive case: batch, condense, repeat
  const batches = splitTextIntoBatches(sections, threshold);
  console.log(`[DocGenerator] Merging ${sections.length} sections in ${batches.length} batches (threshold: ${threshold})`);

  const condensed: string[] = [];
  for (const batch of batches) {
    if (signal.aborted) return '';

    const prompt = `Documentation request: ${userPrompt}\n\n` +
      batch.map((s, i) => `--- Part ${i + 1} ---\n${s}`).join('\n\n');

    const result = await queryEasyAI(
      'You are a documentation generator. Condense the following documentation sections ' +
      'into a shorter summary that preserves all key information. Be concise. ' +
      'Use ONLY the information provided — do NOT invent details.',
      prompt,
    );
    condensed.push(result);
  }

  return recursiveMerge(condensed, userPrompt, signal, threshold);
}

// ── Main generation function ───────────────────────────────────────

export async function generateDocumentation(
  options: GenerateOptions,
): Promise<string> {
  const { cache, userPrompt, signal } = options;

  // Resolve threshold based on AI backend
  const threshold = await resolveBatchThreshold();

  const allRecords = cache.getAll();
  const treeRecord = allRecords.find(r => r.filePath === '__directory_tree__');
  const fileRecords = allRecords.filter(r => r.filePath !== '__directory_tree__');

  const aggregatedPrompt = buildAggregatedPrompt(allRecords, userPrompt);

  const systemPrompt =
    'You are a documentation generator. Synthesise the following per-file summaries ' +
    'into a single cohesive Markdown document that addresses the user\'s documentation request. ' +
    'IMPORTANT: Base the documentation ENTIRELY on the per-file summaries provided below. ' +
    'Do NOT invent project names, technologies, or details that are not present in the summaries. ' +
    'Produce well-structured Markdown with headings, lists, and code blocks as appropriate.';

  // Small enough for a single call
  if (aggregatedPrompt.length <= threshold) {
    if (signal.aborted) return '';
    return queryEasyAI(systemPrompt, aggregatedPrompt);
  }

  // Step 1: Batch the per-file summaries and generate partial docs
  const batches = splitIntoBatches(fileRecords, threshold);
  console.log(`[DocGenerator] ${fileRecords.length} file records → ${batches.length} batches (threshold: ${threshold})`);

  const partialDocs: string[] = [];

  for (const batch of batches) {
    if (signal.aborted) return '';

    const batchPrompt = buildAggregatedPrompt(batch, userPrompt);
    const partial = await queryEasyAI(
      'You are a documentation generator. Summarise the following per-file summaries ' +
      'into a concise partial Markdown section. Keep it short but accurate. ' +
      'ONLY use information from the summaries — do NOT invent details.',
      batchPrompt,
    );
    partialDocs.push(partial);
  }

  // Step 2: Add the directory tree as a section
  const allSections: string[] = [];
  if (treeRecord) {
    const treeSummary = treeRecord.summary.length > MAX_TREE_LENGTH
      ? treeRecord.summary.slice(0, MAX_TREE_LENGTH) + '\n[... truncated]'
      : treeRecord.summary;
    allSections.push(`Project Directory Tree:\n${treeSummary}`);
  }
  allSections.push(...partialDocs);

  // Step 3: Recursively merge until it fits in one prompt
  return recursiveMerge(allSections, userPrompt, signal, threshold);
}
