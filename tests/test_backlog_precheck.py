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
"""
import os
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
FOUND_NOTHING = '''#!/bin/sh
case "$1 $2" in
  "issue list") echo '' ;;
  "pr view")    printf 'Body.\\n\\nCloses #291\\n' ;;
esac
exit 0
'''
REFUSING = '''#!/bin/sh
echo "GraphQL: API rate limit already exceeded for user ID 37551336." >&2
exit 1
'''
# The API refuses the item lookup but the PR reads fine - the outage the gate
# was written for, and the one where it fell silent.
REFUSING_ISSUES_ONLY = '''#!/bin/sh
case "$1 $2" in
  "pr view") printf 'Body.\n\nCloses #291\n'; exit 0 ;;
esac
echo "GraphQL: API rate limit already exceeded." >&2
exit 1
'''
CLOSES_NOTHING = '''#!/bin/sh
case "$1 $2" in
  "pr view") printf 'Body with no closing line.\n'; exit 0 ;;
esac
echo "GraphQL: API rate limit already exceeded." >&2
exit 1
'''
EMPTY_BODY = '''#!/bin/sh
case "$1 $2" in
  "issue list") echo '291' ;;
  "pr view")    printf '' ;;
esac
exit 0
'''


class Precheck(unittest.TestCase):
    def run_with(self, stub, *items):
        with tempfile.TemporaryDirectory() as bin_dir:
            gh = os.path.join(bin_dir, "gh")
            with open(gh, "w", encoding="utf-8") as f:
                f.write(stub)
            os.chmod(gh, 0o755)
            env = dict(os.environ, PATH=f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
            r = subprocess.run(["bash", PRECHECK, *items], cwd=ROOT, env=env,
                               capture_output=True, text=True)
        return r.returncode, r.stdout

    def assertNoFail(self, out):
        # The exit code also reflects checks unrelated to the queue - a
        # changed .js file is run through `node --check`, and node is not on
        # this environment's shell PATH - so assert on what this file is about.
        self.assertNotIn("FAIL", out)

    def test_an_issue_gh_can_see_passes(self):
        _, out = self.run_with(WORKING, "AF-12")
        self.assertIn("AF-12 is issue #291", out)
        self.assertIn("the PR closes #291", out)
        self.assertNoFail(out)

    def test_an_issue_that_really_is_not_filed_still_fails(self):
        # The control. A working gh that finds nothing means what it says.
        code, out = self.run_with(FOUND_NOTHING, "AF-12")
        self.assertIn("AF-12 is not an open issue", out)
        self.assertEqual(code, 1, out)

    def test_a_gh_that_cannot_run_is_a_warning_about_the_api(self):
        # Not "never filed": that sends a fork to file an issue that exists.
        _, out = self.run_with(REFUSING, "AF-12")
        self.assertIn("AF-12 unchecked, gh failed", out)
        self.assertIn("rate limit", out)
        self.assertNotIn("is not an open issue", out)
        self.assertNoFail(out)

    def test_an_unverifiable_item_still_needs_the_pr_to_close_something(self):
        # The gate must not fall silent in the outage it exists for.
        _, out = self.run_with(REFUSING_ISSUES_ONLY, "AF-12")
        self.assertIn("went unverified", out)
        self.assertNoFail(out)

    def test_a_body_that_closes_nothing_fails_even_when_the_ids_are_unknown(self):
        code, out = self.run_with(CLOSES_NOTHING, "AF-12")
        self.assertIn("closes no issue at all", out)
        self.assertEqual(code, 1, out)

    def test_a_pr_that_exists_with_an_empty_body_is_not_called_absent(self):
        code, out = self.run_with(EMPTY_BODY, "AF-12")
        self.assertIn("empty body", out)
        self.assertNotIn("no PR read", out)
        self.assertEqual(code, 1, out)

    def test_every_id_of_a_group_is_checked(self):
        _, out = self.run_with(WORKING, "AF-12", "AF-13", "AF-14")
        for item in ("AF-12", "AF-13", "AF-14"):
            self.assertIn(f"{item} is issue #291", out)
        self.assertNoFail(out)

    def test_an_empty_argument_is_skipped_not_searched(self):
        _, out = self.run_with(WORKING, "")
        self.assertNotIn("is issue", out)
        self.assertNoFail(out)


if __name__ == "__main__":
    unittest.main()
