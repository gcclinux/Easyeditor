 ## *Easyeditor* 🚀

 

[🏠 Home](https://easysmartapps.co.uk/) | [💻 Code](https://github.com/gcclinux/easyeditor.git) | [🌐 WebApp](https://easyedit-cloud.web.app/) | [📑 Menu Reference](docs/MENU.md)

**The Ultimate Real-Time Markdown Editor for Professionals, Developers & Writers**

Easyeditor is not just another Markdown editor—it's a **powerhouse** for your documentation needs. Write Markdown (MD), create stunning diagrams with **Mermaid** & **UML**, render mathematical equations with **KaTeX**, and preview it all in **real-time**! 

From simple notes to complex technical documentation, Easyeditor has you covered **features rich**.

### ✨ Why You'll Love It
*   **Real-time Preview**: See your changes instantly.
*   **Rich Diagram Support**: Native support for **Mermaid**, **UML**, and more.
*   **Math Ready**: **KaTeX** support for beautiful mathematical notations.
*   **Template System**: Jumpstart your docs with built-in templates.
*   **Git Integration**: Load, stage, commit, and push directly from the editor.
*   **Export Power**: Export to **PNG**, **TXT**, **PDF**, **MD** and secure **SSTP Encryption**.
*   **Customizable**: Choose from beautiful themes or create your own!
*   **SSTP Encryption**: SSTP (Simple Security Text Protocol) protection using modern AES-256-CBC encryption!
*   **EasyAI Personas**: Built-in AI personas for documentation, diagrams, code fixes, and more — with full repo scanning that reads your project file-by-file to generate accurate, context-aware documentation.
*   **Multi-cloud Storage**: Built-in Multi-cloud Storage to store your documents, GDrive, OneDrive,DropBox, Box.
*   **EasyTeam**: EasyTeam is a privacy-first, ephemeral team communication feature.

[![Menu Structure](https://img.shields.io/badge/📑_Menu_Structure-v2.0.1_Guide-purple?style=for-the-badge)](docs/MENU.md)
[![Infographic](https://img.shields.io/badge/📊_Infographic-View_PDF-orange?style=for-the-badge)](docs/Easyeditor-Infographic.pdf)

---

![Easyeditor](https://easyeditor.uk/img/Easyeditor-banner.webp)

***Easyeditor is free, open-source, and yours to modify!***

---

## *Get Started Instantly*

### 📥 Option 1: Download & Install (Recommended)
Skip the build process and start writing immediately! Download the latest system-compiled binary for your OS or install directly from the Microsoft Store.

[![Get it from Snap Store](https://img.shields.io/badge/Snap_Store-Get_App-E95420?style=for-the-badge&logo=snapcraft)](https://snapcraft.io/easyeditor)  
[![Get it from Microsoft Store](https://img.shields.io/badge/Microsoft_Store-Get_App-0078D4?style=for-the-badge&logo=microsoft)](https://apps.microsoft.com/store/detail/XP8K1TWB35PK5M)  
[![Download Latest Release](https://img.shields.io/badge/⬇️_Download_Desktop_App-Get_Latest_Release-blue?style=for-the-badge&logo=github)](https://github.com/gcclinux/EasyEditor/releases)

### 🐳 Option 2: Run with Docker
Prefer a containerized environment? getting up and running is as simple as one command.

```bash
# Pull and run the latest version
docker pull ghcr.io/gcclinux/easyeditor:latest
docker run -d --name EASYEDITOR -p 3024:3024 --env-file .env.local ghcr.io/gcclinux/easyeditor:latest
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

*   **All Platforms**: Install Visual Studio Code, Kiro, Antigravity, VSCodium or any other prefered IDE
*   **Linux**: Install `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.
*   **Windows**: Install additional extention C++ workload would help.
*   **macOS**: `xcode-select --install`

**Then run:**
```bash
# Development
npm run dev

# Version Management
node ./scripts/check_versions.js  # Verify version consistency across files
./bump_version.sh 1.8.1           # Update all files with new version and create git tag

# Production Build
npm run tauri:build # Build Tauri desktop app (Linux/macOS/Windows)
scripts/build-tauri.bat # Windows script wrapper
scripts/build-snap.sh # Snap package build
scripts/build-docker.sh # Docker build
```

## *Feature Showcase*

### 🎨 Various Imports and Export formats

<a><img src="screenshots/Menu - Exports.png" alt="Exports" width="720" height="400"></a>

<a><img src="screenshots/Menu - Extra - Imports.png" alt="Imports" width="720" height="400"></a>

### 📊 Powerful Diagrams & Math with templates

*Template System: Jumpstart your docs with built-in templates*

<a><img src="screenshots/Menu - Templates.png" alt="KaTeX Example" width="720" height="400"></a>

### 📝 Template Online Gallery

<a><img src="screenshots/Online - Templates.png" alt="Online Templates" width="720" height="400"></a>

### 🐙 EasyGit Integration
*Seamlessly manage your version control without leaving the editor.*

<a><img src="screenshots/Menu - EasyGit.png" alt="Git Feature" width="720" height="400"></a>

### 🤖 EasyAI Personas
*Multiple AI personas for documentation, diagrams, code fixes, user stories, and more. The Documentation persona scans your entire Git repository file-by-file to produce accurate, project-specific documentation.*

<a><img src="screenshots/Menu - EasyAI.png" alt="EasyAI Personas" width="720" height="400"></a>

### 🗣️ EasyTeam
*EasyTeam privacy-first, ephemeral team communication feature*

<a><img src="screenshots/Menu - EasyTeam.png" alt="EasyTeam" width="720" height="400"></a>

**Transfer Markdown Documentation**

<a><img src="screenshots/Menu - Extra - Transfer.png" alt="Transfer Markdown Documentation" width="720" height="400"></a>

### 📋 Menu Layout Support
*Explore standard layout formats and templates:* [easyeditor-menu.md](https://easyeditor-premium.web.app/templates/easyeditor-menu.md)

### 📝 Table Support
Clean and responsive table rendering.

| Feature | Support |
| :--- | :--- |
| **Markdown** | ✅ |
| **Mermaid** | ✅ |
| **KaTeX** | ✅ |
| **SSTP Encryption** | ✅ |
| **Multi-cloud Storage** | ✅ |
| **Collaboration** | ✅ |
| **Git Integration** | ✅ |

---


## *License*
This project is licensed under the GNU Affero General Public License (AGPLv3) with Commons Clause and Trademark Protection.

### *What this means:*

✅ Open Source - Anyone can view, modify, and use the code  
✅ Community Contributions - Improvements must be shared back  
✅ Free to Use - No cost for personal or internal use  
❌ No Commercial Sale - Cannot sell EasyEditor or derivatives  
❌ No Rebranding - Cannot rebrand as "EasyEditor Pro" or similar  
❌ No Proprietary Forks - Cannot create closed-source versions  

### *You can:*

Use Easyeditor for any purpose (free)  
Modify the code for your needs  
Use it in your projects (non-commercially)  
Distribute modified versions (non-commercially, with attribution)  
Contribute improvements back to the project  

### *You cannot:*

Sell Easyeditor or any derivative  
Offer Easyeditor as a paid service  
Charge for hosting or support  
Rebrand it as your own product  
Create proprietary versions  
Remove attribution or license notices  

## *Quick Links*

[![Home](https://img.shields.io/badge/🏠_Home-Visit_Site-blue?style=for-the-badge)](https://easysmartapps.co.uk/) 
[![Docs](https://img.shields.io/badge/📚_Documentation-Read_Docs-green?style=for-the-badge)](https://easysmartapps.co.uk/easyeditor-manual) 
[![Menu Reference](https://img.shields.io/badge/📑_Menu_Reference-View_MENU.md-purple?style=for-the-badge)](docs/MENU.md)
[![Infographic](https://img.shields.io/badge/📊_Infographic-View_PDF-orange?style=for-the-badge)](docs/Easyeditor-Infographic.pdf) 
[![Releases](https://img.shields.io/badge/📦_Releases-View_All-blueviolet?style=for-the-badge)](https://github.com/gcclinux/EasyEditor/releases) 
[![Stars](https://img.shields.io/github/stars/gcclinux/EasyEditor?style=for-the-badge&logo=github)](https://github.com/gcclinux/EasyEditor/stargazers) 
[![License](https://img.shields.io/github/license/gcclinux/EasyEditor?style=for-the-badge)](LICENSE) 

## *Support & Community*

[![Issues](https://img.shields.io/badge/🐛_Report_Issues-GitHub-red?style=for-the-badge)](https://github.com/gcclinux/EasyEditor/issues)
[![Discussions](https://img.shields.io/badge/💬_Join_Discussions-GitHub-blue?style=for-the-badge)](https://github.com/gcclinux/EasyEditor/discussions)