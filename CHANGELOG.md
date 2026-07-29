# Changelog

![EasyEditor](https://raw.githubusercontent.com/gcclinux/EasyEditor/refs/heads/main/public/easyeditor128.png)

EasyEditor is an easy markdown editor that allows you to write Markdown (MD) and preview it in real-time. You can save, load .md files and export to HTML,TXT & PDF. All notable changes to this project will be documented in this file.

*EasyEditor is a free and open-source project. You can use it for free and modify it as you like.*

## Latest CODE version
- 2.0.0 - New EasyNotes local Library selecting between cloud & local is now optional, auto update notification
- 1.8.1 - Bump version to 1.8.1 and fixed dark & light teheme fixed issue with Preview Panel and UI 
- 1.8.0 - feat: Cloud-Integration-Update, feat: License-API Update and new License Modal for all four languages
- 1.7.6 - feat: New personas and enable default Gemini LLM for subscriber
- 1.7.5 - feat: Markdown file transfer, Implemented OneDrive cloud, Preview Component inline with editor
- 1.7.4 - feat: Initial PDF text extractor to Markdown, feat: Introduced Spanish as native language, including Get API link, enhanced the license model look & feel, feat: included button to apply for Premium License
- 1.7.3 - feat: Box Cloud Integration — users can now connect to Box cloud storage account to EasyEditor, enabling them to open, edit, and save Markdown files directly from Box, with full OAuth2 authentication flow, file/folder browsing, bug: opening repo will now accurately load repo images also, feat: templates with JIRA User Story & KaTeX (Free)
- 1.7.2 - feat: AI Inappropriate Content Reporting — users can now flag problematic AI-generated content via a structured report dialog in the EasyAI panel, with categorized reports (offensive, inaccurate, harmful, explicit, spam, other), optional descriptions, local persistence with 100-entry FIFO cap, Tauri file logging, web download export, and full localization across all five supported locales (en, de, nl, pl, pt-br)
- 1.7.1 - feat: Google Drive Access re-requested and fixed for Premium
- 1.7.0 - feat: New AI integration for support and documentation.
- 1.6.6 - feat: Add important ability to import docx files and convert to md files
- 1.6.5 - feat: Add KaTeX support for rendering mathematical equations in the preview component.
- 1.6.4 - Implemented new templates and plantuml templates.
- 1.6.3 - Updated legacy dropdown menu to use the new modal system.
- 1.6.2 - Added support for opening encrypted (.sstp) files directly and created fileModal, taskModal, templateModal, exportModal and export to png

## Version changes
- 1.6.0 - Packaging version bump and minor fixes and premium features enabled
- 1.5.2 - Several bug fixes, documentation and replacing electron with tauri
- 1.5.1-tauri - The same build just packaged with tauri package manager
- 1.5.0 - Implemented File System Access API for modern browsers (Chrome/Edge/Opera)
- 1.4.6 - Implemented new ascii template and ascii-art in preview
- 1.4.5 - Implemented theme picker or creator
- 1.4.2 - Implemented UML diagram and new look & feel 
- 1.4.1 - Implemented encrypt and decrypt compatibility with smalltextpad app file extentions (sstp)
- 1.4.0 - Implemented new features, Look&Feel and templates
- 1.3.8 - Implemented Server side for hosting the application online / docker
- 1.3.7 - Timeline Generator BUG fix
- 1.3.6 - PreviewPanel Zoom In-Out
- 1.3.5 - Fixed white space in preview panel making it more readable
- 1.3.4 - Feature implemented Toggle Edit AND Toggle Preview full screen
- 1.3.3 - Cosmetic added inline-code and block-code grey background as code
- 1.3.2 - Removed web-host for now until BUG #4 is fixed
- 1.3.1 - Minor cosmetic improvements and Implementation standalove option
- 1.3.0 - Implementation version check and improved About
- 1.2.5 - Implementation new Headers & Code cleanup
- 1.2.4 - Implementation auto Gantt graph generator
- 1.2.3 - Saving window bounds and open App with saved bounds
- 1.2.2 - Improved screen/buttons Layout for smaller screen resolution
- 1.2.1 - Cosmetics & saveToHTML improvements
- 1.2.0 - Implementation of custom tables by @Lewish1998
- 1.1.1 - Added export Text files and improved mermaid code
- 1.1.0 - Additional graph plaintext and flowchart
- 1.0.9 - To improve development of saveAsPDF function the code has been moved into separate file saveAsPDF.tsx
- 1.0.8 - Implemented HTML code format and Export Markdown to HTML support
- 1.0.7 - Improved pdf export to include code, mermaid image and tables
- 1.0.6 - Focused on a Linux installation script
- 1.0.5 - Improved the package build format for Linux & Windows
- 1.0.4 - Fixed Export to PDF that was not exporting the entire page content.
- 1.0.3 - Re-wrote and optimised the main.cjs so windows also have the ability of right click on MD and open with EasyEditor
- 1.0.2 - Added capability to parse a file directly to executable
- 1.0.1 - Added detect-port in case App starts and default port is already in use by another App
- 1.0.0 - Initial version distributed (10th of November 2024)