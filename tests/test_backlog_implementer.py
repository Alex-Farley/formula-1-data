"""Which model implements an item under the Sonnet trial, and the two guards
that keep a protected path on Opus (AF-144, D-60).

WHY THIS FILE EXISTS
    The trial's rule decides, with nobody watching, which items Sonnet
    implements. The maintainer agreed it on the condition that data and
    publishing paths stay on Opus whatever their size, so the cases here are
    first that a protected path is found wherever an item names it or a diff
    changes it, and then that each rule of `choose()` keeps an item on Opus
    for the reason it gives - the ten-item stop included, which is what keeps
    the trial from running on unmeasured.
"""
import contextlib
import importlib.util
import io
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOOP = os.path.join(ROOT, ".claude", "skills", "backlog-loop")
spec = importlib.util.spec_from_file_location("backlog_implementer", os.path.join(LOOP, "implementer.py"))
imp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imp)
PRECHECK = os.path.join(LOOP, "precheck.sh")
WRAPPER = os.path.join(ROOT, ".claude", "skills", "backlog-item-sonnet", "SKILL.md")


def row(size="S", body="**Where:** web/src/pages/Glossary.jsx", *labels, ident="AF-01"):
    return dict(ident=ident, title=f"{ident}: a change", body=body,
                labels=sorted([f"size: {size}", *labels]) if size else sorted(labels))


class ProtectedPaths(unittest.TestCase):
    def test_each_protected_path_is_found_where_a_body_names_it(self):
        for text, want in (
            ("**Where:** data/current.py", "data/"),
            ("the rows in `harvest/race_images.txt`", "harvest/"),
            ("tools/readme_figures.py --write", "tools/"),
            ("a floor in verify.py", "verify.py"),
            ("build.py's final stage", "build.py"),
            ("schema.sql", "schema.sql"),
            ("export_json.py --compat", "export_json.py"),
            ("web/scripts/prepare-assets.js", "prepare-assets.js"),
            ("web/scripts/prerender.js", "prerender.js"),
            ("the step in release.yml", "release.yml"),
            ("(.github/workflows/ci.yml)", ".github/"),
            ("LICENSE-DATA says", "LICENSE-DATA"),
            ("ATTRIBUTION.md's table", "ATTRIBUTION.md"),
            ("web/package.json", "package.json"),
            ("https://github.com/o/r/blob/main/data/drivers.py", "data/"),
            ("see [data/x.py](https://example.invalid)", "data/"),
            ("**tools/** is where", "tools/"),
            ("the rows in f1.db", "f1.db"),
            ("f1_compat.json goes stale", "f1_compat.json"),
            ("a check in precheck.sh", "precheck.sh"),
            ("(.github/dependabot.yml)", ".github/"),
            ("<code>harvest/x.txt</code>", "harvest/"),
            ("paths: tools/a.py,data/b.py", "data/"),
            ("the rule in .claude/agents/frontend-reviewer.md", ".claude/agents/"),
        ):
            self.assertIn(want, imp.protected_in_text(text), text)

    def test_a_front_end_body_names_none(self):
        for text in ("**Where:** web/src/pages/Glossary.jsx, web/src/queries/glossary.js",
                     "web/src/data/ holds the query modules",   # not the top-level data/
                     "the licence wording on /about",            # the word, not the file
                     "metadata/ and verify_py are not paths here"):
            self.assertEqual(imp.protected_in_text(text), [], text)

    def test_a_diff_is_read_by_file(self):
        self.assertEqual(imp.protected_files([
            "data/current.py", "web/src/data/drivers.js", "verify.py", "web/scripts/prerender.js",
            ".github/workflows/ci.yml", ".github/CODEOWNERS", "LICENSE-DATA", "web/package-lock.json",
            "f1.db", ".claude/skills/backlog-loop/precheck.sh", ".claude/skills/backlog-item-sonnet/SKILL.md",
            "docs/DECISIONS.md", ".claude/skills/backlog-loop/file.py", ".claude/agents/licence-reviewer.md",
            ".claude/skills/backlog-item/land.md", ""]),
            ["data/current.py", "verify.py", "web/scripts/prerender.js", ".github/workflows/ci.yml",
             ".github/CODEOWNERS", "LICENSE-DATA", "web/package-lock.json", "f1.db",
             ".claude/skills/backlog-loop/precheck.sh", ".claude/skills/backlog-item-sonnet/SKILL.md",
             ".claude/agents/licence-reviewer.md", ".claude/skills/backlog-item/land.md"])

    def test_the_script_exits_one_on_a_protected_diff_and_zero_otherwise(self):
        script = os.path.join(LOOP, "implementer.py")
        hit = subprocess.run([sys.executable, script], input="web/src/App.jsx\ntools/x.py\n",
                             capture_output=True, text=True, check=False)
        self.assertEqual((hit.returncode, hit.stdout), (1, "tools/x.py\n"))
        clean = subprocess.run([sys.executable, script], input="web/src/App.jsx\n",
                               capture_output=True, text=True, check=False)
        self.assertEqual((clean.returncode, clean.stdout), (0, ""))


