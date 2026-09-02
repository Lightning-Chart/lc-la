#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

if [[ -f "$ROOT_DIR/.env" && -z "${NUGET_API_KEY:-}" ]]; then
  NUGET_API_KEY="$(sed -n -E 's/^[[:space:]]*(export[[:space:]]+)?NUGET_API_KEY[[:space:]]*=[[:space:]]*//p' "$ROOT_DIR/.env" | head -n 1 | sed 's/\r$//')"
  NUGET_API_KEY="${NUGET_API_KEY#\"}"
  NUGET_API_KEY="${NUGET_API_KEY%\"}"
  NUGET_API_KEY="${NUGET_API_KEY#\'}"
  NUGET_API_KEY="${NUGET_API_KEY%\'}"
  export NUGET_API_KEY
fi

CLIENT_DIR="$ROOT_DIR/packages/clients/csharp"
PROJECT_DIR="$CLIENT_DIR/LightningChart.LA"

confirm() {
  local prompt="$1"
  printf "%s [y/N] " "$prompt"
  read -r answer
  [[ "$answer" == "y" || "$answer" == "Y" || "$answer" == "yes" || "$answer" == "YES" ]]
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command npm
require_command dotnet
require_command git

sync_public_example() {
  local source_directory="$1"
  local repository_url="$2"
  local repository_name="$3"
  local example_name="$4"
  local checkout_parent
  local checkout_directory
  checkout_parent="$(mktemp -d)"
  checkout_directory="$checkout_parent/$repository_name"

  echo
  echo "Syncing standalone $example_name example..."
  git clone "$repository_url" "$checkout_directory"

  find "$checkout_directory" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

  local source_path
  local relative_path
  while IFS= read -r -d '' source_path; do
    relative_path="${source_path#$source_directory/}"
    mkdir -p "$checkout_directory/$(dirname "$relative_path")"
    cp -p "$ROOT_DIR/$source_path" "$checkout_directory/$relative_path"
  done < <(git -C "$ROOT_DIR" ls-files --cached --others --exclude-standard -z -- "$source_directory")

  git -C "$checkout_directory" add --all
  if git -C "$checkout_directory" diff --cached --quiet; then
    echo "Standalone $example_name example is already up to date."
  else
    git -C "$checkout_directory" commit -m "Sync $example_name example for $VERSION"
    git -C "$checkout_directory" push origin HEAD
    echo "Standalone $example_name example updated."
  fi

  rm -rf "$checkout_parent"
}

echo "Preparing C# release..."
echo
(cd "$ROOT_DIR" && node scripts/prepare-release.mjs csharp)
VERSION="$(sed -nE 's/.*<Version>([^<]+)<\/Version>.*/\1/p' "$PROJECT_DIR/LightningChart.LA.csproj")"
PACKAGE="$PROJECT_DIR/bin/Release/LCLA.$VERSION.nupkg"
echo "C# release for LCLA $VERSION"

echo
echo "Building and testing C# client..."
(cd "$CLIENT_DIR" && dotnet build && dotnet test)

echo
echo "Packing NuGet package..."
(cd "$PROJECT_DIR" && dotnet pack -c Release)

if [[ ! -f "$PACKAGE" ]]; then
  echo "Expected package was not produced: $PACKAGE" >&2
  exit 1
fi

echo
echo "Package ready:"
echo "  $PACKAGE"

if [[ -z "${NUGET_API_KEY:-}" ]]; then
  echo
  echo "NUGET_API_KEY is not set."
  echo "Set NUGET_API_KEY to publish this package to nuget.org."
  exit 1
fi

sync_public_example "examples/blazor-server" "git@github.com:Lightning-Chart/lc-la-example-blazor-server.git" "lc-la-example-blazor-server" "Blazor"
sync_public_example "examples/maui" "git@github.com:Lightning-Chart/lc-la-example-maui.git" "lc-la-example-maui" "MAUI"
sync_public_example "examples/uno" "git@github.com:Lightning-Chart/lc-la-example-uno.git" "lc-la-example-uno" "Uno"

echo
echo "About to publish LCLA $VERSION to nuget.org."
if ! confirm "Continue with NuGet publish?"; then
  echo "NuGet publish cancelled. Package remains available locally at:"
  echo "  $PACKAGE"
  exit 0
fi

dotnet nuget push "$PACKAGE" \
  --source "https://api.nuget.org/v3/index.json" \
  --api-key "$NUGET_API_KEY" \
  --skip-duplicate

(cd "$ROOT_DIR" && node scripts/record-release.mjs csharp "$VERSION")

echo
echo "C# package published. Check:"
echo "  https://www.nuget.org/packages/LCLA/$VERSION"
