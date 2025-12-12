#!/usr/bin/env bash
set -euo pipefail

###
# 0. Auto-detect package alias from sfdx-project.json
###
PACKAGE_ALIAS="${PACKAGE_ALIAS:-$(jq -r '.packageAliases | keys[0]' sfdx-project.json)}"
echo "Detected PACKAGE_ALIAS from sfdx-project.json: $PACKAGE_ALIAS"

###
# CONFIG (override via env if needed)
###
DEV_HUB_ALIAS="${DEV_HUB_ALIAS:-DevHub}"
GIT_MAIN_BRANCH="${GIT_MAIN_BRANCH:-main}"
COMMIT_PREFIX="${COMMIT_PREFIX:-Release}"

# TAG_NAME will be set after THIS_RELEASE_VERSION is known
TAG_NAME=""

###
# Helper: yes/no prompt
###
confirm() {
  local prompt="$1"
  read -r -p "$prompt [y/N] " reply
  [[ "$reply" == "y" || "$reply" == "Y" ]]
}

echo "=== Salesforce 2GP Release Script ==="
echo "Using:"
echo "  PACKAGE_ALIAS   = $PACKAGE_ALIAS"
echo "  DEV_HUB_ALIAS   = $DEV_HUB_ALIAS"
echo "  GIT_MAIN_BRANCH = $GIT_MAIN_BRANCH"
echo

if ! confirm "Continue with these settings?"; then
  echo "Aborting."
  exit 1
fi

###
# Check dependencies
###
for cmd in sf jq git gh; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: '$cmd' is not installed or not in PATH."
    exit 1
  fi
done

echo
echo "=== Pre-flight Git Checks ==="
if ! confirm "Have you merged all the work for this release into $GIT_MAIN_BRANCH branch?"; then
  echo "Merge all relevant changes so $GIT_MAIN_BRANCH is up to date, then start this script again."
  exit 1
fi

if confirm "This script needs to be run after checking out $GIT_MAIN_BRANCH branch. Checkout $GIT_MAIN_BRANCH now?"; then
  git checkout "$GIT_MAIN_BRANCH"
  git pull origin "$GIT_MAIN_BRANCH"
else
  echo "Please checkout $GIT_MAIN_BRANCH before running this script."
  exit 1
fi

###
# 1. Find last released version
###
echo
echo "=== Step 1: Fetch last released package version ==="
set +e
PACKAGE_VERSION_LIST_JSON=$(
  sf package version list \
    --packages "$PACKAGE_ALIAS" \
    --target-dev-hub "$DEV_HUB_ALIAS" \
    --json
)
SF_PACKAGE_LIST_EXIT=$?
set -e

if [[ $SF_PACKAGE_LIST_EXIT -ne 0 ]]; then
  # Default to raw output if jq parsing fails (e.g., CLI printed non-JSON error)
  PACKAGE_VERSION_ERROR="$PACKAGE_VERSION_LIST_JSON"

  set +e
  PARSED_PACKAGE_ERROR=$(
    echo "$PACKAGE_VERSION_LIST_JSON" \
      | jq -r '.message // .error // empty' 2>/dev/null
  )
  JQ_PARSE_EXIT=$?
  set -e

  if [[ $JQ_PARSE_EXIT -eq 0 && -n "$PARSED_PACKAGE_ERROR" ]]; then
    PACKAGE_VERSION_ERROR="$PARSED_PACKAGE_ERROR"
  fi

  if echo "$PACKAGE_VERSION_ERROR" | grep -qi "no package version"; then
    echo "sf CLI reported that no package versions exist yet for '$PACKAGE_ALIAS'."
    LAST_RELEASE_VERSION=""
  else
    echo "ERROR: Failed to list package versions:"
    echo "$PACKAGE_VERSION_ERROR"
    exit $SF_PACKAGE_LIST_EXIT
  fi
else
  LAST_RELEASE_VERSION=$(
    echo "$PACKAGE_VERSION_LIST_JSON" \
      | jq -r '.result[]? | select(.IsReleased==true) | .Version' \
      | sort -V | tail -1
  )
