/**
 * Property-based tests for GitignoreFilter
 * Feature: documentation-persona-repo-scanner, Property 2: Gitignore filter path matching
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 8.1**
 *
 * Property 2: For any set of `.gitignore` patterns and any relative file path,
 * the `GitignoreFilter.isIgnored()` method shall return `true` if and only if
 * the path matches at least one non-negated pattern or has a binary file extension,
 * and shall always return `true` for paths under `.git/` regardless of pattern content.
 * When no `.gitignore` is loaded, the default exclusion list (`.git`, `node_modules`,
 * `dist`, `build`, `__pycache__`) shall be applied.
 */

import * as fc from 'fast-check';
import { GitignoreFilter } from '../gitignoreFilter';

// Binary extensions from the implementation
const BINARY_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.mp3', '.mp4',
  '.zip', '.tar', '.gz',
  '.exe', '.dll', '.so', '.dylib',
  '.pdf', '.lock',
];

const DEFAULT_EXCLUSIONS = ['.git', 'node_modules', 'dist', 'build', '__pycache__'];

/** Generate a safe path segment (alphanumeric + underscore/hyphen). */
const safeSegment = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
    minLength: 1,
    maxLength: 8,
  })
  .map((chars) => chars.join(''));

/** Generate a relative file path like "src/utils/helper.ts". */
const relativePath = fc
  .tuple(
    fc.array(safeSegment, { minLength: 1, maxLength: 4 }),
    safeSegment,
    fc.constantFrom('.ts', '.js', '.md', '.json', '.txt', '.py', '.rs'),
  )
  .map(([dirs, name, ext]) => [...dirs, `${name}${ext}`].join('/'));

/** Generate a path under .git/ */
const gitPath = fc
  .tuple(
    fc.array(safeSegment, { minLength: 0, maxLength: 3 }),
    safeSegment,
  )
  .map(([dirs, name]) => ['.git', ...dirs, name].join('/'));

/** Generate a path with a binary extension. */
const binaryPath = fc
  .tuple(
    fc.array(safeSegment, { minLength: 1, maxLength: 3 }),
    safeSegment,
    fc.constantFrom(...BINARY_EXTENSIONS),
  )
  .map(([dirs, name, ext]) => [...dirs, `${name}${ext}`].join('/'));


// Feature: documentation-persona-repo-scanner, Property 2: Gitignore filter path matching
describe('Property 2: Gitignore filter path matching', () => {
  // **Validates: Requirements 2.3**
  // .git/ paths are always ignored regardless of pattern content
  it('always ignores paths under .git/ regardless of patterns', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('*.ts', '!.git', '!.git/**', 'src/', '*.js', '!.git/config'),
          { minLength: 0, maxLength: 5 },
        ),
        gitPath,
        (patterns, path) => {
          const filter = new GitignoreFilter(patterns);
          expect(filter.isIgnored(path)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 2.3**
  // .git itself is always ignored
  it('always ignores the .git directory itself', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('!.git', '*.ts', 'node_modules'), { minLength: 0, maxLength: 5 }),
        (patterns) => {
          const filter = new GitignoreFilter(patterns);
          expect(filter.isIgnored('.git')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 2.5**
  // Binary file extensions are always ignored
  it('always ignores files with binary extensions', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('*.ts', 'src/', '!*.png'), { minLength: 0, maxLength: 5 }),
        binaryPath,
        (patterns, path) => {
          const filter = new GitignoreFilter(patterns);
          expect(filter.isIgnored(path)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 2.1, 2.2**
  // A file matching a non-negated pattern is ignored
  it('ignores files matching a non-negated pattern', () => {
    fc.assert(
      fc.property(
        safeSegment,
        fc.constantFrom('.ts', '.js', '.md', '.json', '.txt'),
        (name, ext) => {
          const filter = new GitignoreFilter([`*${ext}`]);
          const path = `src/${name}${ext}`;
          expect(filter.isIgnored(path)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 2.2**
  // A file NOT matching any pattern is NOT ignored
  it('does not ignore files that match no patterns', () => {
    fc.assert(
      fc.property(
        relativePath,
        (path) => {
          // Empty patterns: nothing should be ignored (except .git and binary)
          const filter = new GitignoreFilter([]);
          expect(filter.isIgnored(path)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 2.4, 8.1**
  // Default exclusion list is applied when constructed with default patterns
  it('applies default exclusion list when constructed with default patterns', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DEFAULT_EXCLUSIONS.filter((d) => d !== '.git')),
        safeSegment,
        fc.constantFrom('.ts', '.js', '.md'),
        (dir, name, ext) => {
          const filter = new GitignoreFilter(DEFAULT_EXCLUSIONS);
          const path = `${dir}/${name}${ext}`;
          expect(filter.isIgnored(path)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 2.1, 2.2**
  // Negation patterns can un-ignore a previously ignored file (last match wins)
  it('supports negation patterns with last-match-wins semantics', () => {
    fc.assert(
      fc.property(safeSegment, (name) => {
        const specificFile = `${name}.ts`;
        const filter = new GitignoreFilter(['*.ts', `!${specificFile}`]);
        // The specific file should NOT be ignored (negation wins)
        expect(filter.isIgnored(specificFile)).toBe(false);
        // Other .ts files should still be ignored
        expect(filter.isIgnored('other.ts')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 2.1, 2.2**
  // Comments and blank lines are ignored in patterns
  it('ignores comment lines and blank lines in patterns', () => {
    fc.assert(
      fc.property(
        relativePath,
        fc.array(fc.constantFrom('# this is a comment', '', '  ', '# ignore everything'), {
          minLength: 1,
          maxLength: 5,
        }),
        (path, commentPatterns) => {
          const filter = new GitignoreFilter(commentPatterns);
          expect(filter.isIgnored(path)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 2.1, 2.2**
  // Wildcard patterns match correctly
  it('matches wildcard patterns across file names', () => {
    fc.assert(
      fc.property(safeSegment, safeSegment, (dir, name) => {
        const filter = new GitignoreFilter([`${dir}/*`]);
        const path = `${dir}/${name}.ts`;
        expect(filter.isIgnored(path)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 2.5**
  // Binary extension check is case-insensitive
  it('ignores binary extensions regardless of case', () => {
    fc.assert(
      fc.property(
        safeSegment,
        fc.constantFrom('.PNG', '.Jpg', '.JPEG', '.GIF', '.PDF', '.ZIP', '.EXE'),
        (name, ext) => {
          const filter = new GitignoreFilter([]);
          expect(filter.isIgnored(`src/${name}${ext}`)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
