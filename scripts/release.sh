#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
copied_changelogs=()

fail() {
  echo "$1" >&2
  exit 1
}

checkpoint() {
  local status="$1"
  local target="$2"
  local color

  case "$status" in
    COMPLETED) color='32' ;;
    FAILURE) color='31' ;;
    *) fail "Unknown release checkpoint status: $status" ;;
  esac

  printf '\n\033[1;%sm========== %s %s ==========\033[0m\n\n' "$color" "$status" "$target" >&2
}

choose_targets() {
  local targets_file
  targets_file="$(mktemp)"
  if ! LCLA_RELEASE_TARGETS_FILE="$targets_file" node "$ROOT_DIR/scripts/select-release-targets.mjs" >&2; then
    rm -f "$targets_file"
    fail "Release target selection failed."
  fi

  if [[ ! -s "$targets_file" ]]; then
    rm -f "$targets_file"
    echo "Release cancelled." >&2
    return 2
  fi

  cat "$targets_file"
  rm -f "$targets_file"
}

copy_changelog_to_target() {
  local release_script="${1//\\//}"
  if [[ "$release_script" == "packages/clients/flutter/release.sh" ]]; then
    return
  fi
  local package_directory
  case "$release_script" in
    packages/host/release.sh)
      package_directory="packages/host"
      ;;
    packages/clients/csharp/release.sh)
      package_directory="packages/clients/csharp/LightningChart.LA"
      ;;
    packages/clients/flutter/release.sh)
      package_directory="packages/clients/flutter/lightning_chart_flutter"
      ;;
    *)
      fail "No changelog package directory is configured for $release_script."
      ;;
  esac

  local target_path="$ROOT_DIR/$package_directory/CHANGELOG.md"
  cp "$ROOT_DIR/CHANGELOG.md" "$target_path"
  copied_changelogs+=("$target_path")
}

is_website_target() {
  [[ "$1" == "website" ]]
}

release_target_name() {
  case "${1//\\//}" in
    packages/host/release.sh) echo "host release" ;;
    packages/clients/csharp/release.sh) echo "csharp release" ;;
    packages/clients/flutter/release.sh) echo "flutter release" ;;
    website) echo "website build" ;;
    *) fail "No release checkpoint name is configured for $1." ;;
  esac
}

cleanup_copied_changelogs() {
  for changelog_path in "${copied_changelogs[@]}"; do
    rm -f "$changelog_path"
  done
}

publish_target() {
  local release_script="${1//\\//}"
  echo
  echo "==> Running $release_script"
  bash "$ROOT_DIR/$release_script"
}

build_website() {
  echo
  echo "==> Building website"
  npm run docs:build
}

cd "$ROOT_DIR"
trap cleanup_copied_changelogs EXIT

release_line="$(node -p "require('./versions.json').releaseLine")"
if [[ ! "$release_line" =~ ^[0-9]+\.[0-9]+$ ]]; then
  fail "versions.json releaseLine must use major.minor format; found: $release_line"
fi

if targets="$(choose_targets)"; then
  :
else
  selection_status=$?
  if [[ "$selection_status" -eq 2 ]]; then
    exit 0
  fi
  fail "Release target selection failed."
fi
echo
echo "Preparing selected releases on shared major/minor line $release_line.x: $targets"

for release_script in $targets; do
  if ! is_website_target "$release_script"; then
    copy_changelog_to_target "$release_script"
  fi
done

for release_script in $targets; do
  target_name="$(release_target_name "$release_script")"
  if is_website_target "$release_script"; then
    if ! build_website; then
      checkpoint FAILURE "$target_name"
      fail "Website build failed; release stopped."
    fi
    checkpoint COMPLETED "$target_name"
  elif ! publish_target "$release_script"; then
    checkpoint FAILURE "$target_name"
    fail "$release_script failed; release stopped."
  else
    checkpoint COMPLETED "$target_name"
  fi
done

if [[ " $targets " == *" website "* ]]; then
  echo
  echo "Manual action required: copy $ROOT_DIR/website/build to the deployment server."
fi
