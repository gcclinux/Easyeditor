#!/bin/bash
# Build the Arch package from the current working tree (no GitHub tag needed).
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
VER=$(node -p "require('$ROOT/package.json').version")
OUT="$PWD/.localbuild"

rm -rf "$OUT"
mkdir -p "$OUT"

tar -czf "$OUT/easyeditor-$VER.tar.gz" -C "$ROOT/.." \
    --exclude=node_modules --exclude=dist --exclude=.git \
    --exclude='src-tauri/target' --exclude=archlinux \
    --transform "s,^$(basename "$ROOT"),Easyeditor-$VER," \
    "$(basename "$ROOT")"

cp easyeditor.desktop "$OUT/"
sed -E "s|^source=\(\"[^\"]*\"|source=(\"easyeditor-$VER.tar.gz\"|" PKGBUILD > "$OUT/PKGBUILD"

cd "$OUT"
# -d: node/npm come from nvm, so pacman's makedepends check would fail
makepkg -f -d --skipchecksums "$@"

echo
echo "Built: $(ls "$OUT"/*.pkg.tar.zst)"
echo "Install with: sudo pacman -U $OUT/*.pkg.tar.zst"
