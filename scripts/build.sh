#!/usr/bin/env bash
# Builds a stored mod: inject → gradle build → on failure one Claude fix attempt → rebuild.
# Usage: scripts/build.sh <modId>   (needs ANTHROPIC_API_KEY for the fix step)
set -euo pipefail
MOD_ID="${1:?Usage: scripts/build.sh <modId>}"

rm -rf template/build/libs
node scripts/inject.js --mod "$MOD_ID"
chmod +x template/gradlew

build() {
  set +e
  (cd template && ./gradlew build --no-daemon 2>&1) | tee build-output.txt
  local status=${PIPESTATUS[0]}
  set -e
  return "$status"
}

if ! build; then
  echo "::warning::Build failed for $MOD_ID — asking Claude for a fix"
  node scripts/fix.js --mod "$MOD_ID"
  node scripts/inject.js --mod "$MOD_ID"
  build
fi
ls -la template/build/libs
