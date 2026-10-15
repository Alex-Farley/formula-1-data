"""The refresh fixer's boundaries (AF-91, fix-refresh.yml, [D-57]).

WHY THIS FILE EXISTS
    fix-refresh.yml runs an agent on a failing refresh with no token that
    writes, and lands what it changed through another job that holds the
    refresh App's token. .github/scripts/fix_refresh.py is what decides
    what may cross: a declared exception in verify.py and never a check's
    logic, data but never the licence classification, a fetch or a test
    fault but never a control. These tests are mostly about what it
    refuses, read against the real files, so a change that should be a
    person's cannot land unattended, and a fix like AF-88's still can.

    The rest read what the gate, the pull request's text and the alarm
    comment say, and the workflow itself: no job that runs an agent holds a
    token that writes, and no job holding one runs an agent.

    python3 -m unittest tests.test_fix_refresh
"""
import importlib.util
import json
import os
import re
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location(
    "fix_refresh", os.path.join(ROOT, ".github", "scripts", "fix_refresh.py"))
fix = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fix)


def real(path):
    with open(os.path.join(ROOT, path), "rb") as f:
        return f.read()


def edited(path, old, new, count=1):
    text = real(path).decode("utf-8")
    assert text.count(old) >= 1, f"{path} no longer holds {old!r}; update the test"
    return text.replace(old, new, count).encode("utf-8")


# AF-88's fix, as it landed (#967): one member added, its comment rewritten.
CUT = 'SQ_CUT_EXCEPTIONS = {(2023, 17, "alonso"), (2024, 11, "leclerc"), (2024, 21, "bearman")'


def cut_line():
    text = real("verify.py").decode("utf-8")
    m = re.search(r"SQ_CUT_EXCEPTIONS = \{[^}]*\}", text)
    assert m, "verify.py has no SQ_CUT_EXCEPTIONS set; update the test"
    return m.group(0)


class AnExceptionCrosses(unittest.TestCase):
    def test_verify_unchanged(self):
        self.assertIsNone(fix.problem("verify.py", real("verify.py"), real("verify.py")))

    def test_a_member_added_to_an_exception_set(self):
        line = cut_line()
        new = edited("verify.py", line, line[:-1] + ', (2099, 1, "nobody")}')
        self.assertIsNone(fix.problem("verify.py", new, real("verify.py")))

    def test_a_comment_rewritten(self):
        new = edited("verify.py", "# ", "# (reworded) ")
        self.assertIsNone(fix.problem("verify.py", new, real("verify.py")))

    def test_a_data_module_edited(self):
        new = real("data/seasons.py") + b"\n# a comment\n"
        self.assertIsNone(fix.problem("data/seasons.py", new, real("data/seasons.py")))

    def test_current_py_outside_the_licence_classification(self):
        new = real("data/current.py") + b"\n# a comment\n"
        self.assertIsNone(fix.problem("data/current.py", new, real("data/current.py")))

    def test_a_test_fault_and_a_fetch_fault(self):
        for path in ("tests/test_standings_rule.py", "tools/f1db_fetch.py"):
            with self.subTest(path=path):
                self.assertIsNone(fix.problem(path, real(path) + b"\n", real(path)))

    def test_the_artefacts_whole(self):
        for path in ("f1.db", "f1-geometry.db", "f1_compat.json"):
            with self.subTest(path=path):
                self.assertIsNone(fix.problem(path, b"anything", real(path)))


