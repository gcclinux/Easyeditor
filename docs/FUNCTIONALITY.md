# EasyEditor Functional Documentation

This document provides a comprehensive list of all functions, templates, formats, and features available within the EasyEditor ecosystem.

---

## 🏗️ 1. The Easy Ecosystem

EasyEditor is more than just a markdown editor; it is a suite of integrated tools designed for seamless productivity.

### 🖋️ EasyEditor (The Core)
A lightweight, high-performance Markdown editor designed as a "digital Swiss Army knife" for writers and developers. It features a real-time side-by-side preview, extensive diagramming support, professional template library, and a customizable UI with multi-language support. It is available as a web app and as native desktop applications for **Windows**, **macOS**, and **Linux**.

### 📓 EasyNotes (Note Management)
A premium workspace capability providing a dedicated library for managing cloud-synced notes. It requires a connection to a cloud provider (Google Drive, Dropbox, or Box) to maintain a structured workspace beyond local files, ensuring persistent storage across devices.

### 🌿 EasyGit (Version Control)
A robust, built-in Git integration that brings professional version control directly into the editor. It supports cloning repositories, managing credentials securely, tracking file status with real-time indicators, viewing commit history, and a "one-click" workflow to save, commit, and push.

### 🤖 EasyAI (AI Assistant)
An intelligent writing companion with 8 specialized personas. It can generate structure, design complex diagrams, draft user stories, and repair code or grammar. It supports both "Bring Your Own Key" (Local/Ollama) and subscription models (Gemini LLM).

---

## 🚀 2. Core Functions (API Endpoints)

The backend functionality is powered by Firebase Cloud Functions, providing secure license management and communication services.

| Endpoint | Method | Purpose | Key Features |
|---|---|---|---|
| `/api/stripe-webhook` | `POST` | Stripe Integration | Signature verification, License creation, Email confirmation delivery. |
| `/api/check-license` | `POST` | License Validation | Validates status by userId or email, determines plan type (Premium/Plus). |
| `/api/send-contact-email` | `POST` | Contact Services | Server-side validation, Formats and sends user messages to support. |

---

## 📝 3. Supported Formats & Rendering

EasyEditor supports a wide range of professional markdown extensions and visualization formats.

### Markdown & Text
- **GFM (GitHub Flavored Markdown)**: Tables, task lists, strikethrough, and autolinks.
- **SSTP Encryption**: Secure, password-protected storage for sensitive markdown files.
- **Footnotes**: Support for Simple, Multiple, Numbered, and Academic (bibliographic) styles.

### Diagrams & Visualization
- **Mermaid Diagrams**: 
    - Journey, Flowchart, Gantt, GraphTD, erDiag, TimeLine, ClassDiag, gitGraph, and Kanban Boards.
- **PlantUML / Nomnoml**: 
    - Full support for Class, Sequence, Use Case, Activity, Component, and State diagrams.
- **ASCII Diagrams**: Text-based visual representations for quick sketching.

### Mathematics
- **KaTeX / LaTeX**: Full mathematical expression support with live rendering of complex equations and scientific notation.

---

## 🗂️ 4. Template & Task Library

EasyEditor comes pre-loaded with over 20 professional templates and specialized task trackers to jumpstart any workflow.

### 📋 Professional Workflows
- **Project Planning**: High-level Project Plan, Software Testing Roadmap, and App Dev (AWS + Postgres) architecture.
- **Operations**: DevOps Patching Plan, Bug Report, and Meeting Notes.
- **Agile/JIRA**: JIRA Design Story, JIRA Feature Story, and Generic User Stories.

### 📝 Personal Productivity
- **Journals**: Daily Journal and Study Notes.
- **Tracking**: Workout Log, Travel Log, and Weekly Habit Tracker.

### 📊 Diagramming Templates
- **Mermaid**: Flowcharts, ER Diagrams, Kanban Boards, and a comprehensive Diagram Examples guide.
- **UML (Nomnoml)**: Master-Slave Database Replication, Process of Elimination (Troubleshooting Flow), and LLM Training Pipeline.
- **Classic**: ASCII Diagrams for text-based sketching.

### 🛠️ Specialized Task Lists
One-click insertion of structured checklists:
- **Development**: Release Checklist, Code Review, and Project Tasks.
- **Daily Flow**: Daily Productivity, Basic Checklist, and Study Plan.
- **Logistics**: Nested Shopping List and Content Publishing (SEO/Draft/Publish).