fi

if [[ -z "$LAST_RELEASE_VERSION" || "$LAST_RELEASE_VERSION" == "null" ]]; then
  echo "No released versions found for this package."
  echo "This will be the FIRST version."

  # Default first version
  LAST_RELEASE_VERSION="0.0.0.0"
  THIS_RELEASE_VERSION="0.1.0.0"
  PROJECT_VERSION_NUMBER="0.1.0.NEXT"
  PROJECT_VERSION_NAME="v${THIS_RELEASE_VERSION}"

  echo "Setting initial release values:"
  echo "  LAST_RELEASE_VERSION   = $LAST_RELEASE_VERSION"
  echo "  THIS_RELEASE_VERSION   = $THIS_RELEASE_VERSION"
  echo "  PROJECT_VERSION_NUMBER = $PROJECT_VERSION_NUMBER"
  echo "  PROJECT_VERSION_NAME   = $PROJECT_VERSION_NAME"

  if ! confirm "Use these default values for the first package release?"; then
    echo "Aborting."
    exit 1
  fi

  export LAST_RELEASE_VERSION
  export THIS_RELEASE_VERSION
  export PROJECT_VERSION_NUMBER
  export PROJECT_VERSION_NAME

  FirstReleaseMode=true
else
  echo "Last released version: $LAST_RELEASE_VERSION"
  FirstReleaseMode=false

  if ! confirm "Is this the correct last released version?"; then
    echo "Aborting. Please check your package versions."
    exit 1
  fi
fi

###
# 2. Compute next versions (skip increment if first release)
###
if [[ "$FirstReleaseMode" == true ]]; then
  echo
  echo "=== Step 2: Skipping version increment (first release mode) ==="
else
  echo
  echo "=== Step 2: Compute next version numbers ==="

  IFS='.' read -r MAJOR MINOR PATCH BUILD <<< "$LAST_RELEASE_VERSION"

  RELEASE_TYPE=""
  while [[ ! "$RELEASE_TYPE" =~ ^(major|minor|patch)$ ]]; do
    read -r -p "Release type? (major/minor/patch): " input
    if [[ -z "$input" ]]; then
      RELEASE_TYPE="patch"
    elif [[ "$input" =~ ^(major|minor|patch)$ ]]; then
      RELEASE_TYPE="$input"
    else
      echo "Invalid release type. Please enter 'major', 'minor', or 'patch'."
    fi
  done

  case "$RELEASE_TYPE" in
    major)
      NEW_MAJOR=$((MAJOR + 1))
      NEW_MINOR=0
      NEW_PATCH=0
      ;;
    minor)
      NEW_MAJOR=$MAJOR
      NEW_MINOR=$((MINOR + 1))
      NEW_PATCH=0
      ;;
    patch)
      NEW_MAJOR=$MAJOR
      NEW_MINOR=$MINOR
      NEW_PATCH=$((PATCH + 1))
      ;;
  esac

  THIS_RELEASE_VERSION="${NEW_MAJOR}.${NEW_MINOR}.${NEW_PATCH}.0"
  PROJECT_VERSION_NUMBER="${NEW_MAJOR}.${NEW_MINOR}.${NEW_PATCH}.NEXT"
  PROJECT_VERSION_NAME="v${THIS_RELEASE_VERSION}"

  echo "Computed next release values:"
  echo "  LAST_RELEASE_VERSION   = $LAST_RELEASE_VERSION"
  echo "  THIS_RELEASE_VERSION   = $THIS_RELEASE_VERSION"
  echo "  PROJECT_VERSION_NUMBER = $PROJECT_VERSION_NUMBER"
  echo "  PROJECT_VERSION_NAME   = $PROJECT_VERSION_NAME"

  if ! confirm "Use these computed version values?"; then
    echo "Aborting."
    exit 1
  fi

  export LAST_RELEASE_VERSION
  export THIS_RELEASE_VERSION
  export PROJECT_VERSION_NUMBER
  export PROJECT_VERSION_NAME
fi