class ACheckOrAControlDoesNot(unittest.TestCase):
    def assertRefused(self, path, new, old, why):
        got = fix.problem(path, new, old)
        self.assertIsNotNone(got, f"{path} crossed")
        self.assertIn(why, got)

    def test_a_member_taken_away(self):
        line = cut_line()
        new = edited("verify.py", line, re.sub(r'\(2023, 17, "alonso"\),\s*', "", line))
        self.assertRefused("verify.py", new, real("verify.py"), "takes a declared exception away")

    def test_a_check_s_logic(self):
        text = real("verify.py").decode("utf-8")
        for old, new in ((" <= ", " < "), (" == ", " != "), ("return ", "return None and ")):
            with self.subTest(old=old):
                self.assertIn(old, text)
                self.assertRefused("verify.py", text.replace(old, new, 1).encode(), real("verify.py"),
                                   "changes more than its comments")

    def test_an_exception_that_is_not_a_literal(self):
        line = cut_line()
        new = edited("verify.py", line, "SQ_CUT_EXCEPTIONS = set(__import__('os').listdir('.'))")
        self.assertRefused("verify.py", new, real("verify.py"), "not a literal")

    def test_an_exception_set_renamed_or_added(self):
        line = cut_line()
        renamed = edited("verify.py", line, line.replace("SQ_CUT_EXCEPTIONS", "SQ_CUT2_EXCEPTIONS"))
        self.assertRefused("verify.py", renamed, real("verify.py"), "changes more than")
        added = edited("verify.py", line, line + "\n    NEW_EXCEPTIONS = {1}")
        self.assertRefused("verify.py", added, real("verify.py"), "changes more than")

    def test_the_licence_classification(self):
        text = real("data/current.py").decode("utf-8")
        m = re.search(r'(?m)^    (\d+):\s+\("facts-only"', text)
        self.assertIsNotNone(m, "no facts-only source in SOURCE_LICENCE; update the test")
        new = (text[:m.start()] + m.group(0).replace("facts-only", "yes") + text[m.end():]).encode()
        self.assertRefused("data/current.py", new, real("data/current.py"), "SOURCE_LICENCE")

    def test_paths_that_are_a_person_s(self):
        for path in ("build.py", "schema.sql", "audit.py", "export_json.py", "data/harvest.py",
                     "harvest/race_results.txt", "harvest/held.txt", ".github/workflows/ci.yml",
                     ".github/scripts/fix_refresh.py", "tools/refresh_hold.py", "Makefile",
                     "tests/test_conventions.py", "tests/test_fix_refresh.py",
                     "tests/test_refresh_tree.py", "tests/test_verify_refuses.py",
                     "tests/test_backlog_next.py", "web/test/smoke.mjs", "web/src/lib/refresh.js",
                     ".claude/skills/backlog-item/SKILL.md", "CLAUDE.md"):
            with self.subTest(path=path):
                old = real(path) if os.path.isfile(os.path.join(ROOT, path)) else None
                self.assertRefused(path, (old or b"") + b"\n", old, "not a path")

    def test_a_new_file(self):
        self.assertRefused("data/extra.py", b"X = 1\n", None, "is new")
        self.assertRefused("tests/test_extra.py", b"X = 1\n", None, "is new")

    def test_python_that_does_not_parse(self):
        self.assertRefused("data/seasons.py", b"def (\n", real("data/seasons.py"), "does not parse")

    def test_a_document_outside_its_spans(self):
        new = real("README.md") + b"\nA sentence the fixer added.\n"
        self.assertRefused("README.md", new, real("README.md"), "outside its figure spans")


class ThePullRequestText(unittest.TestCase):
    def write(self, text):
        d = tempfile.mkdtemp()
        self.addCleanup(lambda: __import__("shutil").rmtree(d))
        with open(os.path.join(d, "pr.md"), "w", encoding="utf-8") as f:
            f.write(text)
        return d

    def test_refers_and_never_closes(self):
        title, body = fix.message(self.write("AF-120: declare a row\n\nWhat failed.\n"), "965")
        self.assertEqual(title, "AF-120: declare a row")
        self.assertTrue(body.endswith("\n\nRefs #965"))

    def test_a_closing_keyword_is_refused(self):
        for text in ("AF-1: x\n\nCloses #965\n", "AF-1: x\n\nThis fixes #12.\n",
                     "AF-1: resolves #3\n\nbody\n", "AF-1: x\n\nFixed: owner/repo#4\n"):
            with self.subTest(text=text), self.assertRaises(SystemExit):
                fix.message(self.write(text), "965")

    def test_an_empty_or_long_title_or_body(self):
        for text in ("\n\nbody\n", "AF-1: " + "x" * 200 + "\n\nbody\n", "AF-1: x\n\n\n"):
            with self.subTest(text=text[:20]), self.assertRaises(SystemExit):
                fix.message(self.write(text), "965")


def alarm(labels=("refresh-failing",), comments=(), state="OPEN"):
    return {"number": 965, "title": "AF-110: The refresh from F1DB is failing", "state": state,
            "labels": [{"name": n} for n in labels], "comments": [{"body": c} for c in comments]}


class TheGate(unittest.TestCase):
    def test_an_open_alarm_runs(self):
        self.assertEqual(fix.decide(alarm(), [], False), (True, "#965"))

    def test_what_does_not(self):
        cases = {
            "none": (None, [], False),
            "closed": (alarm(state="CLOSED"), [], False),
            "not the alarm": (alarm(labels=("results-late",)), [], False),
            "a decision pending": (alarm(labels=("refresh-failing", "decision")), [], True),
            "blocked": (alarm(labels=("refresh-failing", "blocked")), [], True),
            "a pull request on it": (alarm(), [1001], True),
            "tried once": (alarm(comments=("x " + fix.MARK,)), [], False),
        }
        for name, args in cases.items():
            with self.subTest(name):
                self.assertFalse(fix.decide(*args)[0])

    def test_a_person_may_start_a_second_attempt(self):
        self.assertTrue(fix.decide(alarm(comments=(fix.MARK,)), [], True)[0])


