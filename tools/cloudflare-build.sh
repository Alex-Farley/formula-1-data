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

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found on the build image." >&2
  echo "Set PYTHON_VERSION in the Cloudflare build environment, or drop the" >&2
  echo "two python3 lines below to build without verifying the database." >&2
  exit 1
fi

echo "--- python $(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:3])))')"

echo "--- rebuilding the database from data/*.py"
python3 build.py

echo "--- verifying it"
python3 verify.py

echo "--- building the front end"
cd web
npm ci
npm run build
