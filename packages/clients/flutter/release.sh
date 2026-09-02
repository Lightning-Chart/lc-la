#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/packages/clients/flutter/lightning_chart_flutter"
EXAMPLE_SOURCE_DIR="$ROOT_DIR/examples/flutter"
EXAMPLE_REPOSITORY_URL="git@github.com:Lightning-Chart/lc-la-example-flutter.git"

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

sync_public_example() {
  local checkout_directory
  checkout_directory="$(mktemp -d)/lc-la-example-flutter"

  echo
  echo "Syncing standalone Flutter example..."
  git clone "$EXAMPLE_REPOSITORY_URL" "$checkout_directory"

  find "$checkout_directory" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

  local source_path
  local relative_path
  while IFS= read -r -d '' source_path; do
    relative_path="${source_path#examples/flutter/}"
    mkdir -p "$checkout_directory/$(dirname "$relative_path")"
    cp -p "$ROOT_DIR/$source_path" "$checkout_directory/$relative_path"
  done < <(git -C "$ROOT_DIR" ls-files --cached --others --exclude-standard -z -- examples/flutter)

  git -C "$checkout_directory" add --all
  if git -C "$checkout_directory" diff --cached --quiet; then
    echo "Standalone Flutter example is already up to date."
  else
    git -C "$checkout_directory" commit -m "Sync Flutter example for $VERSION"
    git -C "$checkout_directory" push origin HEAD
    echo "Standalone Flutter example updated."
  fi

  rm -rf "$(dirname "$checkout_directory")"
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

sync_public_example

(cd "$PUBLISH_DIR" && flutter pub publish)
(cd "$ROOT_DIR" && node scripts/record-release.mjs flutter "$VERSION")

echo
echo "Flutter package published. Check:"
echo "  https://pub.dev/packages/lightning_chart_flutter/versions/$VERSION"
