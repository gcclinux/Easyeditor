#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -z "$1" ]; then
    echo "❌ Error: Missing new version parameter."
    echo "Usage: ./bump_version.sh <new_version> [--no-tag]"
    echo "Example: ./bump_version.sh 1.8.1"
    exit 1
fi

node "$SCRIPT_DIR/bump_version.js" "$@"
