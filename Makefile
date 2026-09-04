# The whole workflow. `make` rebuilds, checks and exports.
PYTHON ?= python3

.PHONY: all build verify audit export clean check help

all: build verify export          ## rebuild, check and export (default)

build:                            ## rebuild f1.db from data/*.py
	$(PYTHON) build.py

verify:                           ## 121 integrity and consistency checks
	$(PYTHON) verify.py

audit:                            ## structural health report
	$(PYTHON) audit.py

export:                           ## regenerate the JSON exports
	$(PYTHON) export_json.py --compat

check: build verify               ## what CI runs

clean:                            ## remove built artefacts (not the sources)
	rm -f f1.db f1_database.json f1_compat.json
	find . -name __pycache__ -type d -exec rm -rf {} + 2>/dev/null || true

help:
	@grep -E '^[a-z]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'
