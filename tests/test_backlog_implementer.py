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
import importlib.util
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
            ("(.github/workflows/ci.yml)", ".github/workflows/"),
            ("LICENSE-DATA says", "LICENSE-DATA"),
            ("ATTRIBUTION.md's table", "ATTRIBUTION.md"),
            ("web/package.json", "package.json"),
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
            ".github/workflows/ci.yml", "LICENSE-DATA", "web/package-lock.json", "docs/DECISIONS.md", ""]),
            ["data/current.py", "verify.py", "web/scripts/prerender.js", ".github/workflows/ci.yml",
             "LICENSE-DATA", "web/package-lock.json"])

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


class PrecheckRefusesAProtectedPathOnSonnet(unittest.TestCase):
    def run_on(self, changed, labels):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        git(d, "init", "-q")
        git(d, "config", "user.email", "t@example.invalid")
        git(d, "config", "user.name", "T")
        with open(os.path.join(d, "README"), "w", encoding="utf-8") as f:
            f.write("x\n")
        git(d, "add", "-A")
        git(d, "commit", "-q", "-m", "base")
        git(d, "update-ref", "refs/remotes/origin/main", "HEAD")
        path = os.path.join(d, changed)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write("a change\n")
        git(d, "add", "-A")
        git(d, "commit", "-q", "-m", "AF-12: a change")
        bin_dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, bin_dir, ignore_errors=True)
        with open(os.path.join(bin_dir, "gh"), "w", encoding="utf-8") as f:
            f.write(GH.replace("{labels}", labels))
        os.chmod(os.path.join(bin_dir, "gh"), 0o755)
        env = dict(os.environ, PATH=f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
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

    def test_an_opus_pr_on_a_protected_path_is_not_this_check_s_business(self):
        code, out = self.run_on("data/current.txt", "")
        self.assertNotIn("protected path", out)
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
