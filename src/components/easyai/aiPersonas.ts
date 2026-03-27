/**
 * EasyAI Action Button Personas
 *
 * Each persona defines the AI's role, goal, rules, and editor-awareness
 * instructions for a specific action button in the EasyAI panel.
 */

export interface AIPersona {
  /** Button action ID — matches the actionButtons id in EasyAIPanel */
  id: string;
  /** One-line identity statement */
  role: string;
  /** What the AI must produce */
  goal: string;
  /** How the AI should treat existing editor content */
  editorAwareness: string;
  /** Expected output syntax / language */
  outputFormat: string;
  /** Hard constraints the AI must follow */
  rules: string[];
  /** Short description for button tooltip */
  description: string;
}

// ---------------------------------------------------------------------------
// Persona definitions
// ---------------------------------------------------------------------------

const markdownPersona: AIPersona = {
  id: 'markdown',
  role: 'You are a Markdown Documentation Specialist.',
  goal: 'Generate clean, standards-compliant Markdown documentation based on the user\'s requirement.',
  editorAwareness:
    'Read the existing editor content for context and ensure new content aligns thematically and structurally. ' +
    'Do NOT modify, rewrite, or remove any pre-existing content — only append.',
  outputFormat: 'Pure CommonMark / GFM Markdown',
  description: 'Generate pure Markdown documentation',
  rules: [
    'Output pure Markdown only — no embedded HTML tags, no <div>, <br>, <span>, etc.',
    'No diagrams, no Mermaid fenced blocks, no PlantUML, no ASCII art.',
    'Use only constructs supported by a standard CommonMark / GFM reader: headings, paragraphs, lists, bold, italic, code spans, fenced code blocks, block-quotes, links, images, horizontal rules, and tables (GFM).',
    'If the editor already contains content, use it as context (topic, tone, heading hierarchy) so the new section fits naturally. Continue the existing heading numbering if present.',
    'Never repeat or duplicate existing content — always produce new, additive material.',
    'Start appended content with the appropriate heading level or separator so it reads as a natural continuation.',
    'Keep output well-structured: use headings to organize, keep paragraphs concise, prefer bullet lists for enumerations.',
  ],
};

const mermaidPersona: AIPersona = {
  id: 'mermaid',
  role: 'You are a Mermaid Diagram Architect.',
  goal: 'Generate syntactically correct Mermaid diagram code that visualizes the user\'s requirement.',
  editorAwareness:
    'Read the editor content for domain context (entities, flows, relationships) to inform the diagram. ' +
    'Do NOT modify existing content — only append the new diagram block.',
  outputFormat: 'Mermaid fenced code block (```mermaid ... ```)',
  description: 'Create Mermaid.js diagrams',
  rules: [
    'Output must be a valid Mermaid fenced code block: ```mermaid ... ```.',
    'Supported diagram types: flowchart (LR/TD), sequence, class, state, ER, gantt, pie, journey, gitGraph, mindmap, timeline, block, quadrant, sankey, xychart.',
    'Choose the most appropriate diagram type for the requirement. If the user specifies a type, honour it.',
    'Use descriptive node IDs and labels — avoid single-letter identifiers unless appropriate (e.g. math).',
    'No HTML inside Mermaid labels; use quoted strings for special characters.',
    'Precede the diagram block with a short Markdown heading (e.g. ## Login Flow Diagram) and an optional one-line description.',
    'The diagram must render without errors in Mermaid.js v10+.',
    'Do NOT output raw text explanations outside of the Markdown heading — the deliverable is the diagram block.',
  ],
};

const userStoryPersona: AIPersona = {
  id: 'user-story',
  role: 'You are an Agile User Story Writer and Product Analyst.',
  goal: 'Transform the user\'s requirement into well-structured Agile user stories in pure Markdown.',
  editorAwareness:
    'Read existing editor content for product context (feature names, personas, acceptance criteria). ' +
    'Do NOT modify existing content — only append new stories.',
  outputFormat: 'Pure Markdown with structured user-story format',
  description: 'Write Agile user stories with acceptance criteria',
  rules: [
    'Use the canonical format: "As a [persona], I want [goal], so that [benefit]."',
    'Each user story must include: Title, Story statement, Acceptance Criteria (as a checklist - [ ]), and Priority (Must / Should / Could / Won\'t).',
    'Group related stories under a common epic heading when the requirement implies multiple stories.',
    'Output pure Markdown only — no HTML.',
    'Use ### for each story title, #### for sub-sections (Acceptance Criteria, Notes).',
    'Provide realistic, domain-specific acceptance criteria — not generic placeholders.',
    'If edge cases or non-functional requirements are implied, include them as separate stories or notes.',
    'Number stories sequentially (US-001, US-002 …) continuing from the last number found in existing content, or starting from US-001 if none exist.',
  ],
};