class Choose(unittest.TestCase):
    def counted(self, n):
        calls = []

        def count():
            calls.append(1)
            return n
        return count, calls

    def test_a_small_unprotected_head_goes_to_sonnet(self):
        count, calls = self.counted(3)
        word, why = imp.choose(row("XS"), False, count)
        self.assertEqual(word, "sonnet", why)
        self.assertEqual(len(calls), 1)
        self.assertEqual(imp.choose(row("S"), False, count)[0], "sonnet")

    def test_each_rule_keeps_an_item_on_opus_without_reading_the_count(self):
        cases = (
            ("open work", None, True),
            ("no head", None, False),
            ("size M", row("M"), False),
            ("size L", row("L"), False),
            ("unsized", row(None), False),
            ("an alarm", row("S", "x", "refresh-failing"), False),
            ("results late", row("S", "x", "results-late"), False),
            ("a security alert", row("S", "x", "source: security"), False),
            ("live data", row("S", "x", "source: live data"), False),
            ("a Wikipedia survey", row("S", "x", "source: Wikipedia survey"), False),
            ("the project record", row("S", "x", "source: project record"), False),
            ("a protected path", row("S", "**Where:** data/current.py"), False),
        )
        for what, head, open_work in cases:
            count, calls = self.counted(0)
            word, why = imp.choose(head, open_work, count)
            self.assertEqual(word, "opus", what)
            self.assertEqual(calls, [], f"{what}: the count is a GitHub read and was not needed")
        # Open work wins even over a head that would otherwise qualify.
        self.assertEqual(imp.choose(row("XS"), True, lambda: 0)[0], "opus")

    def test_the_trial_stops_itself_at_ten(self):
        self.assertEqual(imp.choose(row("S"), False, lambda: imp.TRIAL_ITEMS - 1)[0], "sonnet")
        word, why = imp.choose(row("S"), False, lambda: imp.TRIAL_ITEMS)
        self.assertEqual(word, "opus")
        self.assertIn("measured", why)


class TheSonnetSkill(unittest.TestCase):
    def test_it_forks_on_sonnet_and_follows_the_one_procedure(self):
        with open(WRAPPER, encoding="utf-8") as f:
            text = f.read()
        head = text.split("\n---\n", 1)[0]
        self.assertIn("\ncontext: fork\n", head + "\n")
        self.assertIn("\nmodel: sonnet\n", head + "\n")
        self.assertIn("Read `.claude/skills/backlog-item/SKILL.md` now and follow it", text)
        # The label it puts on the PR is the one the count and the precheck read.
        self.assertIn(f'--label "{imp.LABEL}"', text)
        self.assertIn("REROUTE <ID>", text)
        with open(os.path.join(LOOP, "SKILL.md"), encoding="utf-8") as f:
            driver = f.read()
        for phrase in ("next.py --implementer", "skill `backlog-item-sonnet`", "`REROUTE <ID>: <path>`"):
            self.assertIn(phrase, driver, f"the driver no longer says {phrase!r}")


def git(repo, *args):
    subprocess.run(["git", "-C", repo, *args], check=True, capture_output=True, text=True)


# A gh whose PR carries `labels` and closes #291.
GH = '''#!/bin/sh
case "$*" in
  "issue list"*) echo '291' ;;
  "pr view --json labels"*) printf '%s' "{labels}" ;;
  "pr view"*) printf 'Body.\\n\\nCloses #291\\n' ;;
esac
exit 0
'''


