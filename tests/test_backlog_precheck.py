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
import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRECHECK = os.path.join(ROOT, ".claude", "skills", "backlog-loop", "precheck.sh")
FLOORS = os.path.join(ROOT, ".claude", "skills", "backlog-loop", "floors.py")

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

# An issue named by number (CR-75): `gh issue view` answers for it, with the
# number when it is an open issue and nothing when it is not.
BY_NUMBER = WORKING.replace('"issue list") echo \'291\' ;;', '"issue view") echo \'291\' ;;')
NOT_AN_ISSUE = '''#!/bin/sh
case "$1 $2" in
  "pr view") printf 'Body.\\n\\nCloses #291\\n'; exit 0 ;;
esac
echo "GraphQL: Could not resolve to an issue or pull request with the number of 291." >&2
exit 1
'''


def alarm(body):
    """refresh.yml's alarm: the issue answers with "!" after its number."""
    return WORKING.replace("echo '291'", "echo '291!'").replace(
        "printf 'Body.\\n\\nCloses #291\\n'", f"printf '{body}'")

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

    def run_in(self, repo, stub, *items, ruff=CLEAN_RUFF, python=None):
        """precheck.sh in `repo`, with a stub gh (and ruff) ahead of PATH.
        `ruff=None` means ruff is not installed: PATH is cut to the system
        directories, where a brew install never lands, and PYTHON names an
        interpreter that cannot run it as a module, which is where a pip
        install would otherwise be found. `python` replaces that interpreter
        with a stub, for Ruff reachable only as a module."""
        bin_dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, bin_dir, ignore_errors=True)
        for name, body in (("gh", stub), ("ruff", ruff), ("py", python)):
            if body is None:
                continue
            path = os.path.join(bin_dir, name)
            with open(path, "w", encoding="utf-8") as f:
                f.write(body)
            os.chmod(path, 0o755)
        rest = os.environ["PATH"] if ruff is not None else "/usr/bin:/bin"
        env = dict(os.environ, PATH=f"{bin_dir}{os.pathsep}{rest}")
        env.pop("RUFF", None)
        if python is not None:
            env["PYTHON"] = os.path.join(bin_dir, "py")
        elif ruff is None:
            env["PYTHON"] = "false"
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
        # `git diff --name-only` lists both sides of a rename and ruff exits
        # 1 with E902 on a path it cannot read, so without the filter every
        # rename of a Python file fails the precheck for a file that is meant
        # to be gone. WANTS_REAL fails on a missing path the way ruff does.
        repo = self.repo(base=("x.py", "old.py"), changed=("x.py",), removed=("old.py",))
        code, out = self.run_in(repo, WORKING, "AF-12", ruff=WANTS_REAL)
        self.assertNotIn("no such file", out)
        self.assertIn("ruff clean on the changed Python", out)
        self.assertEqual(code, 0, out)

    def test_ruff_installed_only_as_a_module_is_still_run(self):
        # CR-44: a pip install off PATH is reached as `python3 -m ruff`, the
        # way `make lint` runs it, rather than reported as not installed.
        module = ANGRY_RUFF.replace(
            "#!/bin/sh\n",
            '#!/bin/sh\n[ "$1 $2" = "-m ruff" ] || exit 2\n'
            '[ "$3" = "--version" ] && exit 0\n')
        code, out = self.run_with(WORKING, "AF-12", ruff=None, python=module)
        self.assertNotIn("ruff not installed", out)
        self.assertIn("ruff finds what CI's lint job will fail on", out)
        self.assertEqual(code, 1, out)

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

    def test_an_issue_named_by_number_is_checked_by_number(self):
        for name in ("#291", "291"):
            code, out = self.run_with(BY_NUMBER, name)
            self.assertIn(f"{name} is issue #291", out)
            self.assertIn("the PR closes #291", out)
            self.assertEqual(code, 0, out)

    def test_a_number_that_is_no_issue_fails_rather_than_warns(self):
        code, out = self.run_with(NOT_AN_ISSUE, "#291")
        self.assertIn("#291 is not an open issue", out)
        self.assertNotIn("unchecked", out)
        self.assertEqual(code, 1, out)

    def test_an_alarm_referred_to_passes(self):
        code, out = self.run_with(alarm("Body.\\n\\nRefs #291\\n"), "AF-12")
        self.assertIn("a refresh.yml alarm", out)
        self.assertIn("refers to #291 without closing it", out)
        self.assertEqual(code, 0, out)

    def test_an_alarm_closed_by_the_pr_fails_wherever_the_keyword_is(self):
        # GitHub closes on the keyword mid-sentence too, so this reads the
        # whole body, where an ordinary item's check reads line starts.
        for body in ("Closes #291\\n", "This fixes #291 at last.\\n", "Resolved: #291\\n",
                     "Closes  #291\\n", "Fixes Alex-Farley/formula-1-data#291\\n",
                     "Closes https://github.com/Alex-Farley/formula-1-data/issues/291\\n"):
            code, out = self.run_with(alarm(body), "AF-12")
            self.assertIn("would close alarm #291", out, body)
            self.assertEqual(code, 1, out)

    def test_an_alarm_the_pr_never_names_fails(self):
        code, out = self.run_with(alarm("Refs #2910\\n"), "AF-12")
        self.assertIn("does not name alarm #291", out)
        self.assertEqual(code, 1, out)


