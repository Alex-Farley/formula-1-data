#!/bin/sh
#
# What Cloudflare runs to build the site.
#
# It lives here rather than in the dashboard's build-command field so that it
# can be read, reviewed and changed in the repository like anything else. The
# dashboard holds one line:
#
#     sh tools/cloudflare-build.sh
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

# The Parquet bundle, served from this site's own domain rather than only
# from a GitHub release. It is staged into web/public/, which is how f1.db
# already reaches the deployed site, so vite copies it into dist like any
# other asset.
#
# WHY IT IS SERVED HERE AT ALL, when the release already carries one: this
# copy is built from the database this deploy just rebuilt, so it can never
# be older than the site beside it. A release is pinned to a tag and goes
# stale between them.
#
# NON-FATAL ON PURPOSE. pyarrow is the one thing in this script that reaches
# outside the repository, and a site that stops deploying because a download
# could not be built is a worse outcome than a missing download. `set -e` is
# suspended for the attempt and the failure is shouted rather than swallowed.
# "$PYTHON" -m pip, NEVER a bare `pip`. The whole point of the search above
# is that the python first on PATH is the WRONG one, so its pip installs
# pyarrow somewhere "$PYTHON" cannot see it - which is how the first attempt
# at this failed: the build went green, the warning scrolled past, and the
# site deployed without the download. Ask the chosen interpreter to install
# into itself.
#
# Errors are printed rather than suppressed. Non-fatal must not mean silent:
# a step allowed to fail is exactly the step whose reason has to reach the
# log, because nothing downstream will complain on its behalf.
# THE STEP REPORTS THROUGH THE SITE, because the build log is not always
# readable - this deployment has logging switched off, and a step that is
# allowed to fail without taking the site down is exactly the step whose
# reason nobody ever sees. So everything it learns goes into a file the site
# then serves, at /build-status.txt: which interpreter was chosen, whether
# that interpreter has pip, whether zip exists, and the error itself if there
# is one. A failure is then one fetch away from a diagnosis instead of
# invisible.
#
# It is written on success too. "The bundle built" is worth being able to
# check from outside, and a status file that only appears when things are
# broken is a status file nobody trusts.
echo "--- building the Parquet bundle"
# web/public/ IS GITIGNORED IN FULL, so a fresh clone does not have it -
# scripts/prepare-assets.js creates it, and that runs later, during
# `npm run build`. Writing into it before then works on a machine that has
# built before and fails on every clean checkout, which is exactly what a
# deployment is. That is what was wrong: the zip and the status file were
# both refused with "No such file or directory", the step was non-fatal, the
# log was unreadable, and the site quietly shipped without either.
mkdir -p web/public
rm -f web/public/f1-parquet.zip parquet-build.log
{
  echo "when     $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "python   $PYTHON"
  echo "version  $("$PYTHON" -c 'import sys; print(sys.version.split()[0])' 2>&1)"
  echo "pip      $("$PYTHON" -m pip --version 2>&1 | head -1)"
  echo "zip      $(command -v zip 2>/dev/null || echo 'NOT FOUND')"
  echo "---"
} > parquet-build.log 2>&1

if (set +e
    { "$PYTHON" -m pip install pyarrow \
        || "$PYTHON" -m pip install --user pyarrow; } >> parquet-build.log 2>&1 \
      && "$PYTHON" tools/parquet_export.py --out "$PWD/parquet" \
           >> parquet-build.log 2>&1 \
      && (cd parquet && zip -j -9 -q ../web/public/f1-parquet.zip ./*.parquet) \
           >> parquet-build.log 2>&1); then
  echo "--- Parquet bundle $(du -h web/public/f1-parquet.zip | cut -f1)"
  { echo "---"; echo "result   ok, $(du -h web/public/f1-parquet.zip | cut -f1)"; } \
    >> parquet-build.log
else
  echo "::warning::the Parquet bundle could not be built; deploying without it"
  rm -f web/public/f1-parquet.zip
  { echo "---"; echo "result   FAILED"; } >> parquet-build.log
fi
cp parquet-build.log web/public/build-status.txt

echo "--- building the front end"
cd web
npm ci
npm run build