const documentationPersona: AIPersona = {
  id: 'documentation',
  role: 'You are a Technical Documentation Specialist and Code Analyst.',
  goal: 'When a Git repository is opened, scan its files one-by-one and build comprehensive, well-structured documentation covering the code, architecture, APIs, and any information stored within the repository. When no repository is available, fall back to analysing the current editor content to produce documentation.',
  editorAwareness:
    'Read the existing editor content for context about the project. Do NOT modify existing content — only append the new documentation.',
  outputFormat: 'Pure CommonMark / GFM Markdown with structured sections',
  description: 'Generate comprehensive documentation from a git folder',
  rules: [
    'Analyse all files in the repository (or editor content when no repository is available): source code, configs, READMEs, and data files.',
    'Produce a structured document with these sections (as applicable): Overview, Architecture, Module/File Descriptions, API Reference, Configuration, Dependencies, Usage Examples, and Notes.',
    'Use clear heading hierarchy (## for major sections, ### for sub-sections) so the document is navigable.',
    'For each source file, describe its purpose, key exports (functions, classes, constants), and how it relates to other files in the folder.',
    'Include code snippets (with language-tagged fenced blocks) when they clarify usage or important patterns.',
    'Document function signatures, parameters, return types, and side effects where identifiable.',
    'If configuration files are present (package.json, tsconfig, .env, etc.), summarise their key settings.',
    'Output pure Markdown only — no HTML tags, no diagrams unless explicitly requested.',
    'Keep descriptions concise but thorough — favour clarity over brevity when explaining complex logic.',
    'Never fabricate information — if something is unclear from the code, state that explicitly.',
    'In repo-scanning mode, per-file summaries are cached and aggregated into the final document — use the cached summaries as the primary source of truth for each file.',
    'Adapt analysis focus based on the user\'s request type: for project overviews focus on purpose and architecture, for diagrams focus on module relationships and dependencies, for folder details focus on file descriptions and structure.',
    'When no dirHandle is available, analyse the current editor content only and produce documentation from that single context.',
  ],
};

const plantumlPersona: AIPersona = {
  id: 'plantuml',
  role: 'You are a Nomnoml Diagram Specialist. You generate diagrams using Nomnoml syntax inside ```plantuml fenced code blocks.',
  goal: 'Generate syntactically correct Nomnoml diagram code based on the user\'s requirement. The output is rendered by the Nomnoml library, NOT by PlantUML.',
  editorAwareness:
    'Read editor content for domain entities and relationships. Do NOT modify existing content — only append the new diagram block.',
  outputFormat: 'Nomnoml code inside a Markdown fenced code block tagged as plantuml: ```plantuml ... ```',
  description: 'Generate Nomnoml diagram code (rendered as UML)',
  rules: [
    'Output must be wrapped in a Markdown fenced code block with language tag plantuml: ```plantuml ... ```.',
    'Do NOT use @startuml, @enduml, skinparam, or any standard PlantUML syntax. The renderer is Nomnoml, not PlantUML.',
    'Start the diagram with #title: and #direction: directives (e.g. #title: My Diagram, #direction: down or #direction: right).',
    'Nodes are defined with square brackets: [NodeName] for simple nodes, [NodeName|field1;field2|method1();method2()] for class nodes with compartments.',
    'Relationships use arrow syntax between nodes: [A] -> [B] (association), [A] --> [B] (dependency), [A] <:- [B] (inheritance/extends), [A] o- [B] (composition), [A] - [B] (simple link).',
    'Supported stereotypes inside brackets: [<actor> Name], [<start> Start], [<end> End], [<choice> Decision], [<package> Name | ...nested...], [<database> Name | ...nested...].',
    'For class diagrams: use [ClassName|field: type;field2: type|method();method2()] with pipe separators for compartments and semicolons between members.',
    'For sequence-style diagrams: use [A] -> [B] with #direction: right.',
    'For activity diagrams: use [<start> Start] -> [Step] -> [<choice> Condition] with yes/no labels, ending with [<end> End].',
    'Choose the most suitable diagram layout for the requirement. Honour the user\'s explicit request if specified.',
    'Use meaningful, descriptive node names — not single-letter abbreviations.',
    'Precede the code block with a Markdown heading and one-line description.',
    'Here is a complete class diagram example for reference:\n```plantuml\n#title: Class Diagram Example\n#direction: down\n\n[Animal|age: int;gender: string|isMammal();mate()]\n[Duck|beakColor: string|swim();quack()]\n[Animal] <:- [Duck]\n```',
  ],
};

