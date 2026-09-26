#!/usr/bin/env bash
#
# generate-snapcraft.sh
#
# Generates snap/snapcraft.yaml from snap/snapcraft.yaml.in, substituting the
# @ARCH@ placeholder in the `platforms:` block with the host machine's
# architecture (or an override passed as the first argument).
#
# Usage:
#   ./snap/generate-snapcraft.sh            # use the host architecture
#   ./snap/generate-snapcraft.sh arm64      # force a specific architecture
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/snapcraft.yaml.in"
OUTPUT="${SCRIPT_DIR}/snapcraft.yaml"

if [ ! -f "${TEMPLATE}" ]; then
  echo "error: template not found: ${TEMPLATE}" >&2
  exit 1
fi

# Determine the target architecture:
#   1. explicit argument, else
#   2. dpkg --print-architecture (Debian arch name: amd64, arm64, ...), else
#   3. map from uname -m as a fallback for non-Debian hosts.
ARCH="${1:-}"
if [ -z "${ARCH}" ]; then
  if command -v dpkg >/dev/null 2>&1; then
    ARCH="$(dpkg --print-architecture)"
  else
    case "$(uname -m)" in
      x86_64)          ARCH="amd64" ;;
      aarch64|arm64)   ARCH="arm64" ;;
      armv7l|armhf)    ARCH="armhf" ;;
      ppc64le)         ARCH="ppc64el" ;;
      s390x)           ARCH="s390x" ;;
      riscv64)         ARCH="riscv64" ;;
      *)
        echo "error: could not determine Debian architecture from '$(uname -m)'." >&2
        echo "       pass one explicitly, e.g. $0 amd64" >&2
        exit 1
        ;;
    esac
  fi
fi

echo "Generating ${OUTPUT} for architecture: ${ARCH}"
sed "s/@ARCH@/${ARCH}/g" "${TEMPLATE}" > "${OUTPUT}"

echo "Done. platforms block:"
grep -A1 '^platforms:' "${OUTPUT}"
