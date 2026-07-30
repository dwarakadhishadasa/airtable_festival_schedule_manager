#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d node_modules ]; then
  echo "Dependencies are missing in $SCRIPT_DIR"
  echo "Run 'npm install' once, then launch the shortcut again."
  read -r -p "Press Enter to close..."
  exit 1
fi

exec npm run dev -- --open
