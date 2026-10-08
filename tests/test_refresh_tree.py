"""What may cross from refresh.yml's build job to the job that lands it (AF-78).

WHY THIS FILE EXISTS
    The job that builds and tests a refresh runs npm, so it holds no token
    that writes; `land` holds the token and runs no npm, and takes the
    build's changes only through .github/scripts/refresh_tree.py. That
    script is the whole of the boundary, so these tests are about what it
    refuses: a path a refresh does not write, a dated file changed beyond
    its date, a document changed outside its figure spans, a symlink, a
    file the list does not name. And about what it must let through, read
    against the real files, so a refresh is never refused for being one.

    The last class reads the workflow: no job that runs npm may hold the
    App's key or token, which is the rule the split exists to keep.

    python3 -m unittest tests.test_refresh_tree
"""
import importlib.util
import os
import re
import shutil
import subprocess
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location(
    "refresh_tree", os.path.join(ROOT, ".github", "scripts", "refresh_tree.py"))
tree = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tree)
tree.print = lambda *args, **kwargs: None  # its one-line reports, for the workflow log


DATED = ("build.py", "web/src/lib/refresh.js")


def real(path):
    with open(os.path.join(ROOT, path), "rb") as f:
        return f.read()


def stamped(path, day="2099-12-31"):
    """The file as refresh.yml's sed leaves it on `day`."""
    text = real(path).decode("utf-8")
    if path == "build.py":
        return re.sub(r'(?m)^BUILT = ".*"$', f'BUILT = "{day}"', text).encode()
    return re.sub(r"(?m)^export const LAST_CHECKED = '.*'$",
                  f"export const LAST_CHECKED = '{day}'", text).encode()


class WhatARefreshChangesIsLetThrough(unittest.TestCase):
    def test_the_dated_lines_as_the_workflow_writes_them(self):
        for path in DATED:
            with self.subTest(path=path):
                self.assertNotEqual(stamped(path), real(path))
                self.assertIsNone(tree.problem(path, stamped(path), real(path)))

    def test_a_document_whose_figures_moved(self):
        for path in tree.DOCUMENTS:
            text = real(path).decode("utf-8")
            moved, n = tree.readme_figures.SPAN.subn(
                lambda m: f"<!-- fig:{m.group(1)} -->999,999<!-- /fig -->", text)
            with self.subTest(path=path):
                self.assertGreater(n, 0, "no figure spans; is this still a document the tool writes?")
                self.assertIsNone(tree.problem(path, moved.encode(), real(path)))

    def test_the_harvest_and_the_artefacts_whole(self):
        for path in ("harvest/race_results.txt", "harvest/a_new_file.txt", *tree.ARTEFACTS):
            with self.subTest(path=path):
                self.assertIsNone(tree.problem(path, b"anything", None if "new" in path else b"x"))


class WhatARefreshDoesNotChangeIsRefused(unittest.TestCase):
    def test_any_other_path(self):
        for path in (".github/scripts/land-refresh.sh", ".git/hooks/pre-push", "harvest/append.py",
                     "harvest/../build.py", "harvest/sub/x.txt", "web/package.json", "verify.py",
                     "README.md.orig", "/f1.db"):
            with self.subTest(path=path):
                self.assertIsNotNone(tree.problem(path, b"x", b"x"))

    def test_a_dated_file_changed_beyond_its_date(self):
        for path in DATED:
            with self.subTest(path=path):
                self.assertIsNotNone(tree.problem(path, stamped(path) + b"\nextra", real(path)))
                self.assertIsNotNone(tree.problem(path, stamped(path, "today"), real(path)))
                self.assertIsNotNone(tree.problem(path, stamped(path, "\u0662\u0660\u0669\u0669-01-01"), real(path)))
                self.assertIsNotNone(tree.problem(path, stamped(path), None))
                lines = stamped(path).split(b"\n")
                lines[0] += b" "
                self.assertIsNotNone(tree.problem(path, b"\n".join(lines), real(path)))

    def test_a_document_changed_outside_its_spans(self):
        text = real("README.md").decode("utf-8")
        self.assertIsNotNone(tree.problem("README.md", (text + "\nA new line.\n").encode(), real("README.md")))
        # A span closed early and reopened smuggles prose between the two.
        forged = tree.readme_figures.SPAN.sub(
            lambda m: f"<!-- fig:{m.group(1)} -->1<!-- /fig -->[x](https://e.example)"
                      f"<!-- fig:{m.group(1)} -->1<!-- /fig -->", text, count=1)
        self.assertIsNotNone(tree.problem("README.md", forged.encode(), real("README.md")))