### 📐 Technical Guides
- **Cheat Sheets**: EasyEditor KaTeX math notation guide and general Ecosystem functional guide.

---

## 🔥 5. Built-in Features & Capabilities

### File & Workflow
- **File Operations**: Open MD/TXT/SSTP, Deep Save, Save As, and New File creation.
- **Cloud Sync**: Seamless integration with **Google Drive**, **Dropbox**, and **Box** (Premium).
- **Import Tools**: 
    - **Import Docx**: Convert Microsoft Word documents to clean Markdown.
    - **Import from URL**: Fetch and edit remote Markdown files directly.

### Advanced Git Integration
- **Real-time Status**: Continuous tracking of branch name, modified file counts, and repo status (Clean/Modified/Conflict).
- **Credential Security**: Local encryption for Git credentials (Username/PAT) with master password protection.
- **Operations**: Clone, Fetch, Pull, Push, Init, Commit, and Interactive Git Log viewer.

### Formatting & Tools
- **Auto-Generators**: One-click interactive creation for **Tables**, **Gantt Charts**, and **Timelines**.
- **Exports**: Export notes to **PDF**, **PNG (Image)**, **HTML**, **Markdown**, **TXT**, or **Encrypted SSTP**.
- **Symbols & Icons**: Quick-insert menu for status indicators (Check, Fire, Warning), actions, and custom symbols.

### UI & Personalization
- **Modern Theming**: Pick from Ocean Blue, Sunset Orange, Jade Green, and High Contrast.
- **Custom Theme Engine**: Import raw CSS code to define your own editor skin.
- **Flexible Layout**: Resizable split view, collapsible sidebars, and dedicated Edit/Preview/Toggled modes.
- **Localization**: Native support for 5 primary languages: **English**, **Portuguese (BR)**, **German**, **Dutch**, and **Polish**. The system is fully extensible, allowing users to import custom translation JSONs, with more languages available upon request.

---

## 🤖 6. EasyAI Writing Assistant

EasyAI provides specialized personas and advanced command-based editing logic.

### AI Specialized Personas
1. **Markdown Specialist**: Generates clean, standards-compliant documentation.
2. **Mermaid Architect**: Converts requirements into syntactically correct diagrams.
3. **User Story Writer**: Transforms goals into JIRA/Agile stories.
4. **Technical Writer**: Builds architecture and API guides.
5. **UML Diagram Expert**: Generates Nomnoml-based UML diagrams.
6. **Table Builder**: Constructs well-aligned GFM tables.
7. **Code & Content Fixer**: Repairs specific technical blocks.
8. **Content Rewriter**: Adjusts tone and conciseness.

### EasyAI Slash Commands
Use targeted commands to fix specific document elements:
- `/fix markdown` | `/fix language` (spelling)
- `/fix mermaid` | `/fix plantuml`
- `/fix table` | `/fix code`
- `/fix all`

### Content Integrity
- **Safety Reporting**: Built-in reporting for AI-generated content (Inaccurate, Harmful, Offensive, etc.).

---

## 🌍 7. Community & Climate
EasyEditor is committed to supporting climate initiatives and community-driven development through transparent licensing and professional support channels.

---

## 📦 8. Installation & Deployment

EasyEditor is built for portability and accessibility, offering native packages for all major operating systems and modern containerized environments.

### 🖥️ Desktop Applications
Native binaries are available for multiple architectures (x86_64, aarch64, armhf):
- **Windows**: Setup installers (`.exe`, `.msi`) and standalone portable versions.
- **Linux**: 
    - Distribution-specific: `.deb` (Debian/Ubuntu), `.rpm` (RedHat/Fedora), and `.pkg.tar.zst` (Arch).
    - Universal: **AppImage** and **Snap** packages.
- **macOS**: Apple Disk Image (`.dmg`) and compressed application bundles (`.app.zip`).

### ☁️ Cloud & Web
- **Main Website**: Visit [easyeditor.uk](https://easyeditor.uk/) for news, updates, and community support.
- **Web App**: Instant access through the online portal at [easyedit-cloud.web.app](https://easyedit-cloud.web.app/).
- **Docker**: Official container image available for server-side hosting or private deployment:
  ```bash
  docker pull ghcr.io/gcclinux/easyeditor:latest
  ```

---

*EasyEditor Functional Guide*
