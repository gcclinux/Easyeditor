/**
 * Unit tests for RepoScanner — detectRequestType and buildPerFilePrompt
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 */

import { detectRequestType, buildPerFilePrompt, truncateContent } from '../repoScanner';

// ── detectRequestType ──────────────────────────────────────────────

describe('detectRequestType', () => {
  it('returns "diagram" when prompt contains "diagram"', () => {
    expect(detectRequestType('Create a mermaid diagram of the project')).toBe('diagram');
  });

  it('returns "diagram" case-insensitively', () => {
    expect(detectRequestType('Generate a DIAGRAM please')).toBe('diagram');
  });

  it('returns "overview" when prompt contains "overview"', () => {
    expect(detectRequestType('Generate a project overview')).toBe('overview');
  });

  it('returns "overview" when prompt contains "architecture"', () => {
    expect(detectRequestType('Describe the architecture')).toBe('overview');
  });

  it('returns "folder" when prompt contains "folder"', () => {
    expect(detectRequestType('Describe folder contents')).toBe('folder');
  });

  it('returns "folder" when prompt contains "structure"', () => {
    expect(detectRequestType('Show the project structure')).toBe('folder');
  });

  it('returns "default" for generic prompts', () => {
    expect(detectRequestType('Document this codebase')).toBe('default');
  });

  it('returns "default" for empty string', () => {
    expect(detectRequestType('')).toBe('default');
  });

  // Priority: diagram > overview > folder
  it('prioritises "diagram" over "overview"', () => {
    expect(detectRequestType('Create a diagram overview')).toBe('diagram');
  });

  it('prioritises "diagram" over "folder"', () => {
    expect(detectRequestType('diagram of folder structure')).toBe('diagram');
  });

  it('prioritises "overview" over "folder"', () => {
    expect(detectRequestType('overview of folder layout')).toBe('overview');
  });
});

// ── buildPerFilePrompt ─────────────────────────────────────────────

describe('buildPerFilePrompt', () => {
  const filePath = 'src/index.ts';
  const content = 'export function main() {}';
  const userPrompt = 'Document this project';

  it('returns an object with systemPrompt and userPromptText', () => {
    const result = buildPerFilePrompt(filePath, content, userPrompt, 'default');
    expect(result).toHaveProperty('systemPrompt');
    expect(result).toHaveProperty('userPromptText');
  });

  it('includes file content in userPromptText', () => {
    const result = buildPerFilePrompt(filePath, content, userPrompt, 'default');
    expect(result.userPromptText).toContain(content);
  });

  it('includes user prompt in userPromptText', () => {
    const result = buildPerFilePrompt(filePath, content, userPrompt, 'default');
    expect(result.userPromptText).toContain(userPrompt);
  });

  it('includes file path in userPromptText', () => {
    const result = buildPerFilePrompt(filePath, content, userPrompt, 'default');
    expect(result.userPromptText).toContain(filePath);
  });

  it('uses diagram focus instructions for "diagram" type', () => {
    const result = buildPerFilePrompt(filePath, content, userPrompt, 'diagram');
    expect(result.systemPrompt).toContain('module relationships');
    expect(result.systemPrompt).toContain('imports');
    expect(result.systemPrompt).toContain('exports');
    expect(result.systemPrompt).toContain('dependencies');
  });

  it('uses overview focus instructions for "overview" type', () => {
    const result = buildPerFilePrompt(filePath, content, userPrompt, 'overview');
    expect(result.systemPrompt).toContain('purpose');
    expect(result.systemPrompt).toContain('role in the overall architecture');
    expect(result.systemPrompt).toContain('key functionality');
  });

  it('uses folder focus instructions for "folder" type', () => {
    const result = buildPerFilePrompt(filePath, content, userPrompt, 'folder');
    expect(result.systemPrompt).toContain('file description');
    expect(result.systemPrompt).toContain('configuration');
    expect(result.systemPrompt).toContain('folder structure');
  });

  it('uses default focus instructions for "default" type', () => {
    const result = buildPerFilePrompt(filePath, content, userPrompt, 'default');
    expect(result.systemPrompt).toContain('general purpose');
    expect(result.systemPrompt).toContain('key exports');
  });

  it('falls back to default focus for unknown request type', () => {
    const result = buildPerFilePrompt(filePath, content, userPrompt, 'unknown');
    expect(result.systemPrompt).toContain('general purpose');
  });
});