# Set tag name now that THIS_RELEASE_VERSION is known
TAG_NAME="v${THIS_RELEASE_VERSION}"

###
# 3. Update sfdx-project.json
###
echo
echo "=== Step 3: Update sfdx-project.json ==="

OLD_VERSION_NAME=$(jq -r '.packageDirectories[] | select(.default==true) | .versionName // empty' sfdx-project.json)
OLD_VERSION_NUMBER=$(jq -r '.packageDirectories[] | select(.default==true) | .versionNumber // empty' sfdx-project.json)

jq \
  --arg vname "$PROJECT_VERSION_NAME" \
  --arg vnum "$PROJECT_VERSION_NUMBER" \
  '
    .packageDirectories |= map(
      if .default == true then
        .versionName = $vname |
        .versionNumber = $vnum
      else
        .
      end
    )
  ' sfdx-project.json > sfdx-project.json.tmp && mv sfdx-project.json.tmp sfdx-project.json

NEW_VERSION_NAME=$(jq -r '.packageDirectories[] | select(.default==true) | .versionName // empty' sfdx-project.json)
NEW_VERSION_NUMBER=$(jq -r '.packageDirectories[] | select(.default==true) | .versionNumber // empty' sfdx-project.json)

echo "Updated sfdx-project.json (default package version fields):"
printf "  versionName:    %s -> %s\n" "${OLD_VERSION_NAME:-<unset>}" "${NEW_VERSION_NAME:-<unset>}"
printf "  versionNumber:  %s -> %s\n" "${OLD_VERSION_NUMBER:-<unset>}" "${NEW_VERSION_NUMBER:-<unset>}"

if ! confirm "Does the sfdx-project.json change look correct?"; then
  echo "Aborting. Revert the change if needed (git restore sfdx-project.json)."
  exit 1
fi

###
# 4. Git commit and tag
###
echo
echo "=== Step 4: Git commit and tag ==="
if git diff --quiet -- sfdx-project.json; then
  echo "No changes detected in sfdx-project.json; skipping commit."
else
  COMMIT_MESSAGE="${COMMIT_PREFIX} ${TAG_NAME}"
  echo "Proposed commit message: $COMMIT_MESSAGE"

  if confirm "Create git commit now?"; then
    git add sfdx-project.json
    git commit -m "$COMMIT_MESSAGE"
    echo "Commit created."

    echo "Proposed tag: $TAG_NAME"

    if confirm "Create git tag '$TAG_NAME'?"; then
      if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
        echo "Tag '$TAG_NAME' already exists."
        if confirm "Delete existing tag '$TAG_NAME' and recreate it?"; then
          git tag -d "$TAG_NAME"
          git tag "$TAG_NAME"
          echo "Tag '$TAG_NAME' recreated."
        else
          echo "Leaving existing tag in place; skipping tag creation."
        fi
      else
        git tag "$TAG_NAME"
        echo "Tag created."
      fi
    else
      echo "Skipping tag creation."
    fi
  else
    echo "Skipping git commit and tag."
  fi
fi

###
# 5. Create package version
###
echo
echo "=== Step 5: Create new package version ==="
echo "This will use:"
echo "  PACKAGE_ALIAS         = $PACKAGE_ALIAS"
echo "  DEV_HUB_ALIAS         = $DEV_HUB_ALIAS"
echo "  PROJECT_VERSION_NAME  = $PROJECT_VERSION_NAME"
echo "  PROJECT_VERSION_NUMBER= $PROJECT_VERSION_NUMBER (via sfdx-project.json)"
echo "  Wait time (minutes)   = 60"

if ! confirm "Proceed to create the new package version?"; then
  echo "Aborting before package version creation."
  exit 1
fi

echo "Starting package version creation (async) and polling every 60 seconds..."

CREATE_OUTPUT=$(
  sf package version create \
    --package "$PACKAGE_ALIAS" \
    --target-dev-hub "$DEV_HUB_ALIAS" \
    --installation-key-bypass \
    --code-coverage \
    --wait 0 \
    --json
)

echo "Raw create output (initial response):"
echo "----------------------------------------"
echo "$CREATE_OUTPUT" | jq '.'
echo "----------------------------------------"

