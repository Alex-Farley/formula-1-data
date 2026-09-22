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

    def families(self):
        """The two families in .claude/agents/README.md, as {name: family}.
        Derived from the files on disk rather than trusting the prose to be
        complete: an agent the README forgets to mention is the whole point
        of the check, so it must be an error and not an absence. This is the
        circuit_geometry lesson (D-02) applied to a list of agents."""
        readme = read(".claude/agents/README.md")
        conformance = readme[readme.index("## Conformance reviewers"):readme.index("## Critics")]
        critics = readme[readme.index("## Critics"):readme.index("## Adding to either family")]
        out = {}
        for f in files_under(".claude/agents", (".md",)):
            name = os.path.basename(f)[:-3]
            if name == "README":
                continue
            where = [fam for fam, text in (("reviewer", conformance), ("critic", critics))
                     if name in text]
            self.assertEqual(len(where), 1,
                             f"{name} is in {len(where)} of README.md's two families, not exactly 1")
            out[name] = where[0]
        return out

    def test_every_agent_is_filed_in_exactly_one_family(self):
        # An agent nobody classified is one the next check cannot reason about.
        fams = self.families()
        self.assertTrue(fams, "no agents found")

    def test_every_loop_reviewer_is_a_conformance_reviewer(self):
        # Fail CLOSED. The earlier form of this asked only that no reviewer
        # appeared in the critics prose, which passed silently for an agent the
        # README had never been told about. Asking instead that every merge-path
        # reviewer IS filed as a conformance reviewer means an unclassified or
        # miscategorised one fails, which is the direction that matters: a
        # critic in the merge gate turns a sound change into fix-and-confirm
        # rounds (docs/DECISIONS.md D-31).
        fams = self.families()
        wrong = sorted(n for n in LOOP_REVIEWERS if fams.get(n) != "reviewer")
        self.assertEqual(wrong, [], f"the loop's reviewers are not all filed as conformance reviewers: {wrong}")

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


class OneRuleForWhatCountsAsAStart(unittest.TestCase):
    """data-integrity-reviewer, the one-vocabulary rule, across two languages.

    build.py's STARTED decides what counts as a start for the records tables;
    the STARTED constant in web/src/queries/driver.js decides it for the
    driver strip (PD-15), in the SQLite the browser runs, because the front
    end cannot import a Python constant. That is one rule written out twice,
    which is how the country vocabulary split, and the failure would be silent
    in the direction that matters: a code added to one list and not the other
    makes the driver page and the records page disagree about the same career,
    and neither says so.

    Both halves are checked, because both can drift. The CODES decide which
    results are not starts; the COALESCE decides what an absent result is,
    and dropping it would make a NULL position_text a non-start under SQL's
    three-valued logic instead of a start. position_text is NOT NULL on all
    27,504 rows today, so that one would break quietly."""

    RULE = re.compile(r"COALESCE\(e\.position_text,\s*''\)\s*NOT IN \(([^)]*)\)")

    def rule(self, text, what):
        m = self.RULE.search(text)
        self.assertIsNotNone(
            m, f"{what}: no `COALESCE(e.position_text, '') NOT IN (...)` - the COALESCE is "
               "part of the rule, not decoration: without it a NULL result is neither in "
               "nor not in the list, and the entry stops counting as a start")
        return frozenset(c.strip().strip("'\"") for c in m.group(1).split(",") if c.strip())

    def test_build_and_the_driver_strip_agree(self):
        build = re.search(r"^STARTED = \((.*?)\)$", read("build.py"), re.M | re.S)
        self.assertIsNotNone(build, "build.py has no STARTED constant")
        js = re.search(r"^const STARTED = (\".*\")$", read("web/src/queries/driver.js"), re.M)
        self.assertIsNotNone(js, "web/src/queries/driver.js has no STARTED constant; the rule "
                                 "belongs in one named place there, not written into a query")
        self.assertEqual(
            self.rule(build.group(1), "build.py STARTED"),
            self.rule(js.group(1), "queries/driver.js STARTED"),
            "build.py STARTED and the driver strip's STARTED count different result codes; "
            "a start is one thing on this site, and the records page and the driver page "
            "must not disagree about which entries were starts",
        )

    def test_the_driver_strip_uses_its_constant_and_writes_the_rule_nowhere_else(self):
        # Three questions in DERIVED need the rule; a fourth site written out
        # by hand is the drift this class exists to stop, and it would pass
        # the test above because that reads only the constant.
        js = read("web/src/queries/driver.js")
        # After the constant's own line: the declaration itself is the one
        # place the codes may appear.
        body = js[js.index("\n", js.index("const STARTED = ")):]
        self.assertEqual(
            body.count("NOT IN ("), 0,
            "queries/driver.js spells the start rule again after the STARTED constant; "
            "interpolate ${STARTED} instead",
        )
        self.assertGreaterEqual(
            body.count("${STARTED}"), 3,
            "queries/driver.js asks three questions that need the start rule - how many "
            "starts, how many have no grid recorded, how many have no lap count - so a "
            "constant used fewer times means one of them stopped using it",
        )


