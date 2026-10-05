#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/packages/clients/flutter/lightning_chart_flutter"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command npm
require_command node
require_command dart
require_command flutter
require_command git

ensure_changelog_entry() {
  local changelog_path="$PACKAGE_DIR/CHANGELOG.md"
  if grep -q "^## $VERSION$" "$changelog_path"; then
    return
  fi

  local temporary_path
  temporary_path="$(mktemp)"
  {
    head -n 1 "$changelog_path"
    printf '\n## %s\n\nPatch\n' "$VERSION"
    tail -n +2 "$changelog_path"
  } > "$temporary_path"
  mv "$temporary_path" "$changelog_path"
}

PUBLISH_ROOT="$(mktemp -d)"
PUBLISH_DIR="$PUBLISH_ROOT/lightning_chart_flutter"

cleanup_publish_directory() {
  rm -rf "$PUBLISH_ROOT"
}

trap cleanup_publish_directory EXIT

echo "Preparing Flutter release..."
echo
echo "Updating Flutter version and refreshing bundled host..."
(cd "$ROOT_DIR" && node scripts/prepare-release.mjs flutter && npm run build:host)
VERSION="$(sed -nE 's/^version:[[:space:]]*//p' "$PACKAGE_DIR/pubspec.yaml" | head -n 1)"
echo "Flutter release for lightning_chart_flutter $VERSION"
ensure_changelog_entry

echo
echo "Resolving Flutter package dependencies..."
(cd "$ROOT_DIR" && npm run prepare:flutter)

echo
echo "Formatting Flutter sources..."
(cd "$ROOT_DIR" && npm run format:flutter)

echo
echo "Analyzing Flutter package and example..."
(cd "$ROOT_DIR" && npm run analyze:flutter)

echo
echo "Running Flutter tests..."
(cd "$ROOT_DIR" && npm run test:flutter)

echo
echo "Running pub.dev dry run..."
(mkdir -p "$PUBLISH_DIR" && cp -a "$PACKAGE_DIR/." "$PUBLISH_DIR/" && rm -rf "$PUBLISH_DIR/.dart_tool" "$PUBLISH_DIR/build" "$PUBLISH_DIR/example/.dart_tool" "$PUBLISH_DIR/example/build")
(cd "$PUBLISH_DIR" && flutter pub publish --dry-run)

echo
echo "Flutter package dry run passed."
echo "Review the file list above before publishing."

(cd "$PUBLISH_DIR" && flutter pub publish)
(cd "$ROOT_DIR" && node scripts/record-release.mjs flutter "$VERSION")

echo
echo "Flutter package published. Check:"
echo "  https://pub.dev/packages/lightning_chart_flutter/versions/$VERSION"
