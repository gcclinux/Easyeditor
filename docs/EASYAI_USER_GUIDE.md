# EasyAI — User Guide

EasyAI is your AI-powered writing assistant built directly into EasyEditor. Open the panel, type what you need, and click the button that matches the kind of output you want. Each button activates a specialised AI persona that follows strict rules to produce exactly the right format.

---

## How It Works

1. **Open the EasyAI panel** from the toolbar (the 🤖 button).
2. **Type your requirement** in the text area — describe what you need in plain language.
3. **Click one of the 8 action buttons** below the text area. Each button tells the AI *what kind of output* to produce.
4. The AI reads your requirement, checks whether the editor already has content for context, and **appends** the result to your document.

> **Important:** EasyAI appends output to the end of your document for most actions. The one exception is **Rewrite**, which replaces your original content with the improved version.

---

## The 8 Action Buttons

### 📝 Markdown

**What it does:** Generates clean, standards-compliant Markdown documentation.

**When to use it:**
- Writing project documentation, README files, or technical guides
- Adding new sections to an existing document
- Drafting structured content with headings, lists, and code blocks

**How it behaves:**
- Produces **pure Markdown only** — no HTML, no diagrams
- If your editor already has content, the AI reads it to match your tone, topic, and heading structure
- New content continues naturally from where your document left off

**Example prompt:** *"Write a Getting Started section explaining how to install and configure the application"*

---

### 🔀 Mermaid

**What it does:** Creates Mermaid.js diagram code that renders as visual diagrams in the preview pane.

**When to use it:**
- Visualising workflows, system architectures, or processes
- Creating sequence diagrams for API interactions
- Building ER diagrams, class diagrams, or Gantt charts

**How it behaves:**
- Outputs a ` ```mermaid ` code block with valid Mermaid syntax
- Chooses the best diagram type for your requirement (flowchart, sequence, class, state, ER, gantt, journey, etc.)
- Adds a heading and brief description above the diagram

**Example prompt:** *"Create a sequence diagram showing the OAuth 2.0 login flow between the browser, app server, and identity provider"*

---

### 📋 User Story

**What it does:** Transforms your ideas into structured Agile user stories.

**When to use it:**
- Planning sprints or building a product backlog
- Breaking a feature idea into actionable development tasks
- Documenting requirements with clear acceptance criteria

**How it behaves:**
- Uses the standard format: *"As a [persona], I want [goal], so that [benefit]"*
- Each story includes acceptance criteria (as a checklist), priority, and notes
- Stories are numbered (US-001, US-002…) and grouped under epics when appropriate
- Continues numbering from existing stories in your document

**Example prompt:** *"Create user stories for a file upload feature that supports drag-and-drop, progress tracking, and file type validation"*

---

### 📐 ASCII Diagram

**What it does:** Builds portable, text-based diagrams using only standard ASCII characters.

**When to use it:**
- Creating diagrams for READMEs, comments, or plain-text documents
- When you need diagrams that render correctly in any terminal or text editor
- Documenting network topologies, architecture layouts, or simple flows

**How it behaves:**
- Uses only basic ASCII characters (`+-|/\><^v*.=#~:`) — no special Unicode symbols
- Wraps diagrams in a code fence to preserve alignment
- Keeps diagrams within 80-column width for maximum compatibility
- Adds a legend when symbols have non-obvious meanings

**Example prompt:** *"Draw a network diagram showing a load balancer distributing traffic to three application servers connected to a shared database"*

---

### 🏗️ PlantUML

**What it does:** Generates PlantUML diagram code for rendering with PlantUML tools.

**When to use it:**
- Creating UML-standard diagrams (class, sequence, use case, activity, component, state)
- Documenting software architecture with formal notation
- Building deployment or timing diagrams

