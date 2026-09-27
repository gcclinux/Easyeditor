#!/bin/bash
set -e

echo "Building EasyEditor binary first..."
cd ${PWD}/
export PATH="$HOME/.cargo/bin:$PATH"
npm run tauri build
cd linux

echo "Building EasyEditor Flatpak from binary..."

# Install Flatpak runtime if not present
flatpak install --user -y flathub org.gnome.Platform//51 org.gnome.Sdk//51 || true

# Build the Flatpak from pre-built binary
flatpak-builder --user --install --force-clean build-dir-binary io.github.gcclinux.easyeditor-tauri-binary.yml

# Create distributable package
flatpak build-bundle ~/.local/share/flatpak/repo easyeditor-binary-$(date +%Y%m%d).flatpak io.github.gcclinux.EasyEditor

echo "Build complete! You can run the app with:"
echo "flatpak run io.github.gcclinux.EasyEditor"
echo "Distributable package created: easyeditor-binary-$(date +%Y%m%d).flatpak"

echo "Test Install: flatpak install --user -y ./easyeditor-binary-$(date +%Y%m%d).flatpak"
echo "Then run with: flatpak run io.github.gcclinux.EasyEditor"
echo "To uninstall: flatpak uninstall io.github.gcclinux.EasyEditor"