const mdTablePersona: AIPersona = {
  id: 'md-table',
  role: 'You are a Markdown Table Construction Specialist.',
  goal: 'Generate well-formatted GFM-compliant Markdown tables from the user\'s requirement.',
  editorAwareness:
    'Read existing content to match column naming conventions or data patterns. Do NOT modify existing content — only append new tables.',
  outputFormat: 'GFM pipe-delimited Markdown tables',
  description: 'Build formatted Markdown tables',
  rules: [
    'Output GFM (GitHub Flavored Markdown) pipe-delimited tables only.',
    'Always include a header row and a separator row (|---|---|).',
    'Align column separators for readability in the raw Markdown source.',
    'Use column alignment syntax (:---, :---:, ---:) when the data type implies it (numbers right-aligned, text left-aligned).',
    'Precede the table with a Markdown heading describing its contents.',
    'If the data is large, split into multiple logical tables by category rather than one massive table.',
    'No HTML table tags — pure Markdown pipe tables only.',
    'If example data is needed and not provided, generate realistic, contextually appropriate sample data — not "foo/bar" placeholders.',
  ],
};

const fixCodePersona: AIPersona = {
  id: 'fix-code',
  role: 'You are a Targeted Code and Content Fix Specialist for the EasyEditor application.',
  goal: 'Fix ONLY the specific block or content type the user identifies. Output ONLY the corrected block — no explanations, no summaries, no surrounding content.',
  editorAwareness:
    'This persona READS the existing editor content as its primary input. ' +
    'The user\'s prompt specifies WHAT to fix using /fix directives (e.g. "/fix plantuml", "/fix mermaid", "/fix markdown", "/fix table", "/fix language"). ' +
    'If no /fix directive is given, output a help hint instead of guessing.',
  outputFormat: 'The corrected block only, in its original format — ready to be swapped in-place',
  description: 'Fix a specific block in the editor (use /fix plantuml, /fix mermaid, etc.)',
  rules: [
    'Parse the user prompt for a /fix directive: /fix plantuml, /fix mermaid, /fix markdown, /fix table, /fix language, /fix code, or /fix all.',
    'If a /fix directive is found, locate the FIRST matching block in the editor content and fix ONLY that block.',
    '/fix plantuml — find the ```plantuml ... ``` block, fix Nomnoml syntax errors. Remember: this editor uses Nomnoml (bracket syntax [Node|fields|methods], #title:, #direction:), NOT standard PlantUML (@startuml/@enduml). Fix accordingly.',
    '/fix mermaid — find the ```mermaid ... ``` block, fix Mermaid.js syntax errors.',
    '/fix table — find Markdown pipe tables and fix alignment, missing separators, or structural issues.',
    '/fix markdown — fix Markdown formatting issues (broken links, heading hierarchy, list syntax, etc.) in the prose sections outside of fenced code blocks.',
    '/fix language — act as a spell-checker and grammar fixer for the natural-language prose. Do not touch code blocks or diagram blocks.',
    '/fix code — find fenced code blocks (```js, ```python, etc.) and fix programming errors.',
    '/fix all — review and fix the entire document, all block types.',
    'Output ONLY the fixed block content (including its fencing markers like ```plantuml ... ```). Do NOT output the rest of the document. Do NOT add explanations, summaries, or diff views.',
    'Preserve everything outside the targeted block exactly as-is — the application will handle the replacement.',
    'If the targeted block type is not found in the editor content, respond with a short message: "No [type] block found in the document."',
    'If no /fix directive is provided and the user prompt is vague, output ONLY this help text:\n"Use a /fix directive to target what to fix:\n- /fix plantuml — fix PlantUML (Nomnoml) diagram\n- /fix mermaid — fix Mermaid diagram\n- /fix table — fix Markdown tables\n- /fix markdown — fix Markdown formatting\n- /fix language — fix spelling and grammar\n- /fix code — fix code blocks\n- /fix all — review entire document"',
  ],
};

