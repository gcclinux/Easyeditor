# EasyAI — User Guide

EasyAI is your AI-powered writing and engineering companion built directly into EasyEditor. Open the panel, type what you need, and click the button that matches your objective. Each button activates a specialised AI persona with deep domain expertise and strict formatting rules to produce exactly the right output.

---

## How It Works

1. **Open the EasyAI panel** from the toolbar (the 🤖 button).
2. **Type your requirement** in the text area — describe what you need in plain language.
3. **Click one of the 8 persona buttons** below the text area. Each button activates a dedicated AI persona tailored for that specific discipline.
4. The AI reads your requirement, inspects existing editor content for context, and **appends** high-quality content to your document (or performs targeted in-place fixes).

> **Tip:** EasyAI respects your document context: it reads existing content to match terminology, style, and structure without overwriting your work. When using the Developer persona with `/fix` directives, it performs targeted in-place block updates.

---

## The 8 Personas

EasyAI brings 8 unique personas to EasyEditor and EasyGit, transforming how you document, innovate, and enhance your content with intelligent precision:

### 🏗️ Architect — System & software design

**What it does:** Designs comprehensive, resilient, modular, and scalable software and system architectures.

**When to use it:**
- Defining high-level system topology, microservices, or event-driven designs
- Choosing technology stacks, communication protocols, and architectural patterns
- Visualising component interactions, interfaces, and data flow
- Evaluating architectural trade-offs, scalability, and resilience strategies

**How it behaves:**
- Generates structured Markdown with sections: Architectural Overview, System Topology, Component Specifications & Interfaces, Data Architecture & Flow, Scalability & Resilience, and Technology Stack Recommendations
- **Always includes at least one Mermaid diagram** (` ```mermaid ... ``` `) illustrating system architecture, component relations, or sequence interactions
- Explains architectural trade-offs with clear technical rationales
- Adheres to non-functional requirements (high availability, caching, latency mitigation, fault tolerance)

**Example prompt:** *"Design an event-driven architecture for a real-time order processing system handling 10,000 orders per second, including Kafka, microservices, and database replication"*

---

### 👨‍💻 Developer — Code generation & fixes

**What it does:** Generates production-ready code, implements features, refactors logic, and performs targeted code and content fixes.

**When to use it:**
- Implementing algorithms, functions, classes, and backend/frontend features
- Debugging errors, edge cases, and performance bottlenecks
- Targeted in-place fixes using `/fix` directives (`/fix code`, `/fix plantuml`, `/fix mermaid`, `/fix table`, `/fix markdown`, `/fix language`, `/fix all`)
- Modernising legacy code into idiomatic, typed implementations

**How it behaves:**
- Produces clean, runnable code wrapped in syntax-highlighted code fences (` ```ts `, ` ```python `, etc.)
- Enforces clean architecture principles (DRY, SOLID, type safety, modular separation)
- When given a `/fix` directive, extracts and fixes **only the targeted block** in-place without touching surrounding content
- Includes defensive error handling and concise usage examples

**Example prompt:** *"Implement a TypeScript LRU cache class with O(1) get and set operations, TTL expiration, and full unit tests"*

---

### ✍️ Writer — Documentation & prose

**What it does:** Produces clear, engaging, structured, and comprehensive documentation, technical prose, guides, and articles.

**When to use it:**
- Writing technical documentation, API guides, README files, or architecture documentation
- Drafting user guides, release notes, onboarding manuals, and knowledge base articles
- Rewriting or polishing prose for clarity, tone, and conciseness
- Documenting Git repository folders and projects

**How it behaves:**
- Generates pure CommonMark / GFM Markdown without raw HTML tags
- Structures content with clear heading hierarchy (`##`, `###`), concise paragraphs, and informative bullet lists
- Formats reference tables, CLI parameters, and options using GFM tables
- Matches the tone of existing documentation and appends additive material seamlessly

**Example prompt:** *"Write an API integration guide for our REST webhooks, including authentication headers, payload examples, retry logic, and error status codes"*

---

