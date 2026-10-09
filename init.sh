#!/bin/bash
# Startup check for agent sessions. Run from repo root (Git Bash on Windows).
# Build writes main.js + styles.css into this folder = live plugin in dev vault.
set -u
cd "$(dirname "$0")"

BASELINE_TS_ERRORS=41
fail=0

echo "=== Git ==="
git --no-pager log --oneline -5
git status --short

if [ ! -d node_modules ]; then
  echo "=== npm install (also rewrites yarn.lock; do not commit that) ==="
  npm install || exit 1
fi

echo "=== Build ==="
if npm run build; then
  echo "build OK"
else
  echo "build FAILED"; fail=1
fi

echo "=== Typecheck (baseline $BASELINE_TS_ERRORS errors) ==="
count=$(npx tsc --noemit 2>&1 | grep -c "error TS")
echo "typecheck errors: $count"
if [ "$count" -gt "$BASELINE_TS_ERRORS" ]; then
  echo "typecheck WORSE than baseline"; fail=1
elif [ "$count" -lt "$BASELINE_TS_ERRORS" ]; then
  echo "typecheck better than baseline; update BASELINE_TS_ERRORS and AGENTS.md"
fi

echo "Lint skipped: pre-existing CRLF errors. Run 'npm run lint' and judge touched lines only."
echo "No unit tests. UI check: Obsidian > Reload app without saving > test in dev vault."

if [ "$fail" -ne 0 ]; then
  echo "=== Baseline broken: fix before new work ==="
  exit 1
fi
echo "=== Baseline OK ==="
