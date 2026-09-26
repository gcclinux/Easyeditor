import {
  aiPersonas,
  buildSystemPrompt,
  getPersonaDescription,
  getPersonaIcon,
  parseFixTarget,
  extractBlock,
  extractTable,
  extractProseSegments
} from '../aiPersonas';

describe('aiPersonas - 8 Core Personas', () => {
  const expectedPersonas = [
    { id: 'architect', icon: '🏗️', desc: 'System & software design' },
    { id: 'developer', icon: '👨‍💻', desc: 'Code generation & fixes' },
    { id: 'writer', icon: '✍️', desc: 'Documentation & prose' },
    { id: 'analyst', icon: '📊', desc: 'Data & business analysis' },
    { id: 'tester', icon: '🧪', desc: 'QA & test strategies' },
    { id: 'scrum-master', icon: '🏃', desc: 'Agile & sprint planning' },
    { id: 'ux-designer', icon: '🎨', desc: 'User experience & flows' },
    { id: 'security', icon: '🔒', desc: 'Security & threat models' },
  ];

  test.each(expectedPersonas)(
    'persona "$id" is defined with icon $icon and description "$desc"',
    ({ id, icon, desc }) => {
      const persona = aiPersonas[id];
      expect(persona).toBeDefined();
      expect(persona.id).toBe(id);
      expect(persona.icon).toBe(icon);
      expect(persona.description).toBe(desc);
      expect(persona.role).toBeTruthy();
      expect(persona.goal).toBeTruthy();
      expect(persona.rules.length).toBeGreaterThan(0);
      expect(getPersonaDescription(id)).toBe(desc);
      expect(getPersonaIcon(id)).toBe(icon);
    }
  );

  test('aliases exist for scrum_master and ux_designer', () => {
    expect(aiPersonas['scrum_master']).toBe(aiPersonas['scrum-master']);
    expect(aiPersonas['ux_designer']).toBe(aiPersonas['ux-designer']);
  });

  test('legacy personas exist as aliases for backward compatibility', () => {
    expect(aiPersonas['markdown']).toBeDefined();
    expect(aiPersonas['mermaid']).toBeDefined();
    expect(aiPersonas['user-story']).toBeDefined();
    expect(aiPersonas['documentation']).toBeDefined();
    expect(aiPersonas['fix-code']).toBeDefined();
    expect(aiPersonas['rewrite']).toBeDefined();
    expect(aiPersonas['architecture']).toBeDefined();
    expect(aiPersonas['implementation']).toBeDefined();
  });

  test('buildSystemPrompt generates complete prompt for personas', () => {
    const prompt = buildSystemPrompt('architect', '## System Context\nLegacy microservice');
    expect(prompt).toContain('Senior Principal Systems & Software Architect');
    expect(prompt).toContain('Legacy microservice');
    expect(prompt).toContain('## Rules');
  });

  test('buildSystemPrompt handles empty editor context gracefully', () => {
    const prompt = buildSystemPrompt('writer', '');
    expect(prompt).toContain('The editor is currently empty');
  });

  test('buildSystemPrompt returns null for unknown actionId', () => {
    expect(buildSystemPrompt('nonexistent-action', '')).toBeNull();
  });

  test('buildSystemPrompt with developer and /fix plantuml targets only plantuml block', () => {
    const content = '# Title\n\n```plantuml\n[Component]\n```\n\nSome text';
    const prompt = buildSystemPrompt('developer', content, '/fix plantuml make direction right');
    expect(prompt).toContain('Targeted Block to Fix');
    expect(prompt).toContain('[Component]');
  });

  test('parseFixTarget correctly identifies directive targets', () => {
    expect(parseFixTarget('/fix mermaid render a flowchart')).toEqual({
      target: 'mermaid',
      cleanPrompt: 'render a flowchart'
    });
    expect(parseFixTarget('/fix all')).toEqual({
      target: 'all',
      cleanPrompt: ''
    });
    expect(parseFixTarget('just generate a class')).toEqual({
      target: null,
      cleanPrompt: 'just generate a class'
    });
  });

  test('extractBlock correctly finds fenced code blocks', () => {
    const content = 'Intro\n```mermaid\ngraph TD\nA-->B\n```\nOutro';
    const result = extractBlock(content, 'mermaid');
    expect(result).not.toBeNull();
    expect(result?.block).toBe('```mermaid\ngraph TD\nA-->B\n```');
  });

  test('extractTable finds markdown tables', () => {
    const content = 'Text before\n| A | B |\n|---|---|\n| 1 | 2 |\nText after';
    const result = extractTable(content);
    expect(result).not.toBeNull();
    expect(result?.block).toContain('| A | B |');
  });

  test('extractProseSegments returns prose sections outside code blocks', () => {
    const content = 'Paragraph 1\n```js\nconst x = 1;\n```\nParagraph 2';
    const segments = extractProseSegments(content);
    expect(segments.length).toBe(2);
    expect(segments[0].text.trim()).toBe('Paragraph 1');
    expect(segments[1].text.trim()).toBe('Paragraph 2');
  });
});