### 📊 Analyst — Data & business analysis

**What it does:** Performs deep data modeling, business analysis, KPI definition, process flow evaluation, and strategic decision frameworks.

**When to use it:**
- Creating data dictionaries, entity-relationship schemas, and pipeline transformations
- Conducting SWOT analysis, gap analysis, cost-benefit analysis, and ROI evaluations
- Formulating business requirements, success criteria, and measurable KPIs
- Designing structured evaluation matrices and reporting frameworks

**How it behaves:**
- Uses GFM Markdown tables extensively for metrics, feasibility studies, and comparison matrices
- Details business risks, assumptions, operational constraints, and data governance considerations
- Backs recommendations with structured logical rationale and actionable business insights

**Example prompt:** *"Perform a business and data analysis for migrating from on-premise servers to AWS serverless, including cost-benefit breakdown, KPIs, and data migration risk matrix"*

---

### 🧪 Tester — QA & test strategies

**What it does:** Designs comprehensive QA test plans, automated test suites, verification matrices, and edge-case test specifications.

**When to use it:**
- Creating end-to-end QA test strategies (Unit, Integration, E2E, Performance, Security)
- Formulating test matrices with steps, preconditions, expected results, and priority
- Writing automated test code for frameworks like Jest, Vitest, Cypress, Playwright, or PyTest
- Formulating BDD scenarios using Gherkin syntax (`Given`, `When`, `Then`)

**How it behaves:**
- Structures test cases in clear tables: Test ID, Scenario / Description, Preconditions, Test Steps, Expected Result, and Priority (P1/P2/P3)
- Identifies boundary values, negative test cases, race conditions, and error recovery paths
- Provides executable test code snippets matching the detected tech stack
- Includes regression verification checklists and Definition of Done acceptance criteria

**Example prompt:** *"Create a comprehensive test plan and Playwright E2E test suite for user authentication with MFA, token refresh, and account lockout after failed attempts"*

---

### 🏃 Scrum Master — Agile & sprint planning

**What it does:** Facilitates agile delivery by drafting well-formed user stories, sprint backlogs, sprint planning specifications, and retrospective structures.

**When to use it:**
- Breaking epics into INVEST-compliant user stories
- Writing acceptance criteria checklists (`- [ ]`) and Definition of Done
- Planning sprint goals, capacity allocations, and story point estimations
- Structuring agile sprint retrospectives and backlog grooming sessions

**How it behaves:**
- Employs the canonical user story format: *"As a [persona], I want [goal], so that [benefit]"*
- Enforces acceptance criteria checklists, priority ratings, and sequential numbering (`US-001`, `US-002`...)
- Groups related stories under Epics and defines clear Sprint Goals
- Seamlessly continues story numbering from existing documents

**Example prompt:** *"Create agile user stories with detailed acceptance criteria for a file versioning feature allowing users to restore previous revisions and compare diffs"*

---

### 🎨 UX Designer — User experience & flows

**What it does:** Creates intuitive user journeys, interaction specifications, wireframe layouts, and accessibility guidelines.

**When to use it:**
- Mapping end-to-end user flows, decision paths, and customer journeys
- Defining UI wireframe structures, screen hierarchies, and component spacing
- Establishing interaction states (default, hover, focus, disabled, loading, error)
- Ensuring accessibility compliance with WCAG 2.1 AA standards

**How it behaves:**
- Integrates visual Mermaid diagrams (` ```mermaid journey ` or ` ```mermaid flowchart LR `) for visual flow mapping
- Specifies screen component hierarchy, micro-copy, and information architecture
- Enforces accessibility best practices (contrast ratios, screen-reader semantics, keyboard navigation)
- Recommends responsive adaptations for mobile, tablet, and desktop viewports

**Example prompt:** *"Design the UX flow and wireframe structure for a multi-step checkout process with cart review, address validation, payment selection, and order confirmation"*

---

### 🔒 Security — Security & threat models

**What it does:** Performs threat modeling, security architecture assessments, vulnerability analysis, and compliance verification.

