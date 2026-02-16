# Easyeditor

Easyeditor is an easy Markdown editor built with [Tauri](https://tauri.app/) that allows you to write Markdown and preview it in real-time. Save, load `.md` files, manage Git repos (stage, commit, push), and export to HTML, TXT, PDF & SSTP Encryption — with over 130 features & examples.

📦 **[GitHub Repository](https://github.com/gcclinux/EasyEditor)** | 🚀 **[Try Online](https://easyeditor-cloud.web.app/)** | 📚 **[Documentation](https://gcclinux.github.io/EasyEditor/docs)**

## Install via Cargo

```bash
cargo install easyeditor
```

> **⚠️ Important:** This is a Tauri desktop application. You **must** install the required system dependencies before running `cargo install`.

### System Dependencies

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libglib2.0-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev \
  librsvg2-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  libxdo-dev \
  patchelf \
  pkg-config \
  build-essential \
  curl \
  wget \
  file
```

**Linux (Fedora):**
```bash
sudo dnf install \
  webkit2gtk4.1-devel \
  gtk3-devel \
  glib2-devel \
  libsoup3-devel \
  javascriptcoregtk4.1-devel \
  librsvg2-devel \
  openssl-devel \
  libappindicator-gtk3-devel \
  patchelf \
  pkg-config
sudo dnf group install "Development Tools"
```

**Linux (Arch):**
```bash
sudo pacman -S \
  webkit2gtk-4.1 \
  gtk3 \
  glib2 \
  libsoup3 \
  librsvg \
  patchelf \
  pkg-config \
  base-devel
```

**macOS:**
```bash
xcode-select --install
```

**Windows:**
- Install [Visual Studio Build Tools](https://aka.ms/vs/17/release/vs_buildtools.exe) with the C++ workload.

## Pre-built Binaries

For a simpler installation experience, download pre-built binaries from the [Releases](https://github.com/gcclinux/EasyEditor/releases) page.

## License

MIT