class TheVerdictContractIsWhereTheAgentReads(unittest.TestCase):
    """PM-41 (#428). The loop decides PASS or FAIL from the FIRST line of a
    reviewer's result, and four forks in two days met a confirmation agent
    that put a summary sentence above it. The contract was written only in
    the brief the fork composes (review-prompt.md), so a reviewer reading its
    own agent file found nothing about a verdict; and the confirmation half
    of that brief asked for "one line", which a line anywhere satisfies.
    Both are prose a tidying pass could drop again, so the wording lives here
    as a test (D-26, D-37) rather than in a checklist nobody re-reads."""

    PASS = "`PASS \u2014 safe to merge`"
    FAIL = "`FAIL \u2014 changes required`"

    def flat(self, rel):
        """The file with runs of whitespace collapsed: these documents wrap,
        and `FAIL \u2014 changes required` is written across a line break in
        more than one of them."""
        return re.sub(r"\s+", " ", read(rel))

    def states_the_contract(self, rel, text, what):
        # assertIn would print the whole document; these are thousands of
        # words each, so say what is missing and not where it isn't.
        for line in (self.PASS, self.FAIL):
            self.assertTrue(line in text, f"{what} does not give the verdict line {line}")
    # Distinctive enough that an unrelated sentence will not satisfy them, and
    # shared by all four files, so they double as the check that the four
    # copies still say the same thing. A deliberate rewording updates this
    # tuple; that is the declaration, and it is the point of the test.
    CONTRACT = ("nothing goes above it", "discarded and the review is run again")

    def test_every_loop_reviewer_states_the_first_line_contract(self):
        for name in LOOP_REVIEWERS:
            rel = f".claude/agents/{name}.md"
            text = self.flat(rel)
            self.states_the_contract(rel, text, f"{name}.md")
            for phrase in self.CONTRACT:
                self.assertTrue(phrase in text,
                                f"{name}.md names the verdict lines without the rule that "
                                f"puts one first: {phrase!r} is missing")

    def test_both_halves_of_the_brief_ask_for_the_verdict_first(self):
        # The first-pass brief always asked for it; the confirmation brief,
        # below the "after a fix" marker, is the half that drifted.
        brief = self.flat(".claude/skills/backlog-loop/review-prompt.md")
        marker = "after a fix"
        self.assertTrue(marker in brief, "review-prompt.md no longer has a confirmation brief")
        cut = brief.index(marker)
        # PM-48 (D-38) added a third brief below the confirmation one. Bound
        # the confirmation half at it: unbounded, the respawn brief's own
        # verdict strings would satisfy this check with the confirmation
        # brief gutted, which is the drift PM-41 found in the first place.
        respawn = "The respawn changes what is asked for"
        self.assertTrue(respawn in brief, "review-prompt.md no longer has a respawn brief (D-38)")
        cut2 = brief.index(respawn)
        self.assertTrue(cut < cut2, "the respawn brief must come after the confirmation brief")
        for what, half, wording in (("first-pass brief", brief[:cut], "verdict line first"),
                                    ("confirmation brief", brief[cut:cut2], "first line"),
                                    ("respawn brief", brief[cut2:], "nothing else")):
            self.states_the_contract("review-prompt.md", half, f"the {what}")
            self.assertTrue(wording in half,
                            f"the {what} does not ask for the verdict first ({wording!r})")
        self.assertTrue("nothing goes above it" in brief[cut:cut2],
                        "the confirmation brief no longer says what goes above the verdict "
                        "line, which is the half PM-41 found had drifted")
        # D-38's carve-out: without its `Applied:` line a quick-variant verdict
        # is no review (frontend-reviewer-quick.md), so the respawn brief has
        # to ask for it. Dropping it would make that respawn unsatisfiable.
        # "Applied: items" and not "Applied:": the prose above the template
        # mentions the line, so the looser string passes with the template
        # itself gutted — probed, 2026-09-22.
        self.assertTrue("Applied: items" in brief[cut2:],
                        "the respawn brief no longer asks frontend-reviewer-quick for its "
                        "`Applied:` line, so its respawn cannot satisfy the loop (D-38)")

    def test_the_item_procedure_refuses_rather_than_interprets(self):
        # The refusal is the rule; a fork left to judge an ambiguous result is
        # the state PM-41 found. "spawn the pass again" is the instruction that
        # makes the refusal actionable, so its absence is the regression.
        skill = self.flat(".claude/skills/backlog-item/SKILL.md")
        self.states_the_contract("SKILL.md", skill, "the item procedure")
        self.assertTrue("spawn the pass again" in skill,
                        "the item procedure names the verdict lines without saying what to do "
                        "when a result does not lead with one; a fork then interprets (D-37)")


