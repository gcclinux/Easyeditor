/**
 * RepoScanner — orchestrates the file-by-file repository scanning pipeline.
 *
 * Validates the repo, collects a directory tree, reads each non-ignored file,
 * sends it to EasyAI for summarisation, and stores results in a CacheStore.
 */

import { detectGitRepoInDirectory } from '../../insertSave';
import { queryEasyAI } from './aiService';
import { GitignoreFilter } from './gitignoreFilter';
import { CacheStore } from './cacheStore';

/** Maximum file content size sent to the AI (50 KB). */
const MAX_FILE_SIZE = 50 * 1024;

// ── Public interfaces ──────────────────────────────────────────────

export interface ScanOptions {
  dirHandle: FileSystemDirectoryHandle;
  userPrompt: string;
  onProgress: (current: number, total: number, filePath: string) => void;
  signal: AbortSignal;
}

export interface ScanResult {
  cache: CacheStore;
  cancelled: boolean;
}

// ── Helper: truncate large file content ────────────────────────────

/**
 * If `content` exceeds `MAX_FILE_SIZE` bytes, return the first 50 KB
 * followed by a truncation note. Otherwise return the content unchanged.
 */
export function truncateContent(content: string): string {
  if (content.length <= MAX_FILE_SIZE) {
    return content;
  }
  return (
    content.slice(0, MAX_FILE_SIZE) +
    '\n\n[Content truncated — file exceeds 50 KB]'
  );
}

// ── Helper: recursively collect file paths ─────────────────────────

/**
 * Walk `dirHandle` recursively and return all relative file paths that
 * are not ignored by the provided `filter`.
 */
export async function collectFilePaths(
  dirHandle: FileSystemDirectoryHandle,
  filter: GitignoreFilter,
  prefix = '',
): Promise<string[]> {
  const paths: string[] = [];

  for await (const [name, handle] of (dirHandle as any).entries()) {
    const relativePath = prefix ? `${prefix}/${name}` : name;

    if (filter.isIgnored(relativePath)) {
      continue;
    }

    if (handle.kind === 'directory') {
      const subPaths = await collectFilePaths(handle, filter, relativePath);
      paths.push(...subPaths);
    } else {
      paths.push(relativePath);
    }
  }

  return paths;
}

// ── Helper: detect file type from extension ────────────────────────

function detectFileType(filePath: string): string {
  const dotIdx = filePath.lastIndexOf('.');
  if (dotIdx === -1) return 'text';
  return filePath.slice(dotIdx + 1).toLowerCase();
}

// ── Request type detection ──────────────────────────────────────────

/**
 * Classify the user's documentation prompt into a request type.
 *
 * Priority order (first match wins): diagram > overview > folder > default.
 * The check is case-insensitive.
 */
export function detectRequestType(userPrompt: string): string {
  const lower = userPrompt.toLowerCase();

  if (lower.includes('diagram')) return 'diagram';
  if (lower.includes('overview') || lower.includes('architecture')) return 'overview';
  if (lower.includes('folder') || lower.includes('structure')) return 'folder';
  return 'default';
}

// ── Per-file prompt builder ────────────────────────────────────────

const FOCUS_INSTRUCTIONS: Record<string, string> = {
  diagram:
    'Focus on module relationships, imports, exports, and dependencies. ' +
    'Identify what this file imports from other modules and what it exports for others to use.',
  overview:
    'Focus on the file\'s purpose, its role in the overall architecture, and its key functionality. ' +
    'Describe how it fits into the larger project.',
  folder:
    'Focus on a concise file description, any configuration it defines, and how it relates to the folder structure.',
  default:
    'Describe the general purpose of this file, its key exports, and its relationships to other modules.',
};

/**
 * Build the system prompt and user prompt for a single-file AI call.
 *
 * The prompt includes the file content (or its truncated form), the user's
 * documentation request, and focus instructions that vary by request type.
 */
