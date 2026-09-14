"""What `precheck.sh` says when GitHub answers, and when it cannot.

WHY THIS FILE EXISTS
    The precheck is a control: it is the gate between a change and a reviewer
    that costs 40,000 to 130,000 tokens. It had no tests, and it resolved an
    item id with a `gh` call whose stderr went to /dev/null, so a rate-limited
    API and an issue that was never filed produced the same empty string and
    the same message - "AF-12 is not an open issue". That happened to AF-12
    itself, which was issue #291, open, while GitHub was refusing GraphQL.

    It matters because `CONTRIBUTING.md` tells a fork to file work that is not
    in the queue, so the message invites a duplicate, and a group multiplies
    it by its own size. The rule these tests hold: an empty answer from a
    working `gh` is a FAIL, and an answer from a `gh` that could not run is a
    WARN naming the API. The control must not weaken in the first case.

    Each test builds its own repository. The first version ran the script
    against this checkout and asserted on its exit code, which passed here and
    failed on CI: a runner clones at depth 1, so there is no `origin/main`,
    every diff-based check compared nothing, and the assertions about them
    were about a diff that did not exist. A control's tests cannot depend on
    where they are run from.
"""
import os
import shutil
import subprocess
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRECHECK = os.path.join(ROOT, ".claude", "skills", "backlog-loop", "precheck.sh")

WORKING = '''#!/bin/sh
case "$1 $2" in
  "issue list") echo '291' ;;
  "pr view")    printf 'Body.\\n\\nCloses #291\\n' ;;
esac
exit 0
'''
FOUND_NOTHING = WORKING.replace("echo '291'", "echo ''")
REFUSING = '''#!/bin/sh
echo "GraphQL: API rate limit already exceeded for user ID 37551336." >&2
exit 1
'''
# The API refuses the item lookup but the PR reads fine - the outage the
# fallback was written for, and the one where the gate fell silent.
REFUSING_ISSUES_ONLY = '''#!/bin/sh
case "$1 $2" in
  "pr view") printf 'Body.\\n\\nCloses #291\\n'; exit 0 ;;
esac
echo "GraphQL: API rate limit already exceeded." >&2
exit 1
'''
CLOSES_NOTHING = REFUSING_ISSUES_ONLY.replace("Closes #291\\n", "nothing here\\n")
EMPTY_BODY = WORKING.replace("printf 'Body.\\n\\nCloses #291\\n'", "printf ''")

CLEAN_RUFF = '#!/bin/sh\nexit 0\n'
ANGRY_RUFF = '#!/bin/sh\necho "x.py:1:1: F821 undefined name"\nexit 1\n'
# Complains unless `f1` is among the paths it was handed. ruff.toml includes
# `f1` by name because it is 43 KB of extensionless Python a bare walk skips.
WANTS_F1 = ('#!/bin/sh\nfor a in "$@"; do [ "$a" = "f1" ] && exit 0; done\n'
            'echo "f1 was never linted"; exit 1\n')
# Complains unless it was handed at least two separate paths, which an
# over-quoted "$pyfiles" would collapse into one.
WANTS_BOTH = ('#!/bin/sh\nn=0\nfor a in "$@"; do\n'
              '  case "$a" in check|-*) continue ;; esac\n  n=$((n+1))\ndone\n'
              '[ $n -ge 2 ] && exit 0\necho "got $n path(s), expected 2"; exit 1\n')
# Complains about any path it cannot read - the vanished side of a rename.
WANTS_REAL = ('#!/bin/sh\nfor a in "$@"; do\n'
              '  case "$a" in check|-*) continue ;; esac\n'
              '  [ -f "$a" ] || { echo "no such file: $a"; exit 1; }\ndone\nexit 0\n')


def git(repo, *args):
    subprocess.run(["git", "-C", repo, *args], check=True,
                   capture_output=True, text=True)


