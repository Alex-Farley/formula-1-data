#!/usr/bin/env bash
# Land what refresh.yml staged on main by pull request, never by push [D-45].
#
#   land-refresh.sh <subject> <body>
#
# Commits what the caller has STAGED, and nothing else.
#
# main requires four status checks with admins included, so a direct push
# from the workflow is refused (GH006) - it was, every morning from
# 2026-09-22, and Baku sat unpublished behind it. The refresh therefore
# commits onto one fixed branch, opens a pull request from it if none is
# open, and asks GitHub to merge it once the required checks pass. The
# checks are not skipped and nothing bypasses them: a refresh that CI
# refuses stays an open pull request, and the check date on main stops.
#
# GH_TOKEN must be the refresh App's token, not GITHUB_TOKEN: GitHub starts
# no workflow from a push or pull request made with GITHUB_TOKEN, so CI
# would never report and the merge would wait forever.
#
# The branch is rewritten from main on every run, so a pull request still
# open from yesterday is replaced by today's rather than stacked under it,
# and the repository deletes it on merge.
set -euo pipefail

subject=$1
body=$2
branch=refresh/f1db

git config user.name  "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git switch -C "$branch"
git commit -m "$subject" -m "$body"
git push --force origin "$branch"

if [ "$(gh pr list --head "$branch" --base main --state open --json number --jq length)" = 0 ]; then
  gh pr create --base main --head "$branch" --title "$subject" --body "$body"
else
  gh pr edit "$branch" --title "$subject" --body "$body"
fi
gh pr merge "$branch" --auto --merge