**When to use it:**
- Performing STRIDE or DREAD threat modeling on systems and components
- Auditing architectures against OWASP Top 10 vulnerabilities
- Designing authentication, authorization (RBAC/ABAC), and secrets management
- Formulating data encryption strategies (at-rest, in-transit) and compliance checklists (GDPR, SOC 2, HIPAA)

**How it behaves:**
- Formats threat matrices with columns: Threat ID, STRIDE Category, Vulnerability / Attack Vector, Impact / Severity, Mitigation / Control, and Verification Status
- Evaluates trust boundaries, attack vectors, and privilege escalation risks
- Proposes concrete, actionable security remediations and hardening configurations
- Enforces defense-in-depth and zero-trust principles

**Example prompt:** *"Conduct a STRIDE threat model analysis for a cloud-hosted microservices architecture exposing public GraphQL APIs and connecting to customer databases"*

---

## 8 Persona Quick Reference

| Icon | Persona | Primary Specialty | Key Output |
|:---:|:---|:---|:---|
| 🏗️ | **Architect** | System & software design | Architectural specs + Mermaid diagrams |
| 👨‍💻 | **Developer** | Code generation & fixes | Executable code blocks + `/fix` support |
| ✍️ | **Writer** | Documentation & prose | Clean CommonMark / GFM documentation |
| 📊 | **Analyst** | Data & business analysis | Data models, KPI matrices & SWOT tables |
| 🧪 | **Tester** | QA & test strategies | Test plans, test matrices & test code |
| 🏃 | **Scrum Master** | Agile & sprint planning | INVEST user stories & sprint backlogs |
| 🎨 | **UX Designer** | User experience & flows | User journeys, wireframes & Mermaid flows |
| 🔒 | **Security** | Security & threat models | STRIDE threat models & security checklists |

---

## Targeted `/fix` Directives

The **Developer** persona supports targeted in-place fixes using slash commands in your prompt:

- `/fix code` — Locate fenced code blocks and repair programming errors
- `/fix plantuml` — Repair Nomnoml / PlantUML diagram syntax errors
- `/fix mermaid` — Repair Mermaid diagram syntax errors
- `/fix table` — Repair Markdown table alignment, pipes, and formatting
- `/fix markdown` — Fix Markdown formatting issues in prose sections
- `/fix language` — Fix spelling, grammar, and typography in natural-language prose
- `/fix all` — Review and fix the entire document across all block types

When a `/fix` directive is detected, EasyAI isolates the targeted block, repairs it, and replaces it in-place in your document without modifying surrounding sections.

---

## Report Inappropriate AI Content

EasyAI includes a built-in reporting feature that lets you flag problematic AI-generated content. Click the 🚩 flag icon in the EasyAI panel header to open the report dialog, select a category, add an optional description, and submit.

### Where Reports Are Stored

Reports are saved locally on your device — nothing is sent to a server.

**Windows (Tauri desktop app):**
- `C:\Users\<username>\AppData\Roaming\<username>.Easyeditor\ai-content-reports.json`

**Linux (Tauri desktop app):**
- `~/.local/share/com.easyeditor.editor/ai-content-reports.json`

**Web browser:**
- Reports are stored in browser `localStorage`. Use the "Download Reports" button in the EasyAI panel to export them as a JSON file.

> Both stores keep a maximum of 100 reports. When the limit is reached, the oldest report is removed automatically.

---

## Tips for Better Results

- **Be specific** — *"Design a microservices architecture with Kafka and Redis"* yields sharper results than *"Give me an architecture"*.
- **Leverage the right persona** — Select 🧪 **Tester** for test plans, 🔒 **Security** for vulnerability analysis, or 🏗️ **Architect** for system designs.
- **Provide context in the editor** — The more domain terminology and specifications present in your editor, the more coherent and context-aware the AI response will be.
- **Combine personas iteratively** — Use 🏗️ **Architect** for the topology, 🎨 **UX Designer** for user journeys, 🏃 **Scrum Master** for stories, 👨‍💻 **Developer** for implementation, and 🧪 **Tester** for verification.