class Precheck(unittest.TestCase):
    def repo(self, message="AF-12: a change", base=("x.py",), changed=("x.py",),
             removed=()):
        """A repository with one commit on origin/main and one after it."""
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        git(d, "init", "-q")
        git(d, "config", "user.email", "t@example.invalid")
        git(d, "config", "user.name", "T")
        for name in base:
            with open(os.path.join(d, name), "w", encoding="utf-8") as f:
                f.write("VALUE = 1\n")
        git(d, "add", "-A")
        git(d, "commit", "-q", "-m", "base")
        git(d, "update-ref", "refs/remotes/origin/main", "HEAD")
        for name in changed:
            with open(os.path.join(d, name), "w", encoding="utf-8") as f:
                f.write("VALUE = 2\n")
        for name in removed:
            os.remove(os.path.join(d, name))
        git(d, "add", "-A")
        git(d, "commit", "-q", "-m", message)
        return d

    def run_in(self, repo, stub, *items, ruff=CLEAN_RUFF):
        """precheck.sh in `repo`, with a stub gh (and ruff) ahead of PATH.
        `ruff=None` means ruff is not installed: PATH is cut to the system
        directories, where a pip or brew install never lands."""
        bin_dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, bin_dir, ignore_errors=True)
        for name, body in (("gh", stub), ("ruff", ruff)):
            if body is None:
                continue
            path = os.path.join(bin_dir, name)
            with open(path, "w", encoding="utf-8") as f:
                f.write(body)
            os.chmod(path, 0o755)
        rest = os.environ["PATH"] if ruff is not None else "/usr/bin:/bin"
        env = dict(os.environ, PATH=f"{bin_dir}{os.pathsep}{rest}")
        r = subprocess.run(["bash", PRECHECK, *items], cwd=repo, env=env,
                           capture_output=True, text=True, check=False)
        return r.returncode, r.stdout

    def run_with(self, stub, *items, **kw):
        return self.run_in(self.repo(), stub, *items, **kw)

    def test_an_issue_gh_can_see_passes(self):
        code, out = self.run_with(WORKING, "AF-12")
        self.assertIn("AF-12 is issue #291", out)
        self.assertIn("the PR closes #291", out)
        self.assertIn("a commit names AF-12", out)
        self.assertEqual(code, 0, out)

    def test_an_issue_that_really_is_not_filed_still_fails(self):
        # The control. A working gh that finds nothing means what it says.
        code, out = self.run_with(FOUND_NOTHING, "AF-12")
        self.assertIn("AF-12 is not an open issue", out)
        self.assertEqual(code, 1, out)

    def test_a_gh_that_cannot_run_is_a_warning_about_the_api(self):
        # Not "never filed": that sends a fork to file an issue that exists.
        code, out = self.run_with(REFUSING, "AF-12")
        self.assertIn("AF-12 unchecked, gh failed", out)
        self.assertIn("rate limit", out)
        self.assertNotIn("is not an open issue", out)
        self.assertEqual(code, 0, out)

    def test_an_unverifiable_item_still_needs_the_pr_to_close_something(self):
        code, out = self.run_with(REFUSING_ISSUES_ONLY, "AF-12")
        self.assertIn("went unverified", out)
        self.assertEqual(code, 0, out)

    def test_a_body_that_closes_nothing_fails_even_when_the_ids_are_unknown(self):
        # The gate must not fall silent in the outage it exists for.
        code, out = self.run_with(CLOSES_NOTHING, "AF-12")
        self.assertIn("closes no issue at all", out)
        self.assertEqual(code, 1, out)

    def test_a_pr_that_exists_with_an_empty_body_is_not_called_absent(self):
        code, out = self.run_with(EMPTY_BODY, "AF-12")
        self.assertIn("empty body", out)
        self.assertNotIn("no PR read", out)
        self.assertEqual(code, 1, out)

    def test_a_ruff_finding_fails_the_precheck(self):
        # CI's lint job is separate from `make ci`, so this is the only local
        # gate that sees it. PLW1510 reached CI on AF-12 because there was none.
        code, out = self.run_with(WORKING, "AF-12", ruff=ANGRY_RUFF)
        self.assertIn("ruff finds what CI's lint job will fail on", out)
        self.assertEqual(code, 1, out)

    def test_a_clean_ruff_passes(self):
        code, out = self.run_with(WORKING, "AF-12", ruff=CLEAN_RUFF)
        self.assertIn("ruff clean on the changed Python", out)
        self.assertEqual(code, 0, out)

    def test_the_extensionless_f1_script_is_linted_too(self):
        # ruff.toml includes it by name; the precheck's pathspec has to as well.
        repo = self.repo(base=("x.py", "f1"), changed=("f1",))
        code, out = self.run_in(repo, WORKING, "AF-12", ruff=WANTS_F1)
        self.assertNotIn("f1 was never linted", out)
        # Without asserting the section ran, dropping `f1` from the pathspec
        # leaves nothing changed, skips ruff entirely, and passes vacuously.
        self.assertIn("ruff clean on the changed Python", out)
        self.assertEqual(code, 0, out)

    def test_several_changed_files_are_passed_as_several_paths(self):
        repo = self.repo(base=("x.py", "y.py"), changed=("x.py", "y.py"))
        code, out = self.run_in(repo, WORKING, "AF-12", ruff=WANTS_BOTH)
        self.assertNotIn("expected 2", out)
        self.assertEqual(code, 0, out)

    def test_a_file_the_change_deleted_is_not_handed_to_ruff(self):
        # `git diff --name-only` lists both sides of a rename, and
        # `ruff --quiet` exits 0 on a path it cannot read - so the vanished
        # side was reported clean without ever being linted.
        repo = self.repo(base=("x.py", "old.py"), changed=("x.py",), removed=("old.py",))
        code, out = self.run_in(repo, WORKING, "AF-12", ruff=WANTS_REAL)
        self.assertNotIn("no such file", out)
        self.assertIn("ruff clean on the changed Python", out)
        self.assertEqual(code, 0, out)

    def test_a_missing_ruff_only_warns(self):
        # It is a CI tool, not a dependency, so it may genuinely be absent.
        code, out = self.run_with(WORKING, "AF-12", ruff=None)
        self.assertIn("ruff not installed", out)
        self.assertEqual(code, 0, out)

    def test_a_checkout_without_origin_main_says_so(self):
        # A runner clones at depth 1. Every diff-based check then compares
        # nothing, and a green precheck would mean nothing was checked.
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        git(d, "init", "-q")
        git(d, "config", "user.email", "t@example.invalid")
        git(d, "config", "user.name", "T")
        with open(os.path.join(d, "x.py"), "w", encoding="utf-8") as f:
            f.write("VALUE = 1\n")
        git(d, "add", "-A")
        git(d, "commit", "-q", "-m", "only commit")
        _, out = self.run_in(d, WORKING, "AF-12")
        self.assertIn("no origin/main here", out)

    def test_every_id_of_a_group_is_checked(self):
        code, out = self.run_with(WORKING, "AF-12", "AF-13", "AF-14")
        for item in ("AF-12", "AF-13", "AF-14"):
            self.assertIn(f"{item} is issue #291", out)
        self.assertEqual(code, 0, out)

    def test_an_empty_argument_is_skipped_not_searched(self):
        code, out = self.run_with(WORKING, "")
        self.assertNotIn("is issue", out)
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