CREATE_REQUEST_ID=$(echo "$CREATE_OUTPUT" | jq -r '.result.Id // empty')

if [[ -z "$CREATE_REQUEST_ID" ]]; then
  echo "ERROR: Could not parse package version create request Id from sf output."
  exit 1
fi

POLL_INTERVAL=60
MAX_POLLS=60
POLL_COUNT=0
CREATE_STATUS=""
NEW_PV_ID=""
NEW_PV_VERSION=""
LAST_POLL_OUTPUT=""

echo "Create request Id: $CREATE_REQUEST_ID"
echo "Polling creation status every ${POLL_INTERVAL}s (max $((MAX_POLLS)) checks)..."

while (( POLL_COUNT < MAX_POLLS )); do
  ((POLL_COUNT++))

  POLL_OUTPUT=$(
    sf package version create report \
      --package-create-request-id "$CREATE_REQUEST_ID" \
      --target-dev-hub "$DEV_HUB_ALIAS" \
      --json
  )
  LAST_POLL_OUTPUT="$POLL_OUTPUT"

  CREATE_STATUS=$(
    echo "$POLL_OUTPUT" \
      | jq -r '
          .result
          | (if type=="array" then .[0] else . end)
          | .Status // .status // empty
        '
  )
  NEW_PV_ID=$(
    echo "$POLL_OUTPUT" \
      | jq -r '
          .result
          | (if type=="array" then .[0] else . end)
          | .SubscriberPackageVersionId // .Id // empty
        '
  )
  NEW_PV_VERSION=$(
    echo "$POLL_OUTPUT" \
      | jq -r '
          .result
          | (if type=="array" then .[0] else . end)
          | .PackageVersionNumber // .Version // empty
        '
  )

  STATUS_LINE="[$(date '+%H:%M:%S')] Status: ${CREATE_STATUS:-unknown}"
  [[ -n "$NEW_PV_ID" ]] && STATUS_LINE+=" | SPV: $NEW_PV_ID"
  [[ -n "$NEW_PV_VERSION" ]] && STATUS_LINE+=" | Version: $NEW_PV_VERSION"
  echo "$STATUS_LINE"

  case "$CREATE_STATUS" in
    Success)
      break
      ;;
    Error|Failed|Canceled)
      echo "Package version creation failed. Full report:"
      echo "$POLL_OUTPUT" | jq '.'
      exit 1
      ;;
  esac

  sleep "$POLL_INTERVAL"
done

if [[ "$CREATE_STATUS" != "Success" ]]; then
  echo "Package version creation did not complete within $((MAX_POLLS * POLL_INTERVAL / 60)) minutes."
  exit 1
fi

echo "Final create report:"
echo "----------------------------------------"
echo "$LAST_POLL_OUTPUT" | jq '.'
echo "----------------------------------------"

NEW_PV_ID=${NEW_PV_ID:-$(
  echo "$LAST_POLL_OUTPUT" \
    | jq -r '
        .result
        | (if type=="array" then .[0] else . end)
        | .SubscriberPackageVersionId // .Id // empty
      '
)}
NEW_PV_VERSION=${NEW_PV_VERSION:-$(
  echo "$LAST_POLL_OUTPUT" \
    | jq -r '
        .result
        | (if type=="array" then .[0] else . end)
        | .PackageVersionNumber // .Version // empty
      '
)}

if [[ -z "$NEW_PV_ID" ]]; then
  echo "ERROR: Could not parse new package version Id from sf output."
  exit 1
fi

echo "New package version created:"
echo "  SubscriberPackageVersionId = $NEW_PV_ID"
[[ -n "$NEW_PV_VERSION" ]] && echo "  Version                     = $NEW_PV_VERSION"

if ! confirm "Is this the correct package version to promote?"; then
  echo "Aborting before promotion."
  exit 1
fi

###
# 6. Promote package version
###
echo
echo "=== Step 6: Promote package version ==="
echo "Will promote version id: $NEW_PV_ID"