def write(d, rel, text):
    path = os.path.join(d, rel)
    os.makedirs(os.path.dirname(path) or d, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


class PrecheckRefusesAProtectedPathOnSonnet(unittest.TestCase):
    def run_on(self, changed, labels, env_sonnet=False, base=None, moved=None, main_rule=None):
        """precheck.sh on a branch that writes `changed` (or `git mv`s
        `moved` = (old, new)) over a base holding `base`, and `main_rule` as
        origin/main's implementer.py when given."""
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        git(d, "init", "-q")
        git(d, "config", "user.email", "t@example.invalid")
        git(d, "config", "user.name", "T")
        write(d, "README", "x\n")
        for rel in base or ():
            write(d, rel, "a long enough line that a rename is detected as one\n" * 5)
        if main_rule is not None:
            write(d, ".claude/skills/backlog-loop/implementer.py", main_rule)
        git(d, "add", "-A")
        git(d, "commit", "-q", "-m", "base")
        git(d, "update-ref", "refs/remotes/origin/main", "HEAD")
        if moved:
            os.makedirs(os.path.dirname(os.path.join(d, moved[1])) or d, exist_ok=True)
            git(d, "mv", *moved)
        if changed:
            write(d, changed, "a change\n")
        git(d, "add", "-A")
        git(d, "commit", "-q", "-m", "AF-12: a change")
        bin_dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, bin_dir, ignore_errors=True)
        with open(os.path.join(bin_dir, "gh"), "w", encoding="utf-8") as f:
            f.write(GH.replace("{labels}", labels))
        os.chmod(os.path.join(bin_dir, "gh"), 0o755)
        env = dict(os.environ, PATH=f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
        env.pop("LOOP_IMPLEMENTER", None)
        if env_sonnet:
            env["LOOP_IMPLEMENTER"] = "sonnet"
        r = subprocess.run(["bash", PRECHECK, "AF-12"], cwd=d, env=env,
                           capture_output=True, text=True, check=False)
        return r.returncode, r.stdout

    def test_a_sonnet_pr_on_a_protected_path_fails(self):
        code, out = self.run_on("data/current.txt", imp.LABEL)
        self.assertIn("changes a protected path", out)
        self.assertIn("data/current.txt", out)
        self.assertEqual(code, 1, out)

    def test_a_sonnet_pr_off_them_passes(self):
        code, out = self.run_on("web/src/App.txt", imp.LABEL)
        self.assertIn("implemented on Sonnet, and no protected path changed", out)
        self.assertEqual(code, 0, out)

    def test_a_file_moved_out_of_a_protected_path_fails(self):
        code, out = self.run_on(None, imp.LABEL, base=("tools/x.txt",), moved=("tools/x.txt", "y.txt"))
        self.assertIn("tools/x.txt", out)
        self.assertEqual(code, 1, out)

    def test_run_as_sonnet_the_diff_is_checked_even_unlabelled_and_the_label_is_required(self):
        code, out = self.run_on("data/current.txt", "", env_sonnet=True)
        self.assertIn("changes a protected path", out)
        self.assertIn("not labelled", out)
        self.assertEqual(code, 1, out)
        code, out = self.run_on("web/src/App.txt", "", env_sonnet=True)
        self.assertIn("not labelled", out)
        self.assertEqual(code, 1, out)

    def test_the_rule_is_origin_main_s_not_the_branch_s(self):
        # origin/main's rule protects everything; the branch's would pass a
        # web file. The check must use main's, so it fails.
        strict = "import sys\nprint(sys.stdin.read().split()[0])\nsys.exit(1)\n"
        code, out = self.run_on("web/src/App.txt", imp.LABEL, main_rule=strict)
        self.assertIn("changes a protected path", out)
        self.assertEqual(code, 1, out)

    def test_an_opus_pr_on_a_protected_path_is_not_this_check_s_business(self):
        code, out = self.run_on("data/current.txt", "")
        self.assertNotIn("protected path", out)
        self.assertEqual(code, 0, out)


def load_next():
    spec = importlib.util.spec_from_file_location("backlog_next_for_implementer", os.path.join(LOOP, "next.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def qrow(n, ident, size, status="Next", *labels):
    return dict(status=status, number=n, ident=ident, title=f"{ident}: x", body="",
                labels=sorted([f"size: {size}", *labels]), url="u", waits=0)


class NextImplementer(unittest.TestCase):
    """`next.py --implementer` reads the head the fork would take, under the
    same --skip and --max-size, and counts only what the trial implemented."""

    def setUp(self):
        self.nxt = load_next()
        self.ranked = [qrow(1, "AF-01", "M"), qrow(2, "AF-02", "S", "Next", "blocked"),
                       qrow(3, "AF-03", "S"), qrow(4, "AF-04", "XS")]
        self.nxt.load = lambda **kw: (self.ranked, [], [])
        self.nxt.one_body = lambda n: "**Where:** web/src/pages/Glossary.jsx"
        self.nxt.claude_branches = lambda: []
        self.prs = {"open": [], "all": []}
        self.nxt.gh = lambda *a: self.prs["all" if "all" in a else "open"]

    def said(self, *argv):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.nxt.main(["--implementer", *argv])
        return out.getvalue().strip()

    def test_the_head_is_the_fork_s_under_the_same_skip_and_cap(self):
        self.assertTrue(self.said().startswith("opus - AF-01 is size M"), self.said())
        # The cap passes over the M and the blocked S, as the fork's --group would.
        self.assertTrue(self.said("--max-size", "S").startswith("sonnet AF-03 - "))
        self.assertTrue(self.said("--max-size", "S", "--skip", "AF-03").startswith("sonnet AF-04 - "))

    def test_only_merged_and_open_labelled_prs_count(self):
        self.prs["all"] = [{"state": "MERGED"}] * 9 + [{"state": "CLOSED"}] * 5
        self.assertTrue(self.said("--max-size", "S").startswith("sonnet AF-03"))
        self.prs["all"].append({"state": "OPEN"})
        self.assertIn("waits to be measured", self.said("--max-size", "S"))

    def test_open_work_keeps_opus_whatever_the_head(self):
        self.prs["open"] = [{"headRefName": "claude/vd-33-photographs"}]
        self.assertIn("claude/ branch or pull request is open", self.said("--max-size", "S"))
        self.prs["open"] = [{"headRefName": "refresh/2026-10-27"}]
        self.assertTrue(self.said("--max-size", "S").startswith("sonnet"))
        self.nxt.claude_branches = lambda: ["claude/af-03-x"]
        self.assertIn("is open", self.said("--max-size", "S"))


if __name__ == "__main__":
    unittest.main()