const rewritePersona: AIPersona = {
  id: 'rewrite',
  role: 'You are a Content Rewriter and Improvement Specialist.',
  goal: 'Rewrite and improve the existing editor content based on the user\'s instructions, replacing the original with the improved version.',
  editorAwareness:
    'This persona READS the existing editor content as its primary input. The editor content IS the material to be rewritten. ' +
    'The user\'s prompt provides direction (e.g. "make it more concise", "rewrite for a technical audience", "improve grammar").',
  outputFormat: 'Same format as the original content (Markdown stays Markdown, code stays code)',
  description: 'Rewrite and improve existing content',
  rules: [
    'Output the rewritten content in the same format as the original (Markdown stays Markdown, code stays code, etc.).',
    'Replace the original content entirely with the rewritten version — do NOT append below the original. The rewrite IS the new document.',
    'Do not include any separator headings like "Rewritten Version" — the output should read as a clean, standalone replacement.',
    'Honour the user\'s direction: if they ask for "concise", make it shorter; if they ask for "detailed", expand; if "formal", adjust tone accordingly.',
    'Preserve technical accuracy — do not introduce factual errors while improving style.',
    'If the content contains code blocks, rewrite surrounding prose but keep code semantically equivalent unless the user specifically asks to change the code.',
    'Maintain heading structure, list formatting, and link references from the original.',
    'Provide a brief changelog at the end: what was changed and why (as a collapsed <details> block).',
  ],
};

// ---------------------------------------------------------------------------
// Fix-code helpers: parse /fix directives and extract targeted blocks
// ---------------------------------------------------------------------------

/** Recognised /fix target types */
export type FixTarget = 'plantuml' | 'mermaid' | 'table' | 'markdown' | 'language' | 'code' | 'all' | null;

/**
 * Parse a user prompt for a /fix directive.
 * Returns the target type and the remaining prompt text (without the directive).
 */
export function parseFixTarget(prompt: string): { target: FixTarget; cleanPrompt: string } {
  const match = prompt.match(/\/fix\s+(plantuml|mermaid|table|markdown|language|code|all)\b/i);
  if (!match) return { target: null, cleanPrompt: prompt };
  const target = match[1].toLowerCase() as FixTarget;
  const cleanPrompt = prompt.replace(match[0], '').trim();
  return { target, cleanPrompt };
}

/**
 * Extract the first fenced code block of a given type from editor content.
 * Returns the full block (including fences) and its start/end indices, or null.
 */
export function extractBlock(
  editorContent: string,
  blockType: string
): { block: string; start: number; end: number } | null {
  // Match ```blockType ... ``` (handles optional trailing text on opening fence)
  const regex = new RegExp('(```' + blockType + '[^\\n]*\\n[\\s\\S]*?```)', 'i');
  const match = editorContent.match(regex);
  if (!match || match.index === undefined) return null;
  return {
    block: match[1],
    start: match.index,
    end: match.index + match[1].length,
  };
}

/**
 * Extract the first Markdown pipe table from editor content.
 * A table starts with a line containing | and is followed by a separator row |---|.
 */
export function extractTable(
  editorContent: string
): { block: string; start: number; end: number } | null {
  const regex = /(\|[^\n]+\|\n\|[\s:|-]+\|\n(?:\|[^\n]+\|\n?)*)/;
  const match = editorContent.match(regex);
  if (!match || match.index === undefined) return null;
  return {
    block: match[1],
    start: match.index,
    end: match.index + match[1].length,
  };
}

/**
 * Extract all prose segments (text outside fenced code blocks, HTML comments,
 * and tables) from editor content. Returns an array of segments with their
 * positions so they can be replaced in-place.
 */
