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


AGENT_KEYS = {
    # .claude/agents/*.md, as Claude Code documents them (code.claude.com/docs/en/sub-agents)
    "name", "description", "tools", "disallowedTools", "model", "permissionMode", "maxTurns",
    "skills", "mcpServers", "hooks", "memory", "background", "effort", "isolation", "color",
    "initialPrompt", "experimental",
}
SKILL_KEYS = {
    # .claude/skills/*/SKILL.md (code.claude.com/docs/en/skills)
    "name", "description", "when_to_use", "argument-hint", "arguments", "disable-model-invocation",
    "user-invocable", "allowed-tools", "disallowed-tools", "model", "effort", "context", "agent",
    "background", "hooks", "paths", "shell", "metadata", "license", "compatibility",
}
MODELS = {"opus", "sonnet", "haiku", "fable", "inherit"}
EFFORTS = {"low", "medium", "high", "xhigh", "max"}
# The reviewers the backlog loop launches. Each carries a turn cap so a
# reviewer that loses its way returns rather than runs until the session
# limit ends it; .claude/skills/backlog-item/SKILL.md says a return without
# a verdict line is not a PASS.
LOOP_REVIEWERS = ("frontend-reviewer", "frontend-reviewer-quick", "data-integrity-reviewer", "licence-reviewer")


def frontmatter(rel):
    """The leading --- block as {key: value}, values as the strings written.
    Deliberately not YAML: the build has no dependencies, and the keys these
    files use are all `key: scalar`."""
    text = read(rel)
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if not m:
        return None
    out = {}
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, sep, value = line.partition(":")
        if not sep or key != key.strip() or " " in key.strip():
            return {"__malformed__": line}
        out[key] = value.strip().strip("\"'")
    return out


class AgentAndSkillFrontmatterIsWellFormed(unittest.TestCase):
    """A misspelt key in an agent's frontmatter is ignored silently: `effort:`
    written as `efort:` leaves the reviewer at the default and nothing says
    so. These are the settings the backlog loop's cost decisions rest on
    (PM-33, PM-35, PM-36), so a typo here is a cost regression nobody sees."""

    def agents(self):
        return files_under(".claude/agents", (".md",))

    def skills(self):
        return [f for f in files_under(".claude/skills", (".md",)) if f.endswith("/SKILL.md")]

    def check(self, rel, allowed):
        fm = frontmatter(rel)
        self.assertIsNotNone(fm, f"{rel} has no --- frontmatter block")
        self.assertNotIn("__malformed__", fm, f"{rel}: frontmatter line is not `key: value`: {fm.get('__malformed__')}")
        unknown = sorted(set(fm) - allowed)
        self.assertEqual(unknown, [], f"{rel} uses frontmatter keys Claude Code does not document: {unknown}")
        for key in ("name", "description"):
            self.assertTrue(fm.get(key), f"{rel} has no {key}")
        if "model" in fm:
            self.assertTrue(fm["model"] in MODELS or fm["model"].startswith("claude-"),
                            f"{rel}: model {fm['model']!r} is not an alias or a full model id")
        if "effort" in fm:
            self.assertIn(fm["effort"], EFFORTS, f"{rel}: effort {fm['effort']!r}")
        if "maxTurns" in fm:
            self.assertTrue(fm["maxTurns"].isdigit() and int(fm["maxTurns"]) > 0, f"{rel}: maxTurns {fm['maxTurns']!r}")
        if "context" in fm:
            self.assertEqual(fm["context"], "fork", f"{rel}: context {fm['context']!r}")
        return fm

    def test_every_agent_parses_and_is_named_for_its_file(self):
        for rel in self.agents():
            if rel.endswith("README.md"):
                continue
            fm = self.check(rel, AGENT_KEYS)
            stem = os.path.basename(rel)[:-3]
            self.assertEqual(fm["name"], stem, f"{rel}: name {fm['name']!r} is not the file name")

    def test_every_skill_parses_and_is_named_for_its_folder(self):
        for rel in self.skills():
            fm = self.check(rel, SKILL_KEYS)
            folder = os.path.basename(os.path.dirname(rel))
            self.assertEqual(fm["name"], folder, f"{rel}: name {fm['name']!r} is not the folder name")

    def test_no_loop_reviewer_is_a_critic(self):
        # The two families in .claude/agents/README.md have opposite postures:
        # a conformance reviewer enforces rules on a diff, a critic assesses
        # the whole project and exists to find things. A critic in the merge
        # path turns a sound change into fix-and-confirm rounds - AF-16 spent
        # five agent launches on one item that way (docs/DECISIONS.md D-31).
        readme = read(".claude/agents/README.md")
        critics = readme[readme.index("## Critics"):readme.index("## Adding to either family")]
        named = {os.path.basename(f)[:-3] for f in files_under(".claude/agents", (".md",))
                 if os.path.basename(f)[:-3] in critics}
        self.assertTrue(named, "README.md lists no critics; has the section moved?")
        overlap = sorted(set(LOOP_REVIEWERS) & named)
        self.assertEqual(overlap, [], f"the loop's reviewers name a critic: {overlap}")

    def test_the_loop_reviewers_carry_a_turn_cap_and_an_effort(self):
        for name in LOOP_REVIEWERS:
            fm = frontmatter(f".claude/agents/{name}.md")
            self.assertIsNotNone(fm, f"{name} is named by the loop and does not exist")
            self.assertIn("maxTurns", fm, f"{name}: the loop's reviewers carry maxTurns")
            self.assertIn("effort", fm, f"{name}: the loop's reviewers carry effort")

    def test_the_queue_is_issues_and_nothing_in_the_tree(self):
        # The queue moved from docs/BACKLOG.md to GitHub Issues on 2026-09-13
        # (PM-37, and the maintainer's decision the same day). A backlog file
        # reappearing, or the rules and the loop's skills naming one, is a
        # second queue, which the rules forbid. docs/LANDED.md is the archive
        # and the scripts' docstrings may say where the queue used to be.
        self.assertFalse(os.path.exists(os.path.join(ROOT, "docs/BACKLOG.md")), "docs/BACKLOG.md is back: the queue is GitHub Issues")
        for rel in ["CLAUDE.md", ".claude/skills/backlog-loop/precheck.sh"] + self.skills():
            self.assertNotIn("BACKLOG.md", read(rel), f"{rel} names a backlog file; the queue is GitHub Issues")

    def test_no_command_shadows_a_skill(self):
        # Skills win over a command of the same name, so the command is dead
        # text that still reads as if it ran; /backlog-loop had one until PM-36.
        skills = {os.path.basename(os.path.dirname(f)) for f in self.skills()}
        commands = {os.path.basename(f)[:-3] for f in files_under(".claude/commands", (".md",))}
        self.assertEqual(sorted(skills & commands), [], "a .claude/commands file shadows a skill of the same name")