# verify.py's floors (AF-103), at the commit the branch left main at.
VERIFY = """def checks(con):
    FLOORS = (
        ("standings", 34563), ("engines", 424), ("chassis", 1153),
    )
    COLUMN_FLOORS = (
        ("article_images", "race_id", 3916, "harvest/race_images.txt"),
        ("chassis", "weight_kg", 201, "harvest/car_specs.txt"),
    )
    FLOOR = 60
    {extra}
"""


def says(body):
    """A working gh whose PR body is `body`."""
    return WORKING.replace("printf 'Body.\\n\\nCloses #291\\n'", f"printf '{body}'")


class Floors(unittest.TestCase):
    """A floor lowered or removed in verify.py names the maintainer's ruling.

    #935 lowered `article_images.race_id` from 3911 to 3910 and only the
    reviewer saw it; the floors are never lowered without a ruling."""

    run_in = Precheck.run_in

    def floor_repo(self, head, main=None):
        """verify.py as VERIFY on the commit the branch left, `head` on the
        branch, and - when given - `main` on an origin/main that moved since."""
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        git(d, "init", "-q")
        git(d, "config", "user.email", "t@example.invalid")
        git(d, "config", "user.name", "T")

        def commit(text, message):
            with open(os.path.join(d, "verify.py"), "w", encoding="utf-8") as f:
                f.write(text)
            git(d, "add", "-A")
            git(d, "commit", "-q", "-m", message)

        commit(VERIFY.format(extra="pass"), "base")
        git(d, "branch", "-q", "base")
        if main is not None:
            commit(main, "main moved")
        git(d, "update-ref", "refs/remotes/origin/main", "HEAD")
        git(d, "checkout", "-q", "-b", "work", "base")
        commit(head, "AF-12: a change")
        return d

    LOWERED = VERIFY.format(extra="pass").replace("3916", "3910")

    def test_a_lowered_floor_with_no_ruling_fails(self):
        code, out = self.run_in(self.floor_repo(self.LOWERED), says("Body.\\n"))
        self.assertIn("floor article_images.race_id lowered 3916 -> 3910 with no ruling named", out)
        self.assertEqual(code, 1, out)

    def test_a_lowered_floor_whose_ruling_is_named_passes(self):
        for ruling in ("#838", "D-53"):
            body = f"Body.\\n\\nFloor lowered: article_images.race_id 3916 -> 3910, ruled on {ruling}\\n"
            code, out = self.run_in(self.floor_repo(self.LOWERED), says(body))
            self.assertIn("names its ruling", out)
            self.assertEqual(code, 0, out)

    def test_a_ruling_for_another_floor_does_not_cover_this_one(self):
        body = "Floor lowered: standings, ruled on #838\\n"
        code, out = self.run_in(self.floor_repo(self.LOWERED), says(body))
        self.assertIn("article_images.race_id lowered", out)
        self.assertEqual(code, 1, out)

    def test_a_line_naming_the_floor_with_no_reference_is_not_a_ruling(self):
        body = "Floor lowered: article_images.race_id 3916 -> 3910, the maintainer agreed\\n"
        code, out = self.run_in(self.floor_repo(self.LOWERED), says(body))
        self.assertIn("article_images.race_id lowered 3916 -> 3910 with no ruling named", out)
        self.assertEqual(code, 1, out)

    def test_a_ruling_for_a_column_floor_does_not_cover_its_table(self):
        # grep -w counts "." as a word boundary, so the first version took a
        # ruling for chassis.weight_kg as one for the chassis row floor. End to
        # end: the values differ here too, so the key's own bound is pinned by
        # FloorShapes' ruling test, not this one.
        head = VERIFY.format(extra="pass").replace("1153", "1100")
        body = "Floor lowered: chassis.weight_kg 201 -> 200, ruled on #838\\n"
        code, out = self.run_in(self.floor_repo(head), says(body))
        self.assertIn("floor chassis lowered 1153 -> 1100 with no ruling named", out)
        self.assertEqual(code, 1, out)

    def test_a_line_that_only_mentions_the_floor_is_not_a_ruling(self):
        head = VERIFY.format(extra="pass").replace("34563", "34000")
        body = "The standings floor test is in this PR. Closes #986\\n"
        code, out = self.run_in(self.floor_repo(head), says(body))
        self.assertIn("floor standings lowered 34563 -> 34000 with no ruling named", out)
        self.assertEqual(code, 1, out)

    def test_a_floor_in_a_shape_it_cannot_read_fails(self):
        # Fail closed: a floor floors.py skipped is one a change lowers unseen.
        head = VERIFY.format(extra="NEW_FLOORS = ((100, \"engines\"),)")
        code, out = self.run_in(self.floor_repo(head), says("Body.\\n"))
        self.assertIn("verify.py's floors could not be compared", out)
        self.assertEqual(code, 1, out)

    def test_a_removed_floor_is_a_lowered_one(self):
        # A deleted floor guards nothing at all.
        head = VERIFY.format(extra="pass").replace('("engines", 424),', "")
        code, out = self.run_in(self.floor_repo(head), says("Body.\\n"))
        self.assertIn("floor engines removed (was 424) with no ruling named", out)
        self.assertEqual(code, 1, out)
        body = "Floor removed: engines 424 -> removed, ruled on #838\\n"
        code, out = self.run_in(self.floor_repo(head), says(body))
        self.assertIn("floor engines removed (was 424), and the PR body names its ruling", out)
        self.assertEqual(code, 0, out)

    def test_a_scalar_floor_is_read_by_its_function(self):
        head = VERIFY.format(extra="pass").replace("FLOOR = 60", "FLOOR = 59")
        code, out = self.run_in(self.floor_repo(head), says("Body.\\n"))
        self.assertIn("floor checks:FLOOR lowered 60 -> 59", out)
        self.assertEqual(code, 1, out)

    def test_a_raised_floor_passes(self):
        head = VERIFY.format(extra="pass").replace("34563", "34600")
        code, out = self.run_in(self.floor_repo(head), says("Body.\\n"))
        self.assertIn("no verify.py floor lowered", out)
        self.assertEqual(code, 0, out)

    def test_a_floor_main_raised_since_is_not_this_branch_lowering_it(self):
        # Against origin/main's tip, the branch's untouched 3916 would read as
        # lowering main's 3920; against the commit it left, it changed nothing.
        main = VERIFY.format(extra="pass").replace("3916", "3920")
        head = VERIFY.format(extra="x = 1")
        code, out = self.run_in(self.floor_repo(head, main=main), says("Body.\\n"))
        self.assertIn("no verify.py floor lowered", out)
        self.assertEqual(code, 0, out)

    def test_the_body_already_read_for_the_items_serves_the_floors_too(self):
        body = "Body.\\n\\nCloses #291\\nFloor lowered: article_images.race_id 3916 -> 3910, ruled on #838\\n"
        code, out = self.run_in(self.floor_repo(self.LOWERED), says(body), "AF-12")
        self.assertIn("names its ruling", out)
        self.assertEqual(code, 0, out)

    def test_an_unreadable_pr_body_still_fails_a_lowered_floor(self):
        # Fail closed: a floor nobody can see a ruling for stays refused. With
        # items named, check 4 read the body first and later gh calls reused
        # the error file, so the reason has to be the one check 4 kept.
        for items in ((), ("AF-12",)):
            code, out = self.run_in(self.floor_repo(self.LOWERED), REFUSING, *items)
            self.assertIn("no PR body read: GraphQL: API rate limit", out, items)
            self.assertEqual(code, 1, out)

    def test_a_body_floors_py_cannot_read_fails_with_its_reason(self):
        # The second floors.py call, the one handed the body, failing: a byte
        # that is not UTF-8 is enough.
        code, out = self.run_in(self.floor_repo(self.LOWERED), says("Body \\377\\n"))
        self.assertIn("could not be read for floor rulings: floors.py:", out)
        self.assertNotIn("floor ?", out)
        self.assertEqual(code, 1, out)

    def test_the_extractor_reads_the_real_verify_py(self):
        # A refactor of verify.py that hid its floors from floors.py would
        # leave this check comparing nothing with nothing, and passing.
        r = subprocess.run([sys.executable, FLOORS, "--list", os.path.join(ROOT, "verify.py")],
                           capture_output=True, text=True, check=False)
        self.assertEqual(r.returncode, 0, r.stderr)
        keys = {line.split()[0] for line in r.stdout.splitlines()}
        for key in ("standings", "race_entries", "article_images.race_id",
                    "chassis.weight_kg", "records_are_derived:FLOOR"):
            self.assertIn(key, keys)


