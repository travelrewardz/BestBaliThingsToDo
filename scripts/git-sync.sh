#!/usr/bin/env bash
# Commit all project changes and push them to GitHub (origin/main).
#
#   usage: bash scripts/git-sync.sh "your commit message"
#
# The GitHub remote is already configured in .git/config (local only,
# never committed). Requires network access; safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

MSG="${1:-Update project ($(date +'%Y-%m-%d %H:%M'))}"

git add -A
if git diff --cached --quiet; then
  echo "Nothing to commit — already up to date with the working tree."
else
  git commit -m "$MSG"
fi

git push origin main
echo "✓ Pushed to https://github.com/travelrewardz/BestBaliThingsToDo"
