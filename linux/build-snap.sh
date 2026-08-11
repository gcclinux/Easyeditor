#!/bin/bash
# =============================================================================
# build-snap.sh - Build EasyEditor Snap with Strict Confinement
# =============================================================================
# This script builds the EasyEditor snap package using strict confinement
# with the gnome extension (provides WebKitGTK 4.1 from gnome-46-2404).
#
# Usage: ./linux/build-snap.sh [--clean] [--install] [--run]
#   --clean   : Run snapcraft clean before building
#   --install : Install the snap after building
#   --run     : Run the snap after installing
# =============================================================================

set -e
cd "$(dirname "$0")/.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
DO_CLEAN=false
DO_INSTALL=false
DO_RUN=false

for arg in "$@"; do
    case $arg in
        --clean)   DO_CLEAN=true ;;
        --install) DO_INSTALL=true ;;
        --run)     DO_RUN=true ;;
        --help|-h)
            echo "Usage: ./linux/build-snap.sh [--clean] [--install] [--run]"
            echo "  --clean   : Run snapcraft clean before building"
            echo "  --install : Install the snap after building"
            echo "  --run     : Run the snap after installing"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown argument: $arg${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  EasyEditor Snap Build (Strict Confinement) ${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# Retrieve version from package.json
VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}Version:${NC} $VERSION"

# Retrieve arch from snap/snapcraft.yaml
ARCH=$(awk '/^platforms:/ {getline; gsub(/:/, ""); print $1}' snap/snapcraft.yaml)
echo -e "${GREEN}Architecture:${NC} $ARCH"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v snapcraft &> /dev/null; then
    echo -e "${RED}ERROR: snapcraft is not installed.${NC}"
    echo "Install it with: sudo snap install snapcraft --classic"
    exit 1
fi
echo -e "  ✓ snapcraft found: $(snapcraft --version)"

if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: node is not installed.${NC}"
    exit 1
fi
echo -e "  ✓ node found: $(node --version)"

if ! command -v rustc &> /dev/null; then
    echo -e "${YELLOW}  ⚠ rustc not found on host (will be provided by build-snap rustup)${NC}"
else
    echo -e "  ✓ rustc found: $(rustc --version)"
fi

echo ""

# Output directory
SNAP_DIR="src-tauri/target/release/bundle/snap"
mkdir -p "$SNAP_DIR"

# Clean if requested
if [ "$DO_CLEAN" = true ]; then
    echo -e "${YELLOW}Cleaning previous builds...${NC}"
    snapcraft clean 2>/dev/null || true
    echo -e "${GREEN}Clean complete.${NC}"
    echo ""
fi

# Build
echo -e "${YELLOW}Building snap package...${NC}"
echo -e "${BLUE}This will build the Tauri app inside a confined environment.${NC}"
echo -e "${BLUE}The gnome extension provides WebKitGTK 4.1 at runtime.${NC}"
echo ""

SNAP_OUTPUT="$SNAP_DIR/easyeditor_${VERSION}_${ARCH}.snap"

# Remove old snap if exists
rm -f "$SNAP_OUTPUT"

# Build with snapcraft using LXD (managed build)
# core24 snaps require Ubuntu 24.04 build environment.
# Since the host may be Ubuntu 26.04, we use LXD for isolation.
# To force destructive mode (only on Ubuntu 24.04 hosts), add --destructive-mode
snapcraft pack --output "$SNAP_OUTPUT"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}=============================================${NC}"
    echo -e "${GREEN}  Build successful!${NC}"
    echo -e "${GREEN}  Output: ${SNAP_OUTPUT}${NC}"
    echo -e "${GREEN}  Size: $(du -h "$SNAP_OUTPUT" | cut -f1)${NC}"
    echo -e "${GREEN}=============================================${NC}"
else
    echo ""
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

# Install if requested
if [ "$DO_INSTALL" = true ]; then
    echo ""
    echo -e "${YELLOW}Installing snap...${NC}"

    # Remove old installation
    sudo snap remove easyeditor 2>/dev/null || true

    # Install with --dangerous (unsigned local snap)
    sudo snap install --dangerous "$SNAP_OUTPUT"

    echo -e "${GREEN}Snap installed successfully.${NC}"
    echo ""

    # Connect interfaces that don't auto-connect
    echo -e "${YELLOW}Connecting optional interfaces...${NC}"
    sudo snap connect easyeditor:ssh-keys 2>/dev/null || echo "  ssh-keys: skipped (may not be available)"
    sudo snap connect easyeditor:gpg-keys 2>/dev/null || echo "  gpg-keys: skipped (may not be available)"
    sudo snap connect easyeditor:removable-media 2>/dev/null || echo "  removable-media: skipped (may not be available)"
    echo -e "${GREEN}Interface connections complete.${NC}"
fi

# Run if requested
if [ "$DO_RUN" = true ]; then
    echo ""
    echo -e "${YELLOW}Launching EasyEditor...${NC}"
    snap run easyeditor &
    echo -e "${GREEN}EasyEditor launched (PID: $!)${NC}"
fi

echo ""
echo -e "${BLUE}Done.${NC}"
