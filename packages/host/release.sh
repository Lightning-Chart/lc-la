#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

confirm() {
  printf "%s [y/N] " "$1"
  read -r answer
  [[ "$answer" == "y" || "$answer" == "Y" || "$answer" == "yes" || "$answer" == "YES" ]]
}

echo "npm release for @lcla/host"
(cd "$ROOT_DIR" && node scripts/prepare-release.mjs host)
(cd "$ROOT_DIR/packages/host" && npm run validate && npm publish --dry-run)

if ! confirm "Publish @lcla/host to npm?"; then
  echo "npm publish cancelled."
  exit 0
fi

(cd "$ROOT_DIR/packages/host" && npm publish)
(cd "$ROOT_DIR" && node scripts/record-release.mjs host "$(node -p "require('./packages/host/package.json').version")")
