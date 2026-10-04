#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # Desktop launchers do not load shell startup files, so load nvm explicitly.
  . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null
fi

if [ ! -d node_modules ]; then
  echo "Dependencies are missing in $SCRIPT_DIR"
  echo "Run 'npm install' once, then launch the shortcut again."
  read -r -p "Press Enter to close..."
  exit 1
fi

exec npm run dev -- --open
