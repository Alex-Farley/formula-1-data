# The whole workflow. `make` rebuilds, checks and exports.
PYTHON ?= python3

.PHONY: all build verify audit export test clean check ci help

all: build verify export          ## rebuild, check and export (default)

build:                            ## rebuild f1.db from data/*.py
	$(PYTHON) build.py

verify:                           ## integrity and consistency checks on the data
	$(PYTHON) verify.py

test:                             ## unit tests for the code (not the data)
	$(PYTHON) -m unittest discover -s tests -v

audit:                            ## structural health report
	$(PYTHON) audit.py

export:                           ## regenerate the JSON exports
	$(PYTHON) export_json.py --compat

check: build verify test          ## build, verify, unit tests (not what CI runs - see ci)

# What ci.yml's Python job actually does, in its order, including the two
# things `check` and `all` each leave out: the redistribution gate on the
# COMMITTED database before the rebuild, and the comparison of the committed
# artefacts against the fresh build. `check` does not export, so it leaves
# f1_compat.json stale and CI fails; this does not.
ci:                               ## exactly what ci.yml's Python job runs
	$(PYTHON) verify.py --redistribution-only
	$(PYTHON) build.py
	$(PYTHON) -m unittest discover -s tests
	$(PYTHON) verify.py
	$(PYTHON) audit.py
	$(PYTHON) export_json.py --compat
	@git diff --quiet -- f1.db f1-geometry.db f1_compat.json \
	  || { echo "the committed artefacts do not match a fresh build:"; \
	       git diff --stat -- f1.db f1-geometry.db f1_compat.json; exit 1; }
	./f1 champions 2020 2025 > /dev/null
	./f1 car mp4/4 > /dev/null
	./f1 circuit spa > /dev/null
	./f1 gaps > /dev/null
	@echo "ci: everything ci.yml's Python job runs passed, and the committed artefacts are current"

clean:                            ## remove built artefacts (not the sources)
	rm -f f1.db f1_database.json f1_compat.json *.db.tmp
	find . -name __pycache__ -type d -exec rm -rf {} + 2>/dev/null || true

help:
	@grep -E '^[a-z]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'
