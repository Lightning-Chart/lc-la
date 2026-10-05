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
