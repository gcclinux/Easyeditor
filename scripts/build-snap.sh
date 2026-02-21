#!/bin/bash
cd "$(dirname "$0")/.."

echo "Building EasyEditor Snap..."
echo "========================"

# Retrieve version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "Detected version: $VERSION"

# Retrieve arch from snap/snapcraft.yaml
ARCH=$(awk '/^platforms:/ {getline; gsub(/:/, ""); print $1}' snap/snapcraft.yaml)
echo "Detected arch: $ARCH"

# Check and create snap bundle directory
SNAP_DIR="src-tauri/target/release/bundle/snap"
if [ ! -d "$SNAP_DIR" ]; then
    echo "Creating snap bundle directory: $SNAP_DIR"
    mkdir -p "$SNAP_DIR"
fi

echo "snapcraft cleaning previous builds..."
snapcraft clean
echo "========================"
echo "removing previous snap installation and package..."
sudo snap remove easyeditor 2>/dev/null || true
echo "========================"
echo "deleting previous snap package..."
rm -f "$SNAP_DIR/easyeditor_${VERSION}_${ARCH}.snap"
echo "========================"
echo "building snap --destructive-mode package..."
snapcraft pack --destructive-mode --output "$SNAP_DIR/easyeditor_${VERSION}_${ARCH}.snap"
echo "========================"
echo "installing new built snap package..."
sudo snap install --classic --dangerous "$SNAP_DIR/easyeditor_${VERSION}_${ARCH}.snap"
echo "========================"
echo "launch easyeditor snap application..."
echo "$ snap run easyeditor"
echo "========================"
echo "Packaged: $SNAP_DIR/easyeditor_${VERSION}_${ARCH}.snap"
echo ""
