#!/usr/bin/env bash
set -euo pipefail
set -E  # Ensure ERR trap runs in functions and subshells

on_error() {
  local exit_code=$?
  local line=${BASH_LINENO[0]}
  local cmd=${BASH_COMMAND:-unknown}
  echo "Error: command '${cmd}' failed with exit code ${exit_code} at ${BASH_SOURCE[0]}:${line}" >&2
  exit "$exit_code"
}

trap on_error ERR

# Base branch to compare against (always main for your flow)
BASE_BRANCH="main"

require_cli() {
  local bin="$1"
  command -v "$bin" >/dev/null 2>&1 || {
    echo "Required command '${bin}' is not installed or not on PATH." >&2
    exit 1
  }
}

require_cli git
require_cli gh

# Ensure we're in a git repo
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "Not inside a git repository."
  exit 1
}

# Find merge base
MERGE_BASE="$(git merge-base HEAD "$BASE_BRANCH")"

if [[ -z "$MERGE_BASE" ]]; then
  echo "Could not find merge base with $BASE_BRANCH. Is it fetched locally?"
  exit 1
fi

# Collect raw commit subjects between base and HEAD (excluding merge commits)
RAW_COMMITS=$(git log --no-merges --pretty=format:'%s' "$MERGE_BASE"..HEAD)

if [[ -z "$RAW_COMMITS" ]]; then
  echo "No commits found between $BASE_BRANCH and HEAD."
  exit 1
fi

# Turn them into a bullet list for the PR body
COMMITS=$(printf '%s\n' "$RAW_COMMITS" | sed 's/^/- /')

# Derive a default PR title:
# 1. Prefer the first feat:/fix:/refactor: commit
# 2. Strip "feat(...):", "fix(...):", or "refactor(...):)" prefixes
# 3. Fallback to the first commit subject if none match
DEFAULT_TITLE=$(
  (printf '%s\n' "$RAW_COMMITS" | grep -E '^(feat|fix|refactor)(\(|:)' -m1 || printf '%s\n' "$RAW_COMMITS" | head -n1) \
    | sed -E 's/^(feat|fix|refactor)(\([^)]+\))?:\s*//'
)

# Create temp Markdown file for PR description (store in repo)
TMPFILE=$(mktemp "$PWD/pr-description.XXXXXX.md")
trap 'rm -f "$TMPFILE"' EXIT

cat > "$TMPFILE" <<EOF
## Summary

<!-- Edit this summary as needed -->

## Changes

$COMMITS

EOF

echo "Proposed PR title:"
echo "  $DEFAULT_TITLE"
echo

echo "Creating PR with the auto-generated title and description..."
gh pr create --title "$DEFAULT_TITLE" --body-file "$TMPFILE"

echo "Opening PR in your browser for review/editing..."
gh pr view --web
