/**
 * TauriRepoScanner — Tauri-native version of the repo scanner.
 *
 * Uses Tauri's plugin-fs (readDir, readTextFile, exists) instead of
 * the web File System Access API (FileSystemDirectoryHandle).
 */

import { queryEasyAI } from './aiService';
import { GitignoreFilter } from './gitignoreFilter';
import { CacheStore } from './cacheStore';
import { truncateContent, detectRequestType, buildPerFilePrompt } from './repoScanner';

export interface TauriScanOptions {
  repoPath: string;
  userPrompt: string;
  onProgress: (current: number, total: number, filePath: string) => void;
  signal: AbortSignal;
}

export interface TauriScanResult {
  cache: CacheStore;
  cancelled: boolean;
}

/** Detect file type from extension. */
function detectFileType(filePath: string): string {
  const dotIdx = filePath.lastIndexOf('.');
  if (dotIdx === -1) return 'text';
  return filePath.slice(dotIdx + 1).toLowerCase();
}

/**
 * Recursively collect all relative file paths under `dirPath`,
 * filtering out ignored paths via the GitignoreFilter.
 */
async function collectFilePathsTauri(
  dirPath: string,
  basePath: string,
  filter: GitignoreFilter,
): Promise<string[]> {
  const { readDir } = await import('@tauri-apps/plugin-fs');
  const paths: string[] = [];

  let entries;
  try {
    entries = await readDir(dirPath);
  } catch {
    return paths;
  }

  for (const entry of entries) {
    const name = entry.name;
    const relativePath = dirPath === basePath
      ? name
      : `${dirPath.slice(basePath.length + 1)}/${name}`;

    if (filter.isIgnored(relativePath)) {
      continue;
    }

    if (entry.isDirectory) {
      const subPaths = await collectFilePathsTauri(
        `${dirPath}/${name}`,
        basePath,
        filter,
      );
      paths.push(...subPaths);
    } else if (entry.isFile) {
      paths.push(relativePath);
    }
  }

  return paths;
}

/**
 * Load a GitignoreFilter by reading .gitignore from the repo root via Tauri FS.
 */
async function loadGitignoreFilterTauri(repoPath: string): Promise<GitignoreFilter> {
  const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
  const gitignorePath = `${repoPath}/.gitignore`;

  try {
    if (await exists(gitignorePath)) {
      const text = await readTextFile(gitignorePath);
      const lines = text.split(/\r?\n/);
      return new GitignoreFilter(lines);
    }
  } catch {
    // Fall through to defaults
  }

  return new GitignoreFilter(['.git', 'node_modules', 'dist', 'build', '__pycache__']);
}

/**
 * Scan a repository file-by-file using Tauri's native FS APIs.
 */
export async function scanRepositoryTauri(options: TauriScanOptions): Promise<TauriScanResult> {
  const { repoPath, userPrompt, onProgress, signal } = options;
  const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
  const cache = new CacheStore();

  // 1. Validate repository
  if (!repoPath) {
    throw new Error('No repository path provided. Please open a repository first via EasyGit.');
  }

  const gitExists = await exists(`${repoPath}/.git`);
  if (!gitExists) {
    throw new Error('The opened folder is not a Git repository (no .git directory found).');
  }

  console.log(`[TauriRepoScanner] Scanning repository: ${repoPath}`);

  // 2. Load gitignore filter
  const filter = await loadGitignoreFilterTauri(repoPath);

  // 3. Collect directory tree
  const filePaths = await collectFilePathsTauri(repoPath, repoPath, filter);
  console.log(`[TauriRepoScanner] Found ${filePaths.length} files to scan`);

  // Store directory tree
  const repoName = repoPath.split(/[/\\]/).pop() || 'repository';
  cache.add({
    filePath: '__directory_tree__',
    fileType: 'tree',
    summary: `Repository: ${repoName}\n\nFiles:\n${filePaths.join('\n')}`,
  });

  // 4. Iterate files one-by-one
  const total = filePaths.length;
  let skippedCount = 0;

  for (let i = 0; i < total; i++) {
    if (signal.aborted) {
      cache.clear();
      return { cache, cancelled: true };
    }

    const filePath = filePaths[i];
    const absolutePath = `${repoPath}/${filePath}`;

    try {
      const content = await readTextFile(absolutePath);

      // Skip empty files
      if (!content || content.length === 0) {
        onProgress(i + 1, total, filePath);
        continue;
      }

      // Truncate if needed
      const processedContent = truncateContent(content);

      // Build per-file prompt
      const requestType = detectRequestType(userPrompt);
      const { systemPrompt, userPromptText } = buildPerFilePrompt(
        filePath,
        processedContent,
        userPrompt,
        requestType,
      );

      // Call AI
      const summary = await queryEasyAI(systemPrompt, userPromptText);

      cache.add({
        filePath,
        fileType: detectFileType(filePath),
        summary,
      });
    } catch (err) {
      console.error(`[TauriRepoScanner] Error processing ${filePath}:`, err);
      skippedCount++;
    }

    onProgress(i + 1, total, filePath);
  }

  if (skippedCount > 0) {
    console.warn(`[TauriRepoScanner] Skipped ${skippedCount} / ${total} files due to errors`);
  }
  console.log(`[TauriRepoScanner] Scan complete: ${cache.size - 1} file summaries cached (${skippedCount} skipped)`);

  return { cache, cancelled: false };
}
