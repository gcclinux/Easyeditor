/**
 * Unit tests for GitignoreFilter
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
 *
 * Tests cover:
 * - Parsing known `.gitignore` content and verifying specific paths included/excluded
 * - Default exclusion list when no `.gitignore` exists
 * - `.git` is always excluded even if `.gitignore` tries to include it
 * - Binary extension exclusion
 */

import { GitignoreFilter } from '../gitignoreFilter';

describe('GitignoreFilter', () => {
  // ── Requirement 2.1, 2.2: Parsing .gitignore patterns ──────────────

  describe('pattern parsing and matching', () => {
    it('ignores files matching a simple wildcard pattern', () => {
      const filter = new GitignoreFilter(['*.log']);
      expect(filter.isIgnored('debug.log')).toBe(true);
      expect(filter.isIgnored('src/app.log')).toBe(true);
      expect(filter.isIgnored('src/app.ts')).toBe(false);
    });

    it('ignores directories by name', () => {
      const filter = new GitignoreFilter(['node_modules']);
      expect(filter.isIgnored('node_modules/package.json')).toBe(true);
      expect(filter.isIgnored('src/index.ts')).toBe(false);
    });

    it('supports directory-only patterns with trailing slash', () => {
      const filter = new GitignoreFilter(['build/']);
      expect(filter.isIgnored('build/output.js')).toBe(true);
      expect(filter.isIgnored('build')).toBe(true);
    });

    it('supports root-relative patterns with leading slash', () => {
      const filter = new GitignoreFilter(['/config.json']);
      expect(filter.isIgnored('config.json')).toBe(true);
      // Nested config.json should NOT match a root-relative pattern
      expect(filter.isIgnored('src/config.json')).toBe(false);
    });

    it('supports double-star glob for recursive matching', () => {
      const filter = new GitignoreFilter(['**/test/**']);
      expect(filter.isIgnored('src/test/unit.ts')).toBe(true);
      expect(filter.isIgnored('test/unit.ts')).toBe(true);
    });

    it('skips comment lines', () => {
      const filter = new GitignoreFilter(['# this is a comment', '*.log']);
      expect(filter.isIgnored('app.log')).toBe(true);
      expect(filter.isIgnored('app.ts')).toBe(false);
    });

    it('skips blank lines', () => {
      const filter = new GitignoreFilter(['', '  ', '*.tmp']);
      expect(filter.isIgnored('cache.tmp')).toBe(true);
      expect(filter.isIgnored('index.ts')).toBe(false);
    });

    it('supports negation patterns (last match wins)', () => {
      const filter = new GitignoreFilter(['*.js', '!important.js']);
      expect(filter.isIgnored('bundle.js')).toBe(true);
      expect(filter.isIgnored('important.js')).toBe(false);
    });

    it('handles multiple patterns with last-match-wins semantics', () => {
      const filter = new GitignoreFilter(['*.ts', '!src/keep.ts', 'src/keep.ts']);
      // Last pattern re-ignores it
      expect(filter.isIgnored('src/keep.ts')).toBe(true);
    });

    it('matches paths containing a slash as root-relative', () => {
      const filter = new GitignoreFilter(['src/temp']);
      expect(filter.isIgnored('src/temp/file.ts')).toBe(true);
      // Should not match temp in a different directory
      expect(filter.isIgnored('lib/temp/file.ts')).toBe(false);
    });
  });

  // ── Requirement 2.3: .git always excluded ──────────────────────────

  describe('.git always excluded', () => {
    it('excludes .git directory with no patterns', () => {
      const filter = new GitignoreFilter([]);
      expect(filter.isIgnored('.git')).toBe(true);
      expect(filter.isIgnored('.git/config')).toBe(true);
      expect(filter.isIgnored('.git/objects/abc123')).toBe(true);
    });

    it('excludes .git even when negation pattern tries to include it', () => {
      const filter = new GitignoreFilter(['!.git', '!.git/**', '!.git/config']);
      expect(filter.isIgnored('.git')).toBe(true);
      expect(filter.isIgnored('.git/config')).toBe(true);
      expect(filter.isIgnored('.git/HEAD')).toBe(true);
    });

    it('does not exclude files that merely start with .git in name', () => {
      const filter = new GitignoreFilter([]);
      expect(filter.isIgnored('.gitignore')).toBe(false);
      expect(filter.isIgnored('.github/workflows/ci.yml')).toBe(false);
    });
  });

  // ── Requirement 2.4: Default exclusion list ────────────────────────

  describe('default exclusion list', () => {
    const defaultPatterns = ['.git', 'node_modules', 'dist', 'build', '__pycache__'];

    it('excludes default directories when constructed with default patterns', () => {
      const filter = new GitignoreFilter(defaultPatterns);
      expect(filter.isIgnored('node_modules/lodash/index.js')).toBe(true);
      expect(filter.isIgnored('dist/bundle.js')).toBe(true);
      expect(filter.isIgnored('build/output.css')).toBe(true);
      expect(filter.isIgnored('__pycache__/module.pyc')).toBe(true);
    });

    it('allows non-default paths when using default patterns', () => {
      const filter = new GitignoreFilter(defaultPatterns);
      expect(filter.isIgnored('src/index.ts')).toBe(false);
      expect(filter.isIgnored('README.md')).toBe(false);
      expect(filter.isIgnored('package.json')).toBe(false);
    });
  });

  // ── Requirement 2.5: Binary extension exclusion ────────────────────

  describe('binary extension exclusion', () => {
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
      '.woff', '.woff2', '.ttf', '.eot',
      '.mp3', '.mp4',
      '.zip', '.tar', '.gz',
      '.exe', '.dll', '.so', '.dylib',
      '.pdf', '.lock',
    ];

    it('excludes all known binary extensions', () => {
      const filter = new GitignoreFilter([]);
      for (const ext of binaryExtensions) {
        expect(filter.isIgnored(`assets/file${ext}`)).toBe(true);
      }
    });

    it('excludes binary extensions case-insensitively', () => {
      const filter = new GitignoreFilter([]);
      expect(filter.isIgnored('images/logo.PNG')).toBe(true);
      expect(filter.isIgnored('fonts/arial.TTF')).toBe(true);
      expect(filter.isIgnored('docs/manual.PDF')).toBe(true);
    });

    it('excludes binary extensions even with negation patterns', () => {
      const filter = new GitignoreFilter(['!*.png', '!*.pdf']);
      expect(filter.isIgnored('icon.png')).toBe(true);
      expect(filter.isIgnored('report.pdf')).toBe(true);
    });

    it('does not exclude non-binary extensions', () => {
      const filter = new GitignoreFilter([]);
      expect(filter.isIgnored('src/app.ts')).toBe(false);
      expect(filter.isIgnored('README.md')).toBe(false);
      expect(filter.isIgnored('data.json')).toBe(false);
      expect(filter.isIgnored('style.css')).toBe(false);
    });

    it('handles binary files in nested directories', () => {
      const filter = new GitignoreFilter([]);
      expect(filter.isIgnored('public/images/deep/nested/photo.jpg')).toBe(true);
      expect(filter.isIgnored('src/assets/fonts/custom.woff2')).toBe(true);
    });
  });

  // ── Backslash normalization ────────────────────────────────────────

  describe('path normalization', () => {
    it('normalizes backslashes to forward slashes', () => {
      const filter = new GitignoreFilter(['dist']);
      expect(filter.isIgnored('dist\\bundle.js')).toBe(true);
    });

    it('normalizes .git paths with backslashes', () => {
      const filter = new GitignoreFilter([]);
      expect(filter.isIgnored('.git\\config')).toBe(true);
    });
  });
});
