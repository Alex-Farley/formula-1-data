"""Conventions that used to be checked by reading, checked by grep.

Every test here is a rule from CLAUDE.md or from a reviewer checklist in
.claude/agents/ that a pattern can decide: a constant that must stay a
constant, an environment variable that must never reach a workflow, a
column list that must be derived, a release that must ship two files. They
used to cost a reviewer pass to confirm — 40,000 to 130,000 tokens, by the
backlog loop's own measure — and were confirmed by reading, which is how a
stale rule survives. Here each costs nothing, runs in `make test` and in
CI's `check` job, and the reviewer agents' checklists say which of their
items this file has taken so a review spends its attention on judgement.

A rule with a declared exception lists it here with the reason, the way
verify.py declares its deviations: a new site fails until it is declared.
The front end's equivalents are in web/test/conventions.mjs, where the
front-end tools run them.
"""
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


HASH_COMMENTED = (".py", ".yml", ".yaml", ".sh", "Makefile", "f1")


def code(text, path=""):
    """The text with # comments removed, line by line, for the languages where
    # is a comment. Crude — a # inside a string goes too. Used only where a
    rule wants to ignore what a comment says (a comment may name the thing
    it forbids); a JavaScript or JSON file is returned whole, because there
    # is not a comment and stripping would hide an occurrence."""
    if path and not path.endswith(HASH_COMMENTED):
        return text
    return "\n".join(re.sub(r"(^|\s)#.*$", "", line) for line in text.splitlines())


def files_under(rel, suffixes):
    out = []
    for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, rel)):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules", "dist", "__pycache__", ".git", ".f1dbcache", "venv", ".venv")]
        for name in filenames:
            if name.endswith(suffixes):
                out.append(os.path.relpath(os.path.join(dirpath, name), ROOT))
    return sorted(out)


class TheBuildIsReproducible(unittest.TestCase):
    """data-integrity-reviewer, item 2."""

    def test_built_is_a_literal_date(self):
        m = re.search(r'^BUILT = "(\d{4}-\d{2}-\d{2})"$', read("build.py"), re.M)
        self.assertIsNotNone(m, "BUILT in build.py must be a quoted YYYY-MM-DD literal; "
                                "the database is a pure function of its sources, and CI "
                                "compares the committed artefact against a fresh build")

    def test_build_reads_no_clock(self):
        src = code(read("build.py"), "build.py")
        for call in ("date.today(", "datetime.now(", "datetime.utcnow(", "time.time("):
            self.assertNotIn(call, src, f"build.py calls {call}) — a rebuild would differ from the "
                                        "committed database for no change in the sources")


class TheLocalTimingSwitchNeverReachesCI(unittest.TestCase):
    """licence-reviewer, item 4. F1_LOCAL_TIMING=1 downgrades the FOM-owned
    checks to warnings for local work with the timing loaders. A workflow,
    a make target or a build script that set it would publish a database
    this project has no right to publish. verify.py reads it, and the
    documentation explains it; nothing else may name it."""

    def test_no_workflow_script_or_target_names_it(self):
        scanned = (files_under(".github", (".yml", ".yaml", ".sh"))
                   + files_under("tools", (".py", ".sh"))
                   + files_under("web/scripts", (".js", ".mjs", ".sh"))
                   + files_under(".claude/skills", (".sh", ".py"))
                   + ["Makefile", "build.py", "export_json.py", "audit.py", "f1",
                      # The npm chain is the deploy's only executed steps, and
                      # wrangler.jsonc is what Cloudflare reads.
                      "web/package.json", "wrangler.jsonc"])
        # A committed environment file anywhere, which item 4 names.
        scanned += [f for f in files_under(".", ("",)) if os.path.basename(f).startswith(".env")]
        offenders = [f for f in sorted(set(scanned)) if "F1_LOCAL_TIMING" in code(read(f), f)]
        self.assertEqual(offenders, [], "F1_LOCAL_TIMING appears in code that runs in CI or a "
                                        "build: it belongs in verify.py and the docs only")