class WhatTheAlarmIsTold(unittest.TestCase):
    OK = {"RUN_URL": "u", "FIX": "success", "OPEN": "success", "OUTCOME": "pr", "PR": "1001",
          "REVIEW": "success", "VERDICT": "PASS", "LAND": "success"}

    def test_a_pass_merges_on_the_checks(self):
        text, label = fix.report_text(self.OK)
        self.assertIn("#1001", text)
        self.assertIn("Auto-merge is on", text)
        self.assertIsNone(label)

    def test_nothing_else_says_it_merges(self):
        for change in ({"VERDICT": "FAIL"}, {"VERDICT": "NONE"}, {"VERDICT": ""},
                       {"LAND": "failure"}, {"REVIEW": "failure"}, {"PR": ""},
                       {"OPEN": "failure"}, {"FIX": "failure"}, {"FIX": "cancelled"}):
            with self.subTest(change=change):
                text, label = fix.report_text({**self.OK, **change})
                self.assertNotIn("Auto-merge is on", text)
                self.assertIsNone(label)

    def test_a_hold_is_a_decision(self):
        text, label = fix.report_text({**self.OK, "OUTCOME": "hold", "PR": ""}, "Which source?")
        self.assertTrue(text.startswith("**Decision needed:** Which source?"))
        self.assertEqual(label, "decision")

    def test_a_hold_with_no_question_labels_nothing(self):
        self.assertIsNone(fix.report_text({**self.OK, "OUTCOME": "hold", "PR": ""}, " ")[1])


class TheReviewersReply(unittest.TestCase):
    def run_on(self, content):
        d = tempfile.mkdtemp()
        self.addCleanup(lambda: __import__("shutil").rmtree(d))
        log, out = os.path.join(d, "log.json"), os.path.join(d, "out.md")
        if content is not None:
            with open(log, "w", encoding="utf-8") as f:
                f.write(content)
        fix.findings(log, out)
        with open(out, encoding="utf-8") as f:
            return f.read()

    def test_the_last_reply(self):
        log = json.dumps([{"type": "assistant"}, {"type": "result", "result": "first"},
                          {"type": "result", "result": "verify.py:12 too wide"}])
        self.assertEqual(self.run_on(log), "verify.py:12 too wide\n")

    def test_no_reply_is_said_so(self):
        for content in (None, "not json", "[]", json.dumps([{"type": "result", "result": 5}])):
            with self.subTest(content=content):
                self.assertIn("could not be read", self.run_on(content))


class NoJobThatRunsTheAgentHoldsAWriteToken(unittest.TestCase):
    """AF-78, held for the fixer: read from the workflow, job by job."""

    AGENT = "anthropics/claude-code-action@"

    def jobs(self):
        with open(os.path.join(ROOT, ".github", "workflows", "fix-refresh.yml"), encoding="utf-8") as f:
            text = f.read().split("\njobs:\n", 1)[1]
        parts = re.split(r"(?m)^  ([A-Za-z0-9_-]+):\n", "\n" + text)
        return {k: "\n".join(line for line in v.splitlines() if not line.lstrip().startswith("#"))
                for k, v in zip(parts[1::2], parts[2::2])}

    def test_the_jobs_are_still_there(self):
        self.assertEqual(sorted(self.jobs()), ["fix", "gate", "land", "open", "report", "review"])

    def test_the_agent_jobs_hold_nothing_that_writes(self):
        agents = [n for n, body in self.jobs().items() if self.AGENT in body]
        self.assertEqual(sorted(agents), ["fix", "review"])
        for name in agents:
            body = self.jobs()[name]
            with self.subTest(job=name):
                self.assertNotRegex(body, r"create-github-app-token|REFRESH_APP|steps\.app\.")
                writes = re.findall(r"(?m)^\s+([a-z-]+): write\b", body)
                self.assertEqual(writes, ["id-token"])
                self.assertNotRegex(body, r"bypassPermissions|dangerously|--permission-mode")
                self.assertIn('--disallowedTools "Bash(npm:*),Bash(npx:*)', body)
                self.assertNotRegex(body, r"(?m)^\s+run:.*\bnpm\b")

    def test_the_jobs_with_the_app_run_no_agent_and_no_package_manager(self):
        app = [n for n, body in self.jobs().items() if "create-github-app-token" in body]
        self.assertEqual(sorted(app), ["gate", "land", "open"])
        for name in app:
            body = self.jobs()[name]
            with self.subTest(job=name):
                self.assertNotIn(self.AGENT, body)
                self.assertNotRegex(body, r"\b(?:npm|npx|node|pip)\b")

    def test_every_checkout_persists_no_credential(self):
        for name, body in self.jobs().items():
            with self.subTest(job=name):
                self.assertEqual(body.count("actions/checkout@"), body.count("persist-credentials: false"))

    def test_merge_is_for_the_reviewed_head_on_a_pass_only(self):
        land = self.jobs()["land"]
        self.assertIn('--match-head-commit "$SHA"', land)
        self.assertRegex(land, r'if \[ "\$VERDICT" = PASS \]; then\s+gh pr merge')
        self.assertEqual(land.count("gh pr merge"), 1)


if __name__ == "__main__":
    unittest.main()