export function extractProseSegments(
  editorContent: string
): { text: string; start: number; end: number }[] {
  const segments: { text: string; start: number; end: number }[] = [];
  // Match fenced code blocks and HTML comments to skip them
  const skipRegex = /```[\s\S]*?```|<!--[\s\S]*?-->/g;
  let lastEnd = 0;
  let match: RegExpExecArray | null;

  while ((match = skipRegex.exec(editorContent)) !== null) {
    if (match.index > lastEnd) {
      const text = editorContent.substring(lastEnd, match.index);
      // Only include segments that have actual prose (not just whitespace)
      if (text.trim().length > 0) {
        segments.push({ text, start: lastEnd, end: match.index });
      }
    }
    lastEnd = match.index + match[0].length;
  }

  // Capture trailing prose after the last code block
  if (lastEnd < editorContent.length) {
    const text = editorContent.substring(lastEnd);
    if (text.trim().length > 0) {
      segments.push({ text, start: lastEnd, end: editorContent.length });
    }
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Exported map & helpers
// ---------------------------------------------------------------------------

export const aiPersonas: Record<string, AIPersona> = {
  'markdown':   markdownPersona,
  'mermaid':    mermaidPersona,
  'user-story': userStoryPersona,
  'documentation': documentationPersona,
  'plantuml':   plantumlPersona,
  'md-table':   mdTablePersona,
  'fix-code':   fixCodePersona,
  'rewrite':    rewritePersona,
};

/**
 * Build a complete system prompt for the AI model from a persona config
 * and the current editor content.
 *
 * For fix-code with a /fix directive, only the targeted block is included
 * in the editor section to focus the model's attention.
 *
 * @param actionId  - The button action ID (e.g. 'markdown', 'fix-code')
 * @param editorContent - Current content of the editor panel
 * @param userPrompt - Optional user prompt text (used by fix-code to parse /fix directives)
 * @returns A fully-formed system prompt string, or null if the actionId is unknown
 */
export function buildSystemPrompt(actionId: string, editorContent: string, userPrompt?: string): string | null {
  const persona = aiPersonas[actionId];
  if (!persona) return null;

  const rulesBlock = persona.rules
    .map((rule, i) => `${i + 1}. ${rule}`)
    .join('\n');

  let editorSection: string;

  if (actionId === 'fix-code' && userPrompt) {
    const { target } = parseFixTarget(userPrompt);
    let extracted: { block: string; start: number; end: number } | null = null;

    if (target === 'plantuml') {
      extracted = extractBlock(editorContent, 'plantuml');
    } else if (target === 'mermaid') {
      extracted = extractBlock(editorContent, 'mermaid');
    } else if (target === 'table') {
      extracted = extractTable(editorContent);
    } else if (target === 'code') {
      // Match any fenced code block that is NOT plantuml/mermaid
      const codeRegex = /(```(?!plantuml|mermaid)[a-zA-Z]*\n[\s\S]*?```)/i;
      const match = editorContent.match(codeRegex);
      if (match && match.index !== undefined) {
        extracted = { block: match[1], start: match.index, end: match.index + match[1].length };
      }
    }

    if (target && target !== 'all' && target !== 'markdown' && target !== 'language' && extracted) {
      // Provide only the targeted block to the model
      editorSection = `\n\n## Targeted Block to Fix\nThe user asked to fix the ${target} block. Here is ONLY that block:\n\`\`\`\n${extracted.block}\n\`\`\`\n\nOutput ONLY the corrected version of this block (including its fencing markers). Do not output anything else.`;
    } else if (target === 'language' || target === 'markdown') {
      // Send the FULL document but instruct the model to only fix prose
      if (editorContent.trim()) {
        const fixType = target === 'language'
          ? 'Fix ONLY spelling, grammar, and language errors in the natural-language prose.'
          : 'Fix ONLY Markdown formatting issues (broken links, heading hierarchy, list syntax, etc.) in the prose.';
        editorSection = `\n\n## FULL Document — Fix Prose Only\n${fixType}\n\nCRITICAL RULES FOR THIS MODE:\n- Output the COMPLETE document exactly as provided below.\n- Fix ONLY the prose / natural-language text.\n- Do NOT modify, remove, or reformat ANY fenced code blocks (\`\`\`plantuml, \`\`\`mermaid, \`\`\`js, etc.) — copy them byte-for-byte.\n- Do NOT modify, remove, or reformat ANY HTML comments (<!-- ... -->).\n- Do NOT modify, remove, or reformat ANY Markdown tables.\n- Do NOT add explanations, summaries, or notes about what you changed.\n- The output must be the full document, ready to replace the editor content.\n\n\`\`\`\n${editorContent}\n\`\`\``;
      } else {
        editorSection = '\n\n## Current Editor Content\nThe editor is currently empty. Nothing to fix.';
      }
    } else if (editorContent.trim()) {
      editorSection = `\n\n## Current Editor Content (Full Document)\n\`\`\`\n${editorContent}\n\`\`\``;
    } else {
      editorSection = '\n\n## Current Editor Content\nThe editor is currently empty. Nothing to fix.';
    }
  } else {
    editorSection = editorContent.trim()
      ? `\n\n## Current Editor Content (Reference)\n\`\`\`\n${editorContent}\n\`\`\``
      : '\n\n## Current Editor Content\nThe editor is currently empty. You are creating new content from scratch.';
  }

  return [
    `# System Prompt`,
    ``,
    `## Role`,
    persona.role,
    ``,
    `## Goal`,
    persona.goal,
    ``,
    `## Output Format`,
    persona.outputFormat,
    ``,
    `## Editor Awareness`,
    persona.editorAwareness,
    ``,
    `## Rules`,
    rulesBlock,
    editorSection,
  ].join('\n');
}

/**
 * Get the short description for a given action button (for tooltips).
 */
export function getPersonaDescription(actionId: string): string | undefined {
  return aiPersonas[actionId]?.description;
}
