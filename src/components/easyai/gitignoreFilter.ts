/**
 * GitignoreFilter — parses `.gitignore` patterns and determines whether
 * a given relative path should be excluded from repository scanning.
 *
 * Always excludes `.git/` and binary file extensions regardless of patterns.
 */

/** Binary file extensions that are always excluded from scanning. */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.mp3', '.mp4',
  '.zip', '.tar', '.gz',
  '.exe', '.dll', '.so', '.dylib',
  '.pdf', '.lock',
]);

/** Default exclusion patterns when no `.gitignore` file is found. */
const DEFAULT_PATTERNS = ['.git', 'node_modules', 'dist', 'build', '__pycache__'];

interface ParsedPattern {
  /** The regex derived from the gitignore glob. */
  regex: RegExp;
  /** Whether this is a negation pattern (starts with `!`). */
  negated: boolean;
  /** Whether this pattern only matches directories (ends with `/`). */
  dirOnly: boolean;
}

export class GitignoreFilter {
  private readonly parsedPatterns: ParsedPattern[];

  constructor(patterns: string[]) {
    this.parsedPatterns = [];
    for (const raw of patterns) {
      const parsed = GitignoreFilter.parseLine(raw);
      if (parsed) {
        this.parsedPatterns.push(parsed);
      }
    }
  }

  /**
   * Create a GitignoreFilter by reading `.gitignore` from the repo root.
   * Falls back to default exclusions if the file is absent or unreadable.
   */
  static async fromDirHandle(
    dirHandle: FileSystemDirectoryHandle,
  ): Promise<GitignoreFilter> {
    try {
      const fileHandle = await dirHandle.getFileHandle('.gitignore');
      const file = await fileHandle.getFile();
      const text = await file.text();
      const lines = text.split(/\r?\n/);
      return new GitignoreFilter(lines);
    } catch {
      // .gitignore missing or unreadable — use defaults
      return new GitignoreFilter(DEFAULT_PATTERNS);
    }
  }

  /**
   * Returns `true` if the given relative path should be ignored.
   *
   * Checks in order:
   * 1. `.git/` paths are always ignored.
   * 2. Binary file extensions are always ignored.
   * 3. Gitignore patterns are evaluated last-match-wins (with negation support).
   */
  isIgnored(relativePath: string): boolean {
    // Normalise separators
    const path = relativePath.replace(/\\/g, '/');

    // 1. Always exclude .git
    if (path === '.git' || path.startsWith('.git/')) {
      return true;
    }

    // 2. Always exclude binary extensions
    const dotIdx = path.lastIndexOf('.');
    if (dotIdx !== -1) {
      const ext = path.slice(dotIdx).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) {
        return true;
      }
    }

    // 3. Evaluate gitignore patterns (last matching pattern wins)
    let ignored = false;
    for (const pattern of this.parsedPatterns) {
      if (this.matchesPattern(path, pattern)) {
        ignored = !pattern.negated;
      }
    }
    return ignored;
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Parse a single `.gitignore` line into a ParsedPattern, or `null`
   * if the line is a comment or blank.
   */
  private static parseLine(raw: string): ParsedPattern | null {
    let line = raw.trimEnd();

    // Blank lines and comments
    if (!line || line.startsWith('#')) {
      return null;
    }

    // Handle trailing spaces escaped with backslash
    // (not common, but part of gitignore spec)

    let negated = false;
    if (line.startsWith('!')) {
      negated = true;
      line = line.slice(1);
    }

    // Trim leading spaces (after negation removal)
    line = line.trimStart();
    if (!line) return null;

    let dirOnly = false;
    if (line.endsWith('/')) {
      dirOnly = true;
      line = line.slice(0, -1);
    }

    // Root-relative: pattern starts with `/`
    let rootRelative = false;
    if (line.startsWith('/')) {
      rootRelative = true;
      line = line.slice(1);
    }

    // If the pattern contains a `/` in the middle, it's implicitly root-relative
    if (!rootRelative && line.includes('/')) {
      rootRelative = true;
    }

    const regexStr = GitignoreFilter.globToRegex(line, rootRelative);
    const regex = new RegExp(regexStr);

    return { regex, negated, dirOnly };
  }

  /**
   * Convert a gitignore glob pattern to a regex string.
   *
   * Supports: `*` (single segment wildcard), `**` (multi-segment wildcard),
   * `?` (single char), character classes `[...]`.
   */
  private static globToRegex(glob: string, rootRelative: boolean): string {
    let regex = '';
    let i = 0;

    while (i < glob.length) {
      const ch = glob[i];

      if (ch === '*') {
        if (glob[i + 1] === '*') {
          // `**/` or `**` at end
          if (glob[i + 2] === '/') {
            // `**/` matches zero or more directories
            regex += '(?:.+/)?';
            i += 3;
          } else {
            // `**` at end matches everything
            regex += '.*';
            i += 2;
          }
        } else {
          // Single `*` matches anything except `/`
          regex += '[^/]*';
          i++;
        }
      } else if (ch === '?') {
        regex += '[^/]';
        i++;
      } else if (ch === '[') {
        // Character class — pass through until `]`
        const close = glob.indexOf(']', i + 1);
        if (close === -1) {
          regex += '\\[';
          i++;
        } else {
          regex += glob.slice(i, close + 1);
          i = close + 1;
        }
      } else if (ch === '.') {
        regex += '\\.';
        i++;
      } else if (ch === '/') {
        regex += '/';
        i++;
      } else {
        // Escape other regex-special chars
        regex += ch.replace(/[{}()+^$|\\]/g, '\\$&');
        i++;
      }
    }

    if (rootRelative) {
      // Must match from the start of the path
      return `^${regex}(?:/|$)`;
    }
    // Non-root-relative: can match any segment
    return `(?:^|/)${regex}(?:/|$)`;
  }

  /**
   * Test whether a normalised path matches a single parsed pattern.
   */
  private matchesPattern(path: string, pattern: ParsedPattern): boolean {
    // dirOnly patterns only match directories; since we don't know if a path
    // is a directory from the string alone, we match if the path itself matches
    // OR if any prefix of the path matches (i.e. the path is inside the dir).
    if (pattern.dirOnly) {
      // Check if the path itself or any parent matches
      return pattern.regex.test(path);
    }
    return pattern.regex.test(path);
  }
}
