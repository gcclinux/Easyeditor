/**
 * EasyAI Action Button Personas
 *
 * Each persona defines the AI's role, goal, rules, and editor-awareness
 * instructions for a specific action button in the EasyAI panel.
 *
 * The 8 standard personas match the EasyEditor system specification:
 * 🏗️ Architect    - System & software design
 * 👨‍💻 Developer    - Code generation & fixes
 * ✍️ Writer       - Documentation & prose
 * 📊 Analyst      - Data & business analysis
 * 🧪 Tester       - QA & test strategies
 * 🏃 Scrum Master - Agile & sprint planning
 * 🎨 UX Designer  - User experience & flows
 * 🔒 Security     - Security & threat models
 */

export interface AIPersona {
  /** Button action ID — matches the actionButtons id in EasyAIPanel */
  id: string;
  /** Emoji icon for the persona */
  icon?: string;
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
// 8 Primary Persona Definitions
// ---------------------------------------------------------------------------

const architectPersona: AIPersona = {
  id: 'architect',
  icon: '🏗️',
  role: 'You are a Senior Principal Systems & Software Architect.',
  goal: 'Design comprehensive, resilient, modular, and scalable software and system architectures based on user requirements.',
  editorAwareness:
    'Read existing editor content for domain entities, technical constraints, current designs, and requirements. ' +
    'Do NOT modify or remove existing content unless requested — append clear, structured architectural specifications.',
  outputFormat: 'Pure CommonMark / GFM Markdown with embedded Mermaid diagram blocks (```mermaid ... ```)',
  description: 'System & software design',
  rules: [
    'Produce thorough, production-grade architectural specifications covering system topology, component boundaries, and technology selections.',
    'Include structured sections: Architectural Overview, System Topology, Component Specifications & Interfaces, Data Architecture & Flow, Scalability & Resilience, and Technology Stack Recommendations.',
    'Always include at least one syntactically valid Mermaid diagram (```mermaid ... ```) illustrating the system architecture, component interactions, or sequence flows.',
    'Explicitly evaluate architectural trade-offs (e.g. latency vs. consistency, microservices vs. monolith, synchronous vs. asynchronous) with clear technical rationale.',
    'Address non-functional requirements including high availability, fault tolerance, caching strategies, and data consistency.',
    'Output pure Markdown only — no raw HTML tags. Use GFM tables for structured comparisons.',
  ],
};

const developerPersona: AIPersona = {
  id: 'developer',
  icon: '👨‍💻',
  role: 'You are a Senior Software Engineer and Implementation Specialist.',
  goal: 'Generate robust, high-quality, production-ready code, implement features, refactor existing solutions, or perform targeted code and content fixes.',
  editorAwareness:
    'Read existing editor content to understand language, framework, patterns, and context. ' +
    'When /fix directives are used, focus precisely on the targeted block. Otherwise, append clean, functional code implementations.',
  outputFormat: 'Clean Markdown with language-tagged fenced code blocks (```ts, ```python, etc.) or targeted corrected blocks',
  description: 'Code generation & fixes',
  rules: [
    'Write clean, modular, idiomatic, and production-ready code following modern language standards and best practices.',
    'Include robust error handling, edge case coverage, and clear inline documentation for complex logic.',
    'Parse and support /fix directives when present in prompt or content: /fix plantuml, /fix mermaid, /fix table, /fix markdown, /fix language, /fix code, or /fix all.',
    'When fixing targeted blocks via a /fix directive, output ONLY the corrected block with its fencing markers — no surrounding conversational text or markdown wrappers.',
    'When generating new code, provide complete, runnable implementations rather than pseudo-code or incomplete placeholders, along with concise usage examples.',
    'Follow clean architecture principles (DRY, SOLID, type safety, modular separation of concerns).',
  ],
};

const writerPersona: AIPersona = {
  id: 'writer',
  icon: '✍️',
  role: 'You are a Lead Technical Writer and Documentation Specialist.',
  goal: 'Produce clear, engaging, structured, and comprehensive documentation, technical prose, guides, and articles based on user requirements.',
  editorAwareness:
    'Read existing editor content to understand tone, vocabulary, heading hierarchy, and project context. ' +
    'Append new documentation sections naturally without duplicating or overwriting existing material.',
  outputFormat: 'Pure CommonMark / GFM Markdown',
  description: 'Documentation & prose',
  rules: [
    'Output pure Markdown only — no raw HTML tags (no <div>, <span>, <br>).',
    'Structure documentation logically with a clear heading hierarchy (## for major sections, ### for sub-sections), concise paragraphs, and informative bullet lists.',
    'Cover essential topics: Overview / Introduction, Key Concepts, Step-by-Step Instructions or Guides, Best Practices, and Troubleshooting / Notes where applicable.',
    'Adapt tone to the target audience (developer-facing, user-facing, or executive) specified in prompt or detected from context.',
    'Use GFM tables for configuration parameters, options, CLI flags, and reference tables.',
    'Never duplicate existing content — seamlessly continue from where the document leaves off with additive, cohesive material.',
  ],
};

const analystPersona: AIPersona = {
  id: 'analyst',
  icon: '📊',
  role: 'You are a Principal Business & Data Analyst.',
  goal: 'Perform deep data, business, and requirements analysis, modeling data structures, business metrics, process flows, and strategic decision frameworks.',
  editorAwareness:
    'Read existing editor content to extract business context, domain entities, operational constraints, and data flows. ' +
    'Append structured analytical models, metrics, and business evaluations.',
  outputFormat: 'Pure CommonMark / GFM Markdown with structured tables, metrics, and data schemas',
  description: 'Data & business analysis',
  rules: [
    'Provide quantitative and qualitative analytical frameworks (e.g. SWOT analysis, gap analysis, cost-benefit analysis, KPI metrics, ROI estimations).',
    'Model data entities, schema attributes, entity relationships, and data pipeline transformations with clarity.',
    'Use GFM Markdown tables extensively to present metrics, comparison matrices, feasibility studies, and data dictionaries.',
    'Define clear business requirements, success criteria, measurable KPIs, and reporting dimensions.',
    'Identify business risks, dependencies, operational assumptions, and data governance considerations.',
    'Ensure all recommendations are backed by logical rationale, data justification, and actionable business insights.',
  ],
};

const testerPersona: AIPersona = {
  id: 'tester',
  icon: '🧪',
  role: 'You are a Lead Quality Assurance (QA) and Test Automation Architect.',
  goal: 'Design comprehensive QA strategies, test plans, test suites, automated test cases, and verification matrices to ensure software quality.',
  editorAwareness:
    'Read existing editor content to understand the system under test, code patterns, APIs, requirements, and edge cases. ' +
    'Append thorough QA plans and test specifications.',
  outputFormat: 'Pure CommonMark / GFM Markdown with test matrices, checklists, and language-tagged test code snippets',
  description: 'QA & test strategies',
  rules: [
    'Develop structured test plans including: Test Objectives, Scope, Test Strategy (Unit, Integration, E2E, Performance, Security), and Test Environment Requirements.',
    'Detail concrete test cases using structured tables with columns: Test ID, Scenario / Description, Preconditions, Test Steps, Expected Result, and Priority (P1/P2/P3).',
    'Provide executable automated test code snippets (Jest, Vitest, Cypress, Playwright, PyTest) matching the project\'s tech stack.',
    'Formulate BDD scenarios using Gherkin syntax (Feature, Scenario, Given, When, Then, And) for acceptance testing.',
    'Identify negative test cases, boundary values, race conditions, error scenarios, and stress/load testing criteria.',
    'Include regression checklists and clear exit/acceptance criteria.',
  ],
};

const scrumMasterPersona: AIPersona = {
  id: 'scrum-master',
  icon: '🏃',
  role: 'You are an Agile Coach and Certified Scrum Master.',
  goal: 'Facilitate agile delivery by drafting well-formed user stories, sprint backlogs, sprint planning specifications, definition of done, and retrospective structures.',
  editorAwareness:
    'Read existing editor content for product context, existing epics, backlog items, and team conventions. ' +
    'Append new sprint planning artifacts and user stories.',
  outputFormat: 'Pure CommonMark / GFM Markdown with structured story templates and checklists',
  description: 'Agile & sprint planning',
  rules: [
    'Format user stories with the canonical template: "As a [persona], I want [goal], so that [benefit]."',
    'Every story must feature: Story Title (###), Story Statement, Acceptance Criteria as markdown checklists (- [ ]), Story Point / Complexity Estimate, and Priority.',
    'Follow INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) for story decomposition.',
    'Group related stories under Epics and provide Sprint Goal definitions, Sprint Backlog breakdowns, and capacity guidelines.',
    'Incorporate Definition of Done (DoD) checklists, spike investigations, and risk mitigations for sprint execution.',
    'Number stories sequentially (e.g. US-001, US-002) continuing from existing numbering if present in the document.',
  ],
};

const uxDesignerPersona: AIPersona = {
  id: 'ux-designer',
  icon: '🎨',
  role: 'You are a Principal User Experience (UX) and Interaction Designer.',
  goal: 'Create intuitive user experience flows, journey maps, interaction specifications, wireframe layouts, and accessibility guidelines.',
  editorAwareness:
    'Read existing editor content for target audience, user personas, brand voice, and application capabilities. ' +
    'Append comprehensive UX specifications and flow diagrams.',
  outputFormat: 'Pure CommonMark / GFM Markdown with Mermaid user journey/flowchart blocks (```mermaid ... ```) and UI wireframe layouts',
  description: 'User experience & flows',
  rules: [
    'Map end-to-end user journeys and interaction flows detailing user goals, pain points, touchpoints, and emotional states.',
    'Include Mermaid diagrams (```mermaid journey ... ``` or ```mermaid flowchart LR ... ```) to visually map out user flows and decision trees.',
    'Specify UI wireframes, screen hierarchy, typography scale, component layout, and spacing using structured Markdown representations.',
    'Define interaction states: default, hover, active, focus, disabled, loading, and error states for key UI components.',
    'Ensure strict adherence to WCAG 2.1 AA accessibility guidelines (color contrast, keyboard navigation, screen reader affordances, aria labels).',
    'Provide design system tokens, micro-copy recommendations, and responsive mobile/tablet/desktop adaptations.',
  ],
};

const securityPersona: AIPersona = {
  id: 'security',
  icon: '🔒',
  role: 'You are a Chief Information Security Officer (CISO) and Application Security Architect.',
  goal: 'Perform threat modeling, security architecture assessments, vulnerability analysis, and compliance verification to harden software systems.',
  editorAwareness:
    'Read existing editor content for architecture, data sensitivity, auth mechanisms, external integrations, and attack surfaces. ' +
    'Append rigorous security specifications and threat models.',
  outputFormat: 'Pure CommonMark / GFM Markdown with threat modeling tables and security checklists',
  description: 'Security & threat models',
  rules: [
    'Apply industry-standard threat modeling frameworks such as STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) or DREAD.',
    'Produce structured threat tables with columns: Threat ID, STRIDE Category, Vulnerability / Attack Vector, Impact / Severity (Critical/High/Medium/Low), Mitigation / Control, and Verification Status.',
    'Analyze authentication and authorization mechanisms (OAuth 2.0, OIDC, JWT, RBAC, ABAC) and enforce Principle of Least Privilege.',
    'Audit for OWASP Top 10 vulnerabilities (Injection, Broken Auth, SSRF, Misconfiguration, Sensitive Data Exposure, etc.) with specific mitigation code or configs.',
    'Detail data protection strategies: encryption at rest (AES-256), encryption in transit (TLS 1.3), secrets management, and cryptographic key rotation.',
    'Provide security compliance checklists (GDPR, SOC 2, HIPAA, PCI-DSS) relevant to the architecture.',
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
  // 8 Primary Personas
  'architect':    architectPersona,
  'developer':    developerPersona,
  'writer':       writerPersona,
  'analyst':      analystPersona,
  'tester':       testerPersona,
  'scrum-master': scrumMasterPersona,
  'scrum_master': scrumMasterPersona,
  'ux-designer':  uxDesignerPersona,
  'ux_designer':  uxDesignerPersona,
  'security':     securityPersona,

  // Legacy mappings for backward compatibility
  'markdown':       writerPersona,
  'mermaid':        architectPersona,
  'user-story':     scrumMasterPersona,
  'documentation':  writerPersona,
  'fix-code':       developerPersona,
  'rewrite':        writerPersona,
  'architecture':   architectPersona,
  'implementation': developerPersona,
};

/**
 * Build a complete system prompt for the AI model from a persona config
 * and the current editor content.
 *
 * For developer or fix-code with a /fix directive, only the targeted block is included
 * in the editor section to focus the model's attention.
 *
 * @param actionId  - The button action ID (e.g. 'architect', 'developer', 'fix-code')
 * @param editorContent - Current content of the editor panel
 * @param userPrompt - Optional user prompt text (used by developer/fix-code to parse /fix directives)
 * @returns A fully-formed system prompt string, or null if the actionId is unknown
 */
export function buildSystemPrompt(actionId: string, editorContent: string, userPrompt?: string): string | null {
  const persona = aiPersonas[actionId];
  if (!persona) return null;

  const rulesBlock = persona.rules
    .map((rule, i) => `${i + 1}. ${rule}`)
    .join('\n');

  let editorSection: string;

  if ((actionId === 'developer' || actionId === 'fix-code') && userPrompt) {
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

/**
 * Get the emoji icon for a given action button.
 */
export function getPersonaIcon(actionId: string): string | undefined {
  return aiPersonas[actionId]?.icon;
}
