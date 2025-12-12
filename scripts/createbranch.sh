#!/usr/bin/env bash

set -euo pipefail

echo "Select branch type:"
select TYPE in feat fix refactor; do
    if [[ -n "$TYPE" ]]; then
        break
    else
        echo "Invalid option. Try again."
    fi
done

while true; do
    read -p "Enter the branch name (e.g. parent mode switch): " RAW_NAME

    # Normalize name:
    # - trim leading/trailing whitespace
    # - convert spaces to single dashes
    # - lowercase
    NAME=$(echo "$RAW_NAME" \
        | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' \
        | tr '[:upper:]' '[:lower:]' \
        | sed -E 's/[[:space:]]+/-/g')

    # Validate: only allow a-z, 0-9, and dashes
    if [[ -z "$NAME" ]]; then
        echo "Branch name cannot be empty after normalization. Please try again."
        continue
    fi

    if [[ ! "$NAME" =~ ^[a-z0-9-]+$ ]]; then
        echo "Invalid branch name after normalization: '$NAME'"
        echo "Allowed characters: a-z, 0-9, and '-'. Please try again."
        continue
    fi

    break
done

BRANCH_NAME="${TYPE}/${NAME}"
echo "Branch will be created as: $BRANCH_NAME"

# Create branch
git checkout -b "$BRANCH_NAME"

# Stage changes
git add .

# Default commit message
COMMIT_MESSAGE="chore: Initial commit for new branch ${BRANCH_NAME}"
echo "Using commit message: $COMMIT_MESSAGE"

git commit -m "$COMMIT_MESSAGE"

# Push the branch
git push -u origin "$BRANCH_NAME"

echo "Branch '$BRANCH_NAME' created, committed, and pushed."