**How it behaves:**
- Outputs a ` ```plantuml ` code block with `@startuml` / `@enduml` markers
- Applies clean styling via `skinparam` for readability
- Uses descriptive names for participants, classes, and components

**Example prompt:** *"Generate a class diagram for an e-commerce system with Customer, Order, Product, and Payment classes showing their relationships"*

---

### 📊 Markdown Table

**What it does:** Builds well-formatted, source-readable Markdown tables.

**When to use it:**
- Presenting structured data, comparisons, or reference lists
- Creating API documentation with endpoint/parameter tables
- Organising feature matrices or configuration options

**How it behaves:**
- Outputs GFM (GitHub Flavored Markdown) pipe-delimited tables only — no HTML
- Aligns columns appropriately (numbers right-aligned, text left-aligned)
- Splits large datasets into multiple smaller tables by category
- If sample data is needed, generates realistic examples — not placeholders

**Example prompt:** *"Create a comparison table of React, Vue, and Angular covering learning curve, performance, typing support, community size, and licence"*

---

### 🔧 Fix Code

**What it does:** Analyses code in your editor, finds bugs or issues, and provides corrected code.

**When to use it:**
- You have code in the editor and suspect a bug but can't find it
- You want a second opinion on error handling, edge cases, or logic
- You need help fixing a specific function or section

**How it behaves:**
- **Reads your editor content as the primary input** — your code IS what it analyses
- Your prompt provides direction (e.g. *"fix the sorting function"* or *"handle null values"*)
- Lists each issue found, then provides the corrected code
- Makes minimal, targeted fixes — does not refactor unrelated code
- Can show changes in diff format for easy comparison

**Example prompt:** *"The calculateTotal function returns NaN when the cart is empty — find and fix the issue"*

---

### ✍️ Rewrite

**What it does:** Rewrites and improves your existing content based on your instructions, replacing the original with the improved version.

**When to use it:**
- Improving the clarity, tone, or structure of documentation
- Making content more concise or more detailed
- Adjusting writing style for a different audience (technical, executive, casual)

**How it behaves:**
- **Reads your editor content as the primary input** — your text IS what it rewrites
- Your prompt tells the AI *how* to improve it (e.g. *"make it concise"*, *"use formal tone"*)
- **Replaces the original content entirely** with the rewritten version
- Preserves technical accuracy, heading structure, and link references
- Includes a changelog summarising what was changed and why

**Example prompt:** *"Rewrite this README for a non-technical audience, make it friendlier and remove jargon"*

---

## 8 Persona Quick Reference

| Button | Persona Role | Key Constraint |
|:---|:---|:---|
| `markdown` | Markdown Documentation Specialist | Pure CommonMark/GFM only — no HTML, no diagrams |
| `mermaid` | Mermaid Diagram Architect | Must output valid ` ```mermaid ` fenced blocks |
| `user-story` | Agile User Story Writer | Canonical format + numbered stories (US-001…) |
| `ascii-diag` | ASCII Diagram Engineer | Pure ASCII chars only — no Unicode box-drawing |
| `plantuml` | PlantUML Diagram Specialist | Must include `@startuml` / `@enduml` |
| `md-table` | Markdown Table Builder | GFM pipe tables only — no HTML `<table>` |
| `fix-code` | Code Review & Fix Specialist | Reads editor code as primary input |
| `rewrite` | Content Rewriter & Improver | Reads editor content as primary input |

---

## Quick Reference

| Button | Best For | Input Source |
|:---|:---|:---|
| Markdown | Documentation, guides, READMEs | Your prompt (editor = context) |
| Mermaid | Visual diagrams (flow, sequence, ER…) | Your prompt (editor = context) |
| User Story | Agile stories, backlog items | Your prompt (editor = context) |
| ASCII Diagram | Plain-text diagrams, terminal-safe | Your prompt (editor = context) |
| PlantUML | UML-standard diagrams | Your prompt (editor = context) |
| MD Table | Structured data, comparisons | Your prompt (editor = context) |
| Fix Code | Bug fixes, code corrections | **Editor content** (prompt = direction) |
| Rewrite | Content improvement, tone shifts | **Editor content** (prompt = direction) |

> **Tip:** The first 6 buttons use your prompt as the main instruction and treat editor content as background context. **Fix Code** and **Rewrite** are the opposite — they treat your editor content as the main input and use your prompt for direction.

---

## Tips for Better Results

- **Be specific** — *"Create a sequence diagram for the checkout payment flow"* works better than *"Make a diagram"*
- **Mention constraints** — *"Keep it under 5 user stories"* or *"Use a flowchart, not a sequence diagram"*
- **Add context in the editor** — The more relevant content already in your editor, the better the AI can match your style and topic
- **Use Fix Code with a focused prompt** — Instead of *"fix my code"*, try *"the loop on line 42 never terminates when the array is empty"*
- **Chain actions** — Generate a user story first, then use Mermaid to diagram the flow, then use Markdown to write the documentation