if confirm "Proceed to promote this version?"; then
  sf package version promote \
    --package "$NEW_PV_ID" \
    --target-dev-hub "$DEV_HUB_ALIAS" \
    --no-prompt

  echo "Package version promoted."
else
  echo "Skipping promotion."
fi

###
# 7. Push git branch and tag to remote
###
echo
echo "=== Step 7: Push git branch and tag to remote ==="

# Capture any late changes to sfdx-project.json (e.g., new package version alias)
if ! git diff --quiet -- sfdx-project.json; then
  echo "Detected uncommitted changes in sfdx-project.json (likely the promoted package alias)."
  LATE_COMMIT_MESSAGE="${COMMIT_PREFIX} ${TAG_NAME} (package alias)"

  if confirm "Commit updated sfdx-project.json and retag '$TAG_NAME' on the latest commit?"; then
    git add sfdx-project.json
    git commit -m "$LATE_COMMIT_MESSAGE"
    echo "Committed sfdx-project.json changes."

    if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
      git tag -f "$TAG_NAME"
      echo "Moved tag '$TAG_NAME' to latest commit."
    else
      git tag "$TAG_NAME"
      echo "Tag '$TAG_NAME' created on latest commit."
    fi
  else
    echo "Skipping commit of sfdx-project.json changes; push will not include alias updates."
  fi
fi

PUSH_TARGETS=("$GIT_MAIN_BRANCH")
TAG_EXISTS=false
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  TAG_EXISTS=true
  PUSH_TARGETS+=("$TAG_NAME")
else
  echo "Tag '$TAG_NAME' does not exist locally; only pushing branch."
fi

if [[ "$TAG_EXISTS" == true ]]; then
  PUSH_PROMPT="Push branch '$GIT_MAIN_BRANCH' and tag '$TAG_NAME' to origin?"
else
  PUSH_PROMPT="Push branch '$GIT_MAIN_BRANCH' to origin?"
fi

if confirm "$PUSH_PROMPT"; then
  git push origin "${PUSH_TARGETS[@]}"
else
  echo "Skipping git push."
fi

###
# 8. Create GitHub release via gh
###
echo
echo "=== Step 8: Create GitHub release ==="
echo "This will create a GitHub release for tag: $TAG_NAME"
echo "Notes will prepend install links and include GitHub-generated content."

INSTALL_LINKS_NOTES=$(
  cat <<EOF
## Install Links

### Production
https://login.salesforce.com/packaging/installPackage.apexp?p0=${NEW_PV_ID}

### Sandbox
https://test.salesforce.com/packaging/installPackage.apexp?p0=${NEW_PV_ID}
EOF
)

echo
echo "Release notes preamble:"
echo "----------------------------------------"
echo "$INSTALL_LINKS_NOTES"
echo "----------------------------------------"

if confirm "Create GitHub release '$TAG_NAME' using gh with generated notes and install links?"; then
  gh release create "$TAG_NAME" --generate-notes --notes "$INSTALL_LINKS_NOTES"
  echo "GitHub release '$TAG_NAME' created."
else
  echo "Skipping GitHub release creation."
fi

###
# 9. Merge release back into develop
###
echo
echo "=== Step 9: Merge release into develop ==="
if confirm "Merge the latest '$GIT_MAIN_BRANCH' into 'develop' now?"; then
  git checkout develop
  git pull origin develop
  git merge --no-edit "$GIT_MAIN_BRANCH"
  git push origin develop
  echo "Develop branch updated with latest release."
else
  echo "Skipping merge into develop."
fi

echo
echo "=== Release script completed ==="
echo "LAST_RELEASE_VERSION    = $LAST_RELEASE_VERSION"
echo "THIS_RELEASE_VERSION    = $THIS_RELEASE_VERSION"
echo "PROJECT_VERSION_NUMBER  = $PROJECT_VERSION_NUMBER"
echo "PROJECT_VERSION_NAME    = $PROJECT_VERSION_NAME"
echo "PACKAGE_VERSION_ID      = $NEW_PV_ID"
echo "TAG_NAME                = $TAG_NAME"