class PackThenApply(unittest.TestCase):
    """The two halves end to end, on a scratch repository."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp)
        self.repo = os.path.join(self.tmp, "repo")
        for path in ("build.py", "web/src/lib/refresh.js", "harvest/races.txt", "f1.db"):
            dest = os.path.join(self.repo, path)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "wb") as f:
                f.write(real(path) if path in DATED else b"before\n")
        self.git("init", "-q")
        self.git("add", "-A")
        self.git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "base")
        self.clean = os.path.join(self.tmp, "clean")
        shutil.copytree(self.repo, self.clean, ignore=shutil.ignore_patterns(".git"))
        self.pack = os.path.join(self.tmp, "pack")

    def git(self, *args):
        subprocess.run(["git", *args], cwd=self.repo, check=True, capture_output=True)

    def write(self, path, data):
        dest = os.path.join(self.repo, path)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as f:
            f.write(data)

    def test_a_refresh_crosses_whole(self):
        for path in DATED:
            self.write(path, stamped(path))
        self.write("harvest/races.txt", b"after\n")
        self.write("harvest/new.txt", b"new\n")
        self.write("f1.db", b"after\n")
        tree.pack(self.pack, self.repo)
        tree.apply(self.pack, self.clean)
        for path in (*DATED, "harvest/races.txt", "harvest/new.txt", "f1.db"):
            with open(os.path.join(self.clean, path), "rb") as a, \
                 open(os.path.join(self.repo, path), "rb") as b:
                self.assertEqual(a.read(), b.read(), path)

    def test_a_quiet_morning_crosses_as_one_line(self):
        self.write("web/src/lib/refresh.js", stamped("web/src/lib/refresh.js"))
        tree.pack(self.pack, self.repo)
        with open(os.path.join(self.pack, tree.LIST)) as f:
            self.assertEqual([x for x in f.read().splitlines() if not x.startswith("#")],
                             ["web/src/lib/refresh.js"])

    def test_a_run_that_changed_nothing_crosses_as_nothing(self):
        # CR-78. Every quiet run after the day's first: the heartbeat is
        # already on main, so git status is empty. The pack is still made,
        # since upload-artifact refuses an empty directory, and lands as
        # nothing on a clean checkout.
        self.assertFalse(os.path.exists(self.pack))
        tree.pack(self.pack, self.repo)
        self.assertEqual(os.listdir(self.pack), [tree.LIST])
        with open(os.path.join(self.pack, tree.LIST)) as f:
            self.assertEqual([x for x in f.read().splitlines() if not x.startswith("#")], [])
        before = {p: real(p) if p in DATED else b"before\n"
                  for p in ("build.py", "web/src/lib/refresh.js", "harvest/races.txt", "f1.db")}
        tree.apply(self.pack, self.clean)
        for path, data in before.items():
            with open(os.path.join(self.clean, path), "rb") as f:
                self.assertEqual(f.read(), data, path)
        self.assertEqual(sorted(os.listdir(self.clean)), ["build.py", "f1.db", "harvest", "web"])

    def test_pack_refuses_a_path_a_refresh_does_not_write(self):
        self.write("web/package.json", b"{}\n")
        with self.assertRaises(SystemExit):
            tree.pack(self.pack, self.repo)

    def test_pack_refuses_a_deletion(self):
        os.remove(os.path.join(self.repo, "harvest/races.txt"))
        with self.assertRaises(SystemExit):
            tree.pack(self.pack, self.repo)

    def tampered(self, change):
        self.write("harvest/races.txt", b"after\n")
        tree.pack(self.pack, self.repo)
        change(os.path.join(self.pack, tree.TREE))
        with self.assertRaises(SystemExit):
            tree.apply(self.pack, self.clean)
        with open(os.path.join(self.clean, "harvest/races.txt"), "rb") as f:
            self.assertEqual(f.read(), b"before\n", "a refused pack applied part of itself")

    def test_apply_refuses_a_file_the_list_does_not_name(self):
        def add(t):
            os.makedirs(os.path.join(t, ".github/scripts"))
            with open(os.path.join(t, ".github/scripts/land-refresh.sh"), "w") as f:
                f.write("evil")
        self.tampered(add)

    def test_apply_refuses_a_symlink(self):
        self.tampered(lambda t: os.symlink("/etc/passwd", os.path.join(t, "harvest/races2.txt")))

    def test_apply_refuses_a_listed_path_it_does_not_allow(self):
        def relist(t):
            os.makedirs(os.path.join(t, "web"), exist_ok=True)
            with open(os.path.join(t, "web/package.json"), "w") as f:
                f.write("{}")
            with open(os.path.join(self.pack, tree.LIST), "a") as f:
                f.write("web/package.json\n")
        self.tampered(relist)


class NoJobThatRunsNpmHoldsTheToken(unittest.TestCase):
    """AF-78. Read from the workflow, job by job."""

    def jobs(self):
        with open(os.path.join(ROOT, ".github", "workflows", "refresh.yml"), encoding="utf-8") as f:
            text = f.read().split("\njobs:\n", 1)[1]
        parts = re.split(r"(?m)^  ([A-Za-z0-9_-]+):\n", "\n" + text)
        return dict(zip(parts[1::2], parts[2::2]))

    def code(self, body):
        return "\n".join(line for line in body.splitlines() if not line.lstrip().startswith("#"))

    def test_the_jobs_are_still_there(self):
        self.assertEqual(sorted(self.jobs()), ["gate", "land", "refresh", "report"])

    def test_no_job_that_runs_npm_holds_a_secret_or_the_app(self):
        npm = [name for name, body in self.jobs().items()
               if re.search(r"\b(?:npm|npx)\b", self.code(body))]
        self.assertTrue(npm, "no job runs npm; is this test still reading the workflow?")
        for name in npm:
            body = self.code(self.jobs()[name])
            with self.subTest(job=name):
                self.assertNotIn("secrets.", body)
                self.assertNotIn("create-github-app-token", body)
                self.assertNotIn("steps.app.", body)

    def test_the_jobs_that_hold_it_persist_no_credential(self):
        for name, body in self.jobs().items():
            body = self.code(body)
            if "create-github-app-token" not in body or "actions/checkout@" not in body:
                continue
            with self.subTest(job=name):
                self.assertEqual(body.count("actions/checkout@"), body.count("persist-credentials: false"))

    def test_report_writes_issues_and_nothing_else(self):
        # SD-35. The one job that holds a token that writes, other than
        # `land`: the workflow's own, scoped to issues, with no secret, no
        # App, no npm and nothing from the pack.
        body = self.code(self.jobs()["report"])
        self.assertIn("issues: write", body)
        self.assertNotRegex(body, r"contents: write|pull-requests: write|secrets\.|create-github-app-token")
        self.assertNotRegex(body, r"\b(?:npm|npx|node|pip|download-artifact)\b")
        self.assertEqual(body.count("actions/checkout@"), body.count("persist-credentials: false"))

    def test_land_runs_only_its_own_checkout(self):
        body = self.code(self.jobs()["land"])
        self.assertIn("refresh_tree.py apply", body)
        self.assertNotRegex(body, r"\b(?:npm|npx|node|pip)\b")
