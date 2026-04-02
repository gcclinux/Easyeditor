#!/bin/bash
# Build EasyEditor Arch Linux package (.pkg.tar.zst) from Tauri build output
set -e

cd "$(dirname "$0")/.."
ROOT_DIR="$(pwd)"

echo "Building EasyEditor Arch Linux Package..."
echo "=========================================="

# Retrieve version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "Detected version: $VERSION"

# Detect architecture
MACHINE_ARCH=$(uname -m)
case "$MACHINE_ARCH" in
    x86_64)  ARCH="x86_64" ;;
    aarch64) ARCH="aarch64" ;;
    *)       echo "Unsupported architecture: $MACHINE_ARCH"; exit 1 ;;
esac
echo "Detected arch: $ARCH"

# Tauri binary path
TAURI_BIN="$ROOT_DIR/src-tauri/target/release/easyeditor"
if [ ! -f "$TAURI_BIN" ]; then
    echo "Tauri binary not found at $TAURI_BIN"
    echo "Run 'npm run tauri:build' first to produce the release binary."
    exit 1
fi

# Output and build directories
PKG_DIR="$ROOT_DIR/src-tauri/target/release/bundle/archlinux"
PKG_NAME="easyeditor-${VERSION}-1-${ARCH}.pkg.tar.zst"
STAGING="$PKG_DIR/staging"
rm -rf "$STAGING"
mkdir -p "$STAGING"

echo "=========================================="
echo "Assembling package tree..."

# Install binary
install -Dm755 "$TAURI_BIN" "$STAGING/usr/bin/easyeditor"

# Install desktop file
install -Dm644 "$ROOT_DIR/linux/io.github.gcclinux.EasyEditor.desktop" \
    "$STAGING/usr/share/applications/io.github.gcclinux.EasyEditor.desktop"

# Install icon
install -Dm644 "$ROOT_DIR/public/128x128.png" \
    "$STAGING/usr/share/icons/hicolor/128x128/apps/io.github.gcclinux.EasyEditor.png"

# Install license
install -Dm644 "$ROOT_DIR/LICENSE" \
    "$STAGING/usr/share/licenses/easyeditor/LICENSE"

# Generate .PKGINFO metadata
BUILDDATE=$(date -u '+%s')
PKGSIZE=$(du -sb "$STAGING" | awk '{print $1}')

cat > "$STAGING/.PKGINFO" << EOF
pkgname = easyeditor
pkgver = ${VERSION}-1
pkgdesc = EasyEditor - A simple Markdown editor with live preview
url = https://github.com/gcclinux/Easyeditor
builddate = ${BUILDDATE}
packager = Unknown Packager
size = ${PKGSIZE}
arch = ${ARCH}
license = MIT
depend = webkit2gtk-4.1
depend = gtk3
depend = glib2
depend = openssl
depend = libsoup3
depend = gst-plugins-base
depend = gst-plugins-good
optdepend = git: Git integration support
provides = easyeditor
conflict = easyeditor
EOF

echo "=========================================="
echo "Compressing package..."

# Build the .pkg.tar.zst archive using bsdtar (libarchive), same as pacman/makepkg
cd "$STAGING"

# Build file list (directories + files under usr/, no ./ prefix)
find usr -type d -o -type f | sort > /tmp/easyeditor-filelist.txt

# Generate .MTREE (file integrity metadata used by pacman for file tracking)
LANG=C fakeroot -- bsdtar -cf - --format=mtree \
    --options='!all,use-set,type,uid,gid,mode,time,size,md5,sha256,link' \
    .PKGINFO $(cat /tmp/easyeditor-filelist.txt) | gzip > .MTREE

# Create the final package archive
# .PKGINFO and .MTREE must come first, then the usr/ tree
LANG=C fakeroot -- bsdtar --no-fflags -cf - \
    .PKGINFO .MTREE $(cat /tmp/easyeditor-filelist.txt) \
    | zstd -c -T0 > "$PKG_DIR/$PKG_NAME"

rm -f /tmp/easyeditor-filelist.txt

# Cleanup staging
rm -rf "$STAGING"

echo "=========================================="
echo "Packaged: $PKG_DIR/$PKG_NAME"
echo ""
echo "Install with:"
echo "  sudo pacman -U $PKG_DIR/$PKG_NAME"
echo ""
echo "Or to install immediately:"
echo "  sudo pacman -U $PKG_DIR/$PKG_NAME --noconfirm"
echo "=========================================="