def load_floors():
    spec = importlib.util.spec_from_file_location("floors", FLOORS)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FloorShapes(unittest.TestCase):
    """What floors.py reads, and the shapes it refuses rather than skips."""

    def setUp(self):
        self.f = load_floors()

    def test_the_shapes_it_reads(self):
        src = ("A_FLOOR = 5\n"
               "def f():\n    FLOOR: int = 60\n    RATIO_FLOOR = 0.95\n"
               "ROW_FLOORS = [('t', 'c', 10, 'x.txt')]\n"
               "DICT_FLOORS = {'d': 7}\n")
        self.assertEqual(self.f.floors(src), {
            "<module>:A_FLOOR": 5, "f:FLOOR": 60, "f:RATIO_FLOOR": 0.95,
            "t.c": 10, "d": 7})

    def test_the_shapes_it_refuses(self):
        for src in ("X_FLOOR, Y_FLOOR = 5, 6\n",
                    "FLOORS = ((100, 'engines'),)\n",
                    "FLOORS = (('engines',),)\n",
                    "FLOORS = (('t', 'c', 10, 'a'), ('t', 'c', 20, 'b'))\n",
                    "FLOOR = 5\nFLOOR += 1\n",
                    "FLOORS = {}\nFLOORS['x'] = 5\n",
                    "FLOOR = compute()\n",
                    "FLOORS = {'t': n}\n"):
            with self.assertRaises(self.f.Unreadable, msg=src):
                self.f.floors(src)

    def test_a_ruling_names_the_floor_its_change_and_a_reference(self):
        ok = "Floor lowered: chassis 1153 -> 1100, ruled on #838"
        self.assertTrue(self.f.ruled(ok, "chassis", 1153, 1100))
        self.assertTrue(self.f.ruled(ok.replace("#838", "D-53"), "chassis", 1153, 1100))
        self.assertFalse(self.f.ruled(ok.replace(", ruled on #838", ""), "chassis", 1153, 1100))
        self.assertFalse(self.f.ruled(ok.replace("Floor lowered", "Lowered"), "chassis", 1153, 1100))
        self.assertFalse(self.f.ruled(ok.replace("chassis", "x.chassis"), "chassis", 1153, 1100))
        self.assertFalse(self.f.ruled(ok.replace("1100", "11000"), "chassis", 1153, 1100))
        self.assertFalse(self.f.ruled(ok.replace("1100", "1100.5"), "chassis", 1153, 1100))
        # A sentence may end on the change.
        self.assertTrue(self.f.ruled("Ruled on #838: floor chassis 1153 -> 1100.",
                                     "chassis", 1153, 1100))
        self.assertFalse(self.f.ruled("Floor lowered: chassis 1153 -> 1100\nruled on #838",
                                      "chassis", 1153, 1100))


if __name__ == "__main__":
    unittest.main()