export function buildPerFilePrompt(
  filePath: string,
  content: string,
  userPrompt: string,
  requestType: string,
): { systemPrompt: string; userPromptText: string } {
  const focus = FOCUS_INSTRUCTIONS[requestType] ?? FOCUS_INSTRUCTIONS['default'];

  const systemPrompt =
    'You are a code documentation assistant. Analyse ONLY the source file provided below. ' +
    'Base your summary ENTIRELY on the actual file content — do NOT invent or assume anything that is not present in the code. ' +
    'If the file is in a language you recognise, mention the language. ' +
    'Keep your summary to 2-4 sentences maximum. ' +
    focus;

  const userPromptText = [
    `File path: ${filePath}`,
    `User documentation request: ${userPrompt}`,
    '',
    '--- BEGIN FILE CONTENT ---',
    content,
    '--- END FILE CONTENT ---',
    '',
    'Provide a brief 2-4 sentence summary of this file based ONLY on the content above.',
  ].join('\n');

  return { systemPrompt, userPromptText };
}

// ── Main scan function ─────────────────────────────────────────────

/**
 * Scan a repository file-by-file, building an in-memory cache of
 * per-file AI summaries.
 *
 * @throws {Error} If the dirHandle is missing or the directory is not a git repo.
 */
export async function scanRepository(options: ScanOptions): Promise<ScanResult> {
  const { dirHandle, userPrompt, onProgress, signal } = options;
  const cache = new CacheStore();

  // 1. Validate repository
  if (!dirHandle) {
    throw new Error('Please open a Git repository first via EasyGit.');
  }

  const isGitRepo = await detectGitRepoInDirectory(dirHandle);
  if (!isGitRepo) {
    throw new Error('The opened folder is not a Git repository.');
  }

  // 2. Load gitignore filter
  const filter = await GitignoreFilter.fromDirHandle(dirHandle);

  // 3. Collect directory tree
  const filePaths = await collectFilePaths(dirHandle, filter);

  // Store directory tree as a special SummaryRecord
  const repoName = dirHandle.name || 'repository';
  cache.add({
    filePath: '__directory_tree__',
    fileType: 'tree',
    summary: `Repository: ${repoName}\n\nFiles:\n${filePaths.join('\n')}`,
  });

  // 4. Iterate files one-by-one
  const total = filePaths.length;
  let skippedCount = 0;

  for (let i = 0; i < total; i++) {
    // Check cancellation before processing each file
    if (signal.aborted) {
      cache.clear();
      return { cache, cancelled: true };
    }

    const filePath = filePaths[i];

    try {
      // Navigate to the file through nested directory handles
      const segments = filePath.split('/');
      let currentDir: FileSystemDirectoryHandle = dirHandle;

      for (let s = 0; s < segments.length - 1; s++) {
        currentDir = await currentDir.getDirectoryHandle(segments[s]);
      }

      const fileHandle = await currentDir.getFileHandle(segments[segments.length - 1]);
      const file = await fileHandle.getFile();
      const content = await file.text();

      // Skip empty files
      if (!content || content.length === 0) {
        onProgress(i + 1, total, filePath);
        continue;
      }

      // Truncate if needed
      const processedContent = truncateContent(content);

      // Build per-file prompt using request-type-aware strategy
      const requestType = detectRequestType(userPrompt);
      const { systemPrompt, userPromptText } = buildPerFilePrompt(
        filePath,
        processedContent,
        userPrompt,
        requestType,
      );

      // Call AI
      const summary = await queryEasyAI(systemPrompt, userPromptText);

      // Store result
      cache.add({
        filePath,
        fileType: detectFileType(filePath),
        summary,
      });
    } catch (err) {
      // Per-file error: log and skip
      console.error(`[RepoScanner] Error processing ${filePath}:`, err);
      skippedCount++;
    }

    // Report progress after each file (whether success or skip)
    onProgress(i + 1, total, filePath);
  }

  if (skippedCount > 0) {
    console.warn(`[RepoScanner] Skipped ${skippedCount} / ${total} files due to errors`);
  }
  console.log(`[RepoScanner] Scan complete: ${cache.size - 1} file summaries cached (${skippedCount} skipped)`);

  return { cache, cancelled: false };
}