class TheCitationStaysInStepWithTheBuild(unittest.TestCase):
    """CITATION.cff states a version, and GitHub renders a "Cite this
    repository" button from it. Nothing in the build reads that file back, so
    a VERSION bump that left it behind would publish a citation naming a
    version this repository does not build, and no check would notice — the
    failure mode the README's figure spans exist to stop. This is that check,
    plus the two ways the file can be present and still render no citation at
    all (SD-27).

    Two of these forbid a key rather than check one. CFF's `license` list is
    OR, not AND, so a list naming this repository's three licences would offer
    every part of it under any one of them, MIT included; a single id would be
    a licence position, and PD-41 (#481) has not taken it. A `date-released`
    has nothing in the tree to be checked against. Neither refusal is
    permanent — SD-32 (#557) is where the first is settled — and both say in
    the failure message what a person is being asked to decide.
    """

    def raw(self):
        return read("CITATION.cff")

    def keys(self):
        """The unindented keys of CITATION.cff.

        A hand parser rather than PyYAML, because the build is
        standard-library only and `make test` has to run on a clean clone.
        This returns the keys and not the values: the one value anything here
        asserts on is `version`, and it is read by its own anchored pattern
        below, so nothing rests on this guessing where a value ends. List
        entries and block-scalar continuations are indented, so the
        first-character rule skips them.
        """
        return {m.group(1) for line in self.raw().splitlines()
                if line and line[0] not in " #-"
                for m in [re.match(r"^([A-Za-z0-9-]+):", line)] if m}

    def block(self, key):
        """The lines indented under a top-level key, up to the next one."""
        out, inside = [], False
        for line in self.raw().splitlines():
            if re.match(rf"^{key}:\s*$", line):
                inside = True
            elif inside:
                if line and not line[0].isspace():
                    break
                out.append(line)
        return "\n".join(out)

    def build_constant(self, name):
        m = re.search(rf'^{name} = "([^"]+)"$', read("build.py"), re.M)
        self.assertIsNotNone(m, f"{name} is no longer a quoted literal in build.py, so "
                                "CITATION.cff cannot be checked against it")
        return m.group(1)

    def test_the_required_citation_keys_are_present(self):
        # cff-version, message, title and authors are CFF 1.2.0's required
        # keys: without one, GitHub renders no citation. `type` it defaults to
        # `software`, and this is a database, so it is required here for being
        # the difference between citing the build and citing the data.
        for key in ("cff-version", "message", "title", "authors", "type"):
            self.assertIn(key, self.keys(), f"CITATION.cff has no {key}")

    def test_at_least_one_author_is_named(self):
        # `authors: []`, and `authors:` with its entries deleted, both leave
        # the key present and render no citation at all — the one outcome this
        # file exists to prevent. So the entry is asserted, and inside the
        # authors block: searched loosely, an entry of any other block list
        # would stand in for an author that is not there.
        self.assertTrue(re.search(r"^authors:\s*$", self.raw(), re.M),
                        "CITATION.cff's authors is not a block list, so the entries below "
                        "it cannot be checked")
        self.assertTrue(re.search(r"^\s+-\s*(family-names|name):\s*\S", self.block("authors"), re.M),
                        "CITATION.cff names no author; GitHub renders no citation from an "
                        "empty author list, and the file is then present and useless")

    def version(self):
        """CITATION.cff's version, as YAML reads it, or None.

        Anchored on the quotes because an unquoted 2.40 is the float 2.4 to
        YAML — and so to GitHub and cffconvert — while a line-based read of it
        is the string "2.40". A trailing comment is YAML and is allowed.
        """
        m = re.search(r'^version:\s*"([^"]*)"\s*(?:#.*)?$', self.raw(), re.M)
        return m.group(1) if m else None

    def test_the_version_is_a_quoted_string(self):
        self.assertIsNotNone(self.version(),
                             "CITATION.cff's version is missing or is not a quoted string; "
                             'YAML reads an unquoted 2.40 as 2.4, so the citation would '
                             "name a version that does not exist")

    def test_the_version_is_the_version_the_build_publishes(self):
        self.assertEqual(self.version(), self.build_constant("VERSION"),
                         "CITATION.cff's version and VERSION in build.py disagree, so the "
                         "citation GitHub offers names a version this repository does not "
                         "build")

    def test_the_citation_states_no_licence(self):
        # At any indent, so a licence stated inside preferred-citation or a
        # references entry is caught too, and `license-url` with it: naming a
        # licence by its URL is the same position stated the same way.
        m = re.search(r"^\s*(license(-url)?):", self.raw(), re.M)
        self.assertIsNone(m, "CITATION.cff states a licence. CFF's licence list is OR, not "
                             "AND, so naming this repository's three offers every part of "
                             "it under any one of them, MIT included — rights this project "
                             "does not hold. Naming one instead is a licence position, and "
                             "PD-41 (#481) has not taken it. SD-32 (#557) is where that is "
                             "settled; until then the terms live in LICENSE, LICENSE-DATA "
                             "and ATTRIBUTION.md")

    def test_no_release_date_is_claimed(self):
        # BUILT moves on a harvest refresh and VERSION only on a release, so a
        # date-released bound to BUILT would eventually date v2.24 to a day on
        # which no v2.24 was released; nothing in the tree records when a tag
        # was published, so no date here can be checked.
        self.assertNotIn("date-released", self.keys(),
                         "CITATION.cff claims a release date. BUILT is a build date and "
                         "moves without VERSION, and no in-tree record says when a tag was "
                         "published, so this date cannot be checked and will misdate a "
                         "version sooner or later")