class GeometryColumnsAreDerived(unittest.TestCase):
    """data-integrity-reviewer, item 4. Three places once wrote out twelve
    columns of circuit_geometry; main added three more and every copy would
    have dropped them. Anything that copies, exports or moves those rows takes
    its column list from PRAGMA table_info, so an INSERT names its columns
    through an interpolated variable, never as a literal list.

    Declared exceptions: schema.sql (CREATE TABLE is the definition) and ONE
    site in build.py, the loader stage that writes the table from the harvest
    rows and is the place the column list originates. build.py is scanned
    like everything else; a second literal list there fails."""

    # file -> the number of literal column lists it is allowed to carry
    DECLARED = {"build.py": 1}

    def test_no_literal_column_list_outside_the_loader(self):
        scanned = (files_under("tools", (".py",)) + files_under("web", (".js", ".mjs", ".jsx"))
                   + ["build.py", "export_json.py", "verify.py", "audit.py", "f1"])
        # `\s*` spans a newline, so a list that opens on the next line is
        # matched too; the match is run over the whole file, not per line.
        literal = re.compile(r"circuit_geometry\s*\(\s*[A-Za-z_]")
        offenders = []
        for f in scanned:
            text = read(f)
            hits = [m for m in literal.finditer(text)
                    if "load_circuit_geometry" not in text[m.start():m.end() + 24]]
            allowed = self.DECLARED.get(f, 0)
            if len(hits) > allowed:
                where = ", ".join(str(text.count("\n", 0, m.start()) + 1) for m in hits)
                offenders.append(f"{f}: {len(hits)} literal column list(s) at line(s) {where}, {allowed} declared")
        self.assertEqual(offenders, [], "a literal column list against circuit_geometry; derive it "
                                        "from PRAGMA table_info the way tools/geometry_overlay.py does")


class PublishingPathsCarryBothDatabases(unittest.TestCase):
    """licence-reviewer, item 6. f1.db carries no OpenStreetMap data; the
    centrelines ship as f1-geometry.db beside it. A publishing path that
    dropped the second file would ship zero centrelines with no way to get
    them — which a release workflow written before the ODbL split once nearly
    did (v2.17 exists because of it)."""

    def test_release_uploads_and_digests_both(self):
        yml = read(".github/workflows/release.yml")
        files = re.search(r"files: \|\n((?:\s+\S.*\n)+)", yml)
        self.assertIsNotNone(files, "release.yml has no `files: |` upload list")
        uploaded = files.group(1).split()
        for name in ("f1.db", "f1-geometry.db", "SHA256SUMS"):
            self.assertIn(name, uploaded, f"release.yml does not upload {name}")
        digest = re.search(r"sha256sum ([^>]+)> SHA256SUMS", yml, re.S)
        self.assertIsNotNone(digest, "release.yml does not write SHA256SUMS")
        for name in ("f1.db", "f1-geometry.db"):
            self.assertIn(name, digest.group(1).split(), f"SHA256SUMS does not digest {name}")

    def test_site_stages_both(self):
        staging = read("web/scripts/prepare-assets.js")
        for name in ("f1.db", "f1-geometry.db"):
            self.assertIn(name, staging, f"prepare-assets.js does not stage {name}; the browser "
                                         "merges the overlay at runtime and needs the file")


class WorkflowsDeclareTheirPermissions(unittest.TestCase):
    """ci.yml records why: a workflow that does not declare `permissions`
    takes the repository default, which on a read-and-write default hands a
    write-capable token to a build that has no use for one."""

    def test_every_workflow_has_a_top_level_permissions_block(self):
        missing = [f for f in files_under(".github/workflows", (".yml", ".yaml"))
                   if not re.search(r"^permissions:", read(f), re.M)]
        self.assertEqual(missing, [], "workflows without a top-level permissions: block")


if __name__ == "__main__":
    unittest.main()
