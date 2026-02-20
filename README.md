 ## *Easyeditor* 🚀

**The Ultimate Real-Time Markdown Editor for Professionals, Developers & Writers**

Easyeditor is not just another Markdown editor—it's a **powerhouse** for your documentation needs. Write Markdown (MD), create stunning diagrams with **Mermaid** & **UML**, render mathematical equations with **KaTeX**, and preview it all in **real-time**! 

From simple notes to complex technical documentation, Easyeditor has you covered with over **130+ features**.

### ✨ Why You'll Love It
*   **Real-time Preview**: See your changes instantly.
*   **Rich Diagram Support**: Native support for **Mermaid**, **UML**, and more.
*   **Math Ready**: **KaTeX** support for beautiful mathematical notations.
*   **Template System**: Jumpstart your docs with built-in templates.
*   **Git Integration**: Load, stage, commit, and push directly from the editor.
*   **Export Power**: Export to **PNG**, **TXT**, **PDF**, **MD** and secure **SSTP Encryption**.
*   **Customizable**: Choose from beautiful themes or create your own!
*   **SSTP Encryption**: SSTP (Simple Security Text Protocol) protection using modern AES-256-CBC encryption!

[![Infographic](https://img.shields.io/badge/📊_Infographic-View_PDF-orange?style=for-the-badge)](docs/Easyeditor-Infographic.pdf)

---

![Easyeditor](screenshots/banner-tauri.png)

***Easyeditor is free, open-source, and yours to modify!***

---

## *Get Started Instantly*

### 📥 Option 1: Download & Install (Recommended)
Skip the build process and start writing immediately! Download the latest system-compiled binary for your OS.

[![Download Latest Release](https://img.shields.io/badge/⬇️_Download_Desktop_App-Get_Latest_Release-blue?style=for-the-badge&logo=windows)](https://github.com/gcclinux/EasyEditor/releases)

### 🐳 Option 2: Run with Docker
Prefer a containerized environment? getting up and running is as simple as one command.

```bash
# Pull and run the latest version
docker pull ghcr.io/gcclinux/easyeditor:latest
docker run -d --name EASYEDITOR -p 3024:3024 ghcr.io/gcclinux/easyeditor:main
```
*Access it at: `http://localhost:3024`*

### 🌐 Option 3: Use the Web App
No installation required! Try the full power of Easyeditor directly in your browser.

[![Try Easyeditor Online](https://img.shields.io/badge/🚀_Launch_Web_App-Try_it_Now-success?style=for-the-badge&logo=rocket)](https://easyeditor-cloud.web.app/)

---

## *Build from Source*
For contributors and those who want to customize the codebase.

### Prerequisites
*   Node.js & npm
*   Git
*   Rust (for Tauri Desktop App)

### 1. Clone & Install
```bash
git clone https://github.com/gcclinux/easyeditor.git
cd easyeditor
npm install
```

### 2. Run Locally
**Web Server Mode:**
```bash
npm run server
```

**Desktop App Mode:**
```bash
npm run app
```

### 3. Build & Compile (Tauri)
To build the native desktop application provided by Tauri:

**First, set up your environment:**
*   **Linux**: Install `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.
*   **Windows**: Install Visual Studio Build Tools with C++ workload.
*   **macOS**: `xcode-select --install`

**Then run:**
```bash
# Development
npm run tauri:dev

# Production Build
npm run tauri:build
```

---

## *Feature Showcase*

### 🎨 Stunning Themes
Select from a variety of themes or create your own to match your style.

<a><img src="screenshots/Themes_2025-10-24.png" alt="Themes" width="720" height="400"></a>

### 📊 Powerful Diagrams & Math
Visualize your ideas with **Mermaid** charts and **KaTeX** equations.

**KaTeX Example:**

<a><img src="screenshots\KaTeX-example.png" alt="KaTeX Example" width="720" height="400"></a>

**Template Online Gallery:**

<a><img src="screenshots\KaTeX-example-online.png" alt="Online Templates" width="720" height="400"></a>

### 🐙 Git Integration
Seamlessly manage your version control without leaving the editor.

<a><img src="screenshots/git_feature.png" alt="Git Feature" width="720" height="400"></a>

### 📝 Table Support
Clean and responsive table rendering.

| Feature | Support |
| :--- | :--- |
| **Markdown** | ✅ |
| **Mermaid** | ✅ |
| **KaTeX** | ✅ |
| **SSTP Encryption** | ✅ |

---

## *Quick Links*

[![Home](https://img.shields.io/badge/🏠_Home-Visit_Site-blue?style=for-the-badge)](https://www.easyeditor.co.uk) 
[![Docs](https://img.shields.io/badge/📚_Documentation-Read_Docs-green?style=for-the-badge)](https://gcclinux.github.io/EasyEditor/docs) 
[![Infographic](https://img.shields.io/badge/📊_Infographic-View_PDF-orange?style=for-the-badge)](docs/Easyeditor-Infographic.pdf) 
[![Releases](https://img.shields.io/badge/📦_Releases-View_All-blueviolet?style=for-the-badge)](https://github.com/gcclinux/EasyEditor/releases) 
[![GitHub](https://img.shields.io/badge/💻_Source_Code-GitHub-black?style=for-the-badge&logo=github)](https://github.com/gcclinux/EasyEditor) 
[![Stars](https://img.shields.io/github/stars/gcclinux/EasyEditor?style=for-the-badge&logo=github)](https://github.com/gcclinux/EasyEditor/stargazers) 
[![License](https://img.shields.io/github/license/gcclinux/EasyEditor?style=for-the-badge)](LICENSE) 

## *Support & Community*

[![Issues](https://img.shields.io/badge/🐛_Report_Issues-GitHub-red?style=for-the-badge)](https://github.com/gcclinux/EasyEditor/issues)
[![Discussions](https://img.shields.io/badge/💬_Join_Discussions-GitHub-blue?style=for-the-badge)](https://github.com/gcclinux/EasyEditor/discussions)
[![Buy Me A Coffee](https://img.shields.io/badge/☕_Buy_Me_A_Coffee-Support-yellow?style=for-the-badge)](https://www.buymeacoffee.com/gcclinux)
