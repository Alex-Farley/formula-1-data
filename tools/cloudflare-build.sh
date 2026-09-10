#!/bin/sh
#
# What Cloudflare is configured to run to build the site.
#
# It lives here rather than in the dashboard's build-command field so that it
# can be read, reviewed and changed in the repository like anything else. The
# dashboard's build-command field reads:
#
#     sh tools/cloudflare-build.sh
#
# WHETHER IT ACTUALLY RUNS IS, AS OF THIS WRITING, UNSETTLED. A build log of
# 10 September 2026 announced "Executing user build command: cd web && npm ci
# && npm run build" - a string that appears nowhere in this file, which runs
# those three as separate lines - and none of the echoes below reached that
# log. So the dashboard field and the build log disagree. See F1_DEPLOY_SCRIPT
# at the foot of this file: it makes the deployed site answer the question
# instead of leaving it to be read out of a log.
#
# WHY THE DATABASE IS REBUILT
#     f1.db is committed, so the site would build without this. But the point
#     of this project is that every figure can be traced, and verify.py is what
#     enforces that. Rebuilding from data/*.py and then verifying means a
#     deployed site can never carry a database that failed its own checks:
#     verify.py exits non-zero, `set -e` stops here, and Cloudflare keeps
#     serving the previous deployment rather than publishing a bad one.
#
#     It costs a few seconds. build.py, verify.py and everything else at the
#     repository root use only the standard library.
#
# Run it from the repository root; Cloudflare does, because the build root is
# the repository root (which is also where wrangler.jsonc has to be found).
set -e

# ---------------------------------------------------------------- python
#
# Not just "python3". Cloudflare's build image puts an asdf-managed Python
# first on PATH, and that one is compiled WITHOUT the sqlite3 extension:
#
#     File ".../python3.13/sqlite3/dbapi2.py", line 27, in <module>
#         from _sqlite3 import *
#     ModuleNotFoundError: No module named '_sqlite3'
#
# which is fatal here, because the database is a SQLite file. The system
# Python beside it is a distribution build and has the module. So the test is
# not "is there a python3" but "is there a python3 that can open a database" —
# ask each candidate directly rather than inferring it from a version number.
for candidate in python3 /usr/bin/python3 python3.13 python3.12 python3.11 python; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sqlite3' >/dev/null 2>&1; then
    PYTHON=$(command -v "$candidate")
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "No python3 with the sqlite3 module on this build image." >&2
  echo "Every candidate either was missing or could not 'import sqlite3'," >&2
  echo "which a database build cannot do without. Either install one, or" >&2
  echo "drop the two build/verify lines below to deploy the committed f1.db" >&2
  echo "unverified." >&2
  exit 1
fi

echo "--- python $("$PYTHON" -c 'import sys; print(".".join(map(str, sys.version_info[:3])))') at $PYTHON"

echo "--- rebuilding the database from data/*.py"
"$PYTHON" build.py

echo "--- verifying it"
"$PYTHON" verify.py

# SITE_ORIGIN is what scripts/prerender.js stamps into every canonical link,
# og:url and sitemap entry. The site is served from lapledger.org, so that is
# the default here rather than in a dashboard field: the canonical host is a
# fact about this project and belongs where it can be read and reviewed, like
# the build command around it.
#
# CF_PAGES_URL USED TO SIT IN THIS CHAIN AND NO LONGER DOES. It is a Pages
# variable and this is a Worker, so it was never set - the build fell through
# to a .pages.dev literal, and every canonical tag on the live domain pointed
# at a host that is not this one. Worse, where it IS set it names the
# deployment's own URL, which makes a preview self-canonicalise: previews are
# publicly reachable, so each one would invite indexing as a rival copy of all
# 2,385 pages. A preview should say the production page is the real one.
#
# Override it deliberately if you ever need to (SITE_ORIGIN=... sh
# tools/cloudflare-build.sh); nothing infers it any more.
export SITE_ORIGIN="${SITE_ORIGIN:-https://lapledger.org}"
echo "--- canonical origin $SITE_ORIGIN"

# THE PARQUET BUNDLE IS NOT BUILT HERE. It is built by
# web/scripts/parquet-bundle.mjs, inside the npm build below.
#
# It was written here first, three times, and three times nothing appeared on
# the deployed site - because the build that ran had never read this file.
# Putting the step in the npm chain removed the dependency on which chain
# Cloudflare invokes: `npm run build` runs either way, from here or directly.
# That is the only reason it lives there rather than beside the rebuild it
# logically belongs to, and it should stay there whatever F1_DEPLOY_SCRIPT
# eventually reveals.

# Whether this file ran at all is not a question the deployed site should
# leave to inference. The dashboard's build-command field has disagreed with
# the build log once already, and reading the difference out of eight seconds
# of npm output is exactly the kind of guess that cost three deploys here.
#
# scripts/parquet-bundle.mjs writes public/build-status.txt on every deploy
# and reports this variable on a line of its own, so /build-status.txt says
# outright which chain ran - and therefore whether the database served beside
# it was rebuilt and re-verified here, or taken as committed.
export F1_DEPLOY_SCRIPT="tools/cloudflare-build.sh"

echo "--- building the front end"
cd web
npm ci
npm run build
