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

echo "--- building the front end"
cd web
npm ci
npm run build
