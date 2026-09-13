# The whole workflow. `make` rebuilds, checks and exports.
PYTHON ?= python3

# QUIET=1 is for a reader who will not go through the output line by line —
# an agent running this after every edit, or a log nobody opens unless it is
# red. verify.py prints only failures and warnings and a count of what
# passed; the unit tests print their summary rather than every name; the
# build, the audit, the export and the query tool's smoke output go to a
# file that is shown only if that step fails. Every step still runs and the
# exit codes are unchanged: `make ci QUIET=1` is the same gate as `make ci`,
# in about forty lines instead of thirteen hundred. CI stays verbose; its log
# is the record.
QUIET ?= 0
QUIET_LOG ?= $(or $(TMPDIR),/tmp)/lapledger-make-quiet.log
ifeq ($(QUIET),1)
VERIFY_FLAGS = --quiet
TEST_FLAGS =
# $(call run,<command>): print the command, run it against the log, and show
# the log only if it failed.
run = @printf '%s\n' '$(1)'; $(1) > "$(QUIET_LOG)" 2>&1 || { cat "$(QUIET_LOG)"; exit 1; }
else
VERIFY_FLAGS =
TEST_FLAGS = -v
run = $(1)
endif

.PHONY: all build readme verify audit export test lint clean check ci help

all: build readme verify export   ## rebuild, regenerate the README figures, check and export (default)

build:                            ## rebuild f1.db from data/*.py
	$(call run,$(PYTHON) build.py)

# Every number README.md states about the current database is a span the
# tool rewrites from f1.db. It runs before verify because verify checks the
# result: a data change that moves a count would otherwise fail on a README
# nobody had touched. CI does not run this - it runs verify, so a stale README
# fails there, which is the point.
readme:                           ## regenerate the figures README.md states from f1.db
	$(PYTHON) tools/readme_figures.py --write

verify:                           ## integrity and consistency checks on the data
	$(PYTHON) verify.py $(VERIFY_FLAGS)

test:                             ## unit tests for the code (not the data)
	$(PYTHON) -m unittest discover -s tests $(TEST_FLAGS)

# What ci.yml's lint job runs. None of the three is a dependency of the
# build; install them yourself: `pip install ruff` (or brew), `brew install
# actionlint`, and Biome comes down through npx. The rule sets, and every
# rule left out, are in ruff.toml and web/biome.jsonc with their reasons.
lint:                             ## Ruff, Biome and actionlint, as CI runs them
	ruff check
	cd web && npx -y @biomejs/biome@2.5.13 lint
	actionlint

audit:                            ## structural health report
	$(call run,$(PYTHON) audit.py)

export:                           ## regenerate the JSON exports
	$(call run,$(PYTHON) export_json.py --compat)

check: build readme verify test   ## build, README figures, verify, unit tests (not what CI runs - see ci)

# What ci.yml's Python job actually does, in its order, including the two
# things `check` and `all` each leave out: the redistribution gate on the
# COMMITTED database before the rebuild, and the comparison of the committed
# artefacts against the fresh build. `check` does not export, so it leaves
# f1_compat.json stale and CI fails; this does not.
ci:                               ## exactly what ci.yml's Python job runs (QUIET=1 for the short form)
	$(PYTHON) verify.py --redistribution-only $(VERIFY_FLAGS)
	$(call run,$(PYTHON) build.py)
	$(PYTHON) -m unittest discover -s tests $(TEST_FLAGS)
	$(PYTHON) verify.py $(VERIFY_FLAGS)
	$(call run,$(PYTHON) audit.py)
	$(call run,$(PYTHON) export_json.py --compat)
	@test -s f1_database.json || { echo "the full export was not written"; exit 1; }
	@git diff --quiet -- f1.db f1-geometry.db f1_compat.json README.md docs/COMMERCIAL-READINESS.md \
	  || { echo "the committed artefacts do not match a fresh build - stage or commit the rebuild (README.md's and docs/COMMERCIAL-READINESS.md's figures included):"; \
	       git diff --stat -- f1.db f1-geometry.db f1_compat.json README.md docs/COMMERCIAL-READINESS.md; exit 1; }
	$(call run,$(PYTHON) ./f1 champions 2020 2025)
	$(call run,$(PYTHON) ./f1 car mp4/4)
	$(call run,$(PYTHON) ./f1 circuit spa)
	$(call run,$(PYTHON) ./f1 gaps)
	@echo "ci: everything ci.yml's Python job runs passed on this interpreter, and the committed artefacts are current"

clean:                            ## remove built artefacts (not the sources)
	rm -f f1.db f1_database.json f1_compat.json *.db.tmp
	find . -name __pycache__ -type d -exec rm -rf {} + 2>/dev/null || true

help:
	@grep -E '^[a-z]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'
