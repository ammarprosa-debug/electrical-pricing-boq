#!/bin/bash
# Post-commit hook: auto-syncs every commit to GitHub
# Reads GITHUB_TOKEN and GITHUB_REPO_URL from environment

if [ -z "$GITHUB_TOKEN" ]; then
  echo "[github-sync] Skipping: GITHUB_TOKEN is not set" >&2
  exit 0
fi

if [ -z "$GITHUB_REPO_URL" ]; then
  echo "[github-sync] Skipping: GITHUB_REPO_URL is not set" >&2
  exit 0
fi

# Strip any existing credentials from the URL and inject the token
CLEAN_URL=$(echo "$GITHUB_REPO_URL" | sed 's|https://[^@]*@|https://|')
AUTH_URL=$(echo "$CLEAN_URL" | sed "s|https://|https://x-access-token:${GITHUB_TOKEN}@|")

# Ensure the github remote is set to the authenticated URL
if git remote get-url github &>/dev/null; then
  git remote set-url github "$AUTH_URL"
else
  git remote add github "$AUTH_URL"
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

echo "[github-sync] Pushing branch '$BRANCH' to GitHub..."
if git push github "$BRANCH" --quiet 2>&1; then
  echo "[github-sync] Successfully pushed to GitHub."
else
  echo "[github-sync] Push failed. Check GITHUB_TOKEN permissions and GITHUB_REPO_URL." >&2
fi
