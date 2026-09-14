"""What the queue scripts may answer from cache, and what they must not.

WHY THIS FILE EXISTS
    `next.py` read the whole board and every open issue on every run, and
    `file.py` spent four GitHub calls on each status change. On 2026-09-14
    that tripped GitHub's secondary rate limiter — the one `/rate_limit` does
    not report, which refuses every GraphQL call while it is active — and
    grouping made it worse, because each issue of a group needs a status on
    the way in and another on the way out.

    A cache fixes the volume and introduces a worse failure than the one it
    cures: a write aimed at a stale id, or a fork taking an item another fork
    already holds. So the rule these tests hold is not "the cache is used"
    but "the cache is never trusted where being wrong would cost something":
    picking the next item always reads GitHub, and every cached id is
    re-read the moment GitHub disagrees with it.
"""
import importlib.util
import os
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOOP = os.path.join(ROOT, ".claude", "skills", "backlog-loop")


def load_script(name):
    spec = importlib.util.spec_from_file_location(f"backlog_{name}", os.path.join(LOOP, f"{name}.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


file_py = load_script("file")
next_py = load_script("next")
loop_cache = file_py.loop_cache

BOARD = {"id": "PVT_1"}
FIELDS = {"fields": [{"name": "Status", "id": "F_status",
                      "options": [{"name": n, "id": f"O_{n}"} for n in
                                  ("Now", "Next", "Someday", "In progress", "Done")]}]}


class FakeGh:
    """`gh` as file.py calls it, counting what it was asked for."""

    def __init__(self, items=(291, 292), reject=()):
        self.items = {n: f"I_{n}" for n in items}
        self.reject = set(reject)      # item ids item-edit refuses, as a stale id would be
        self.calls = []
        self.fields = FIELDS

    def __call__(self, *args, as_json=False, must=True):
        self.calls.append(args[:2])
        head = args[:2]
        if head == ("project", "view"):
            return BOARD
        if head == ("project", "field-list"):
            return self.fields
        if head == ("project", "item-list"):
            return {"items": [{"id": i, "content": {"number": n}} for n, i in self.items.items()]}
        if head == ("project", "item-add"):
            number = int(args[args.index("--url") + 1].rsplit("/", 1)[1])
            self.items[number] = f"I_{number}"
            return {"id": self.items[number]}
        if head == ("project", "item-edit"):
            item = args[args.index("--id") + 1]
            if item in self.reject:
                if not must:
                    return None
                raise SystemExit("gh: could not resolve item")
            self.edited = item
            return ""
        raise AssertionError(f"unexpected gh call {args}")

    def count(self, verb):
        return sum(1 for c in self.calls if c[1] == verb)


class CacheIsolated(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.addCleanup(setattr, loop_cache, "DIR", loop_cache.DIR)
        loop_cache.DIR = self.tmp.name


class SettingAStatus(CacheIsolated):
    def use(self, fake):
        self.addCleanup(setattr, file_py, "gh", file_py.gh)
        file_py.gh = fake

    def test_the_expensive_reads_happen_once_not_once_per_status(self):
        # A group of four costs eight status changes. Before the cache each
        # one re-read the project, its fields and up to 1000 board items.
        fake = FakeGh(items=(1, 2, 3, 4))
        self.use(fake)
        for number in (1, 2, 3, 4):
            file_py.set_status(number, "In progress")
        for number in (1, 2, 3, 4):
            file_py.set_status(number, "Done")
        self.assertEqual(fake.count("view"), 1)
        self.assertEqual(fake.count("field-list"), 1)
        self.assertEqual(fake.count("item-list"), 1)
        self.assertEqual(fake.count("item-edit"), 8)   # the writes themselves are untouched

    def test_a_stale_item_id_is_re_read_and_the_write_lands_on_the_right_item(self):
        # The cache says I_291; GitHub no longer knows it. The write must not
        # be lost and must not go to the wrong item.
        loop_cache.write("items", {"291": "I_stale"})
        loop_cache.write("board", {"project": "PVT_1", "field": "F_status",
                                   "options": {n: f"O_{n}" for n in file_py.STATUSES}})
        fake = FakeGh(items=(291,), reject=("I_stale",))
        self.use(fake)
        file_py.set_status(291, "Done")
        self.assertEqual(fake.edited, "I_291")
        self.assertEqual(fake.count("item-list"), 1)   # it went and looked

    def test_a_status_the_cached_board_does_not_know_refetches_it(self):
        loop_cache.write("board", {"project": "PVT_1", "field": "F_status",
                                   "options": {"Now": "O_Now"}})
        fake = FakeGh(items=(291,))
        self.use(fake)
        file_py.set_status(291, "Done")
        self.assertEqual(fake.edited, "I_291")
        self.assertEqual(fake.count("view"), 1)

    def test_a_failure_that_is_not_staleness_still_ends_the_run(self):
        fake = FakeGh(items=(291,), reject=("I_291",))
        self.use(fake)
        with self.assertRaises(SystemExit):
            file_py.set_status(291, "Done")

    def test_an_issue_not_on_the_board_is_added_and_the_map_dropped(self):
        fake = FakeGh(items=(291,))
        self.use(fake)
        file_py.set_status(999, "Next")
        self.assertEqual(fake.count("item-add"), 1)
        self.assertEqual(fake.edited, "I_999")
        self.assertIsNone(loop_cache.read("items", file_py.ITEMS_TTL))

    def test_a_status_the_board_will_never_have_is_refused_before_any_call(self):
        fake = FakeGh()
        self.use(fake)
        with self.assertRaises(SystemExit):
            file_py.set_status(291, "Somewhen")
        self.assertEqual(fake.calls, [])


class ReadingTheQueue(CacheIsolated):
    def use(self, calls):
        def fake(*args):
            calls.append(args[0])
            if args[0] == "project":
                return {"items": []}
            return []
        self.addCleanup(setattr, next_py, "gh", next_py.gh)
        next_py.gh = fake

    def test_choosing_the_next_item_always_reads_github(self):
        # The collision the *In progress* status exists to prevent: two forks
        # taking the same item because one read a board from two minutes ago.
        calls = []
        self.use(calls)
        next_py.load()
        next_py.load()
        self.assertEqual(calls.count("project"), 2)

    def test_a_call_that_names_its_items_may_use_the_cache(self):
        calls = []
        self.use(calls)
        next_py.load()                       # `next.py --group` populates it
        next_py.load(allow_cache=True)       # `next.py VD-33 AX-13` reads bodies
        self.assertEqual(calls.count("project"), 1)

    def test_a_cache_older_than_the_ttl_is_a_miss(self):
        calls = []
        self.use(calls)
        next_py.load()
        blob = loop_cache.read("queue", next_py.CACHE_TTL)
        self.assertIsNotNone(blob)
        loop_cache.write("queue", blob)
        import json
        with open(loop_cache.path("queue"), encoding="utf-8") as f:
            aged = json.load(f)
        aged["at"] -= next_py.CACHE_TTL + 1
        with open(loop_cache.path("queue"), "w", encoding="utf-8") as f:
            json.dump(aged, f)
        next_py.load(allow_cache=True)
        self.assertEqual(calls.count("project"), 2)


class TheWiring(CacheIsolated):
    """`load()` takes the decision as an argument, so testing it alone leaves
    the decision itself - which argv may use the cache - unproven."""

    ROWS = [(1, "Now", "AF-01: A thing.", "S"), (2, "Next", "AF-02: Another.", "S")]

    def setUp(self):
        super().setUp()
        self.calls = []

        def fake(*args):
            self.calls.append(args[0])
            if args[0] == "project":
                return {"items": [{"status": st, "content": {"type": "Issue", "number": n}}
                                  for n, st, _, _ in self.ROWS]}
            return [{"number": n, "title": t, "body": "b", "labels": [{"name": f"size: {z}"}],
                     "url": f"https://example.invalid/{n}"} for n, _, t, z in self.ROWS]

        self.addCleanup(setattr, next_py, "gh", next_py.gh)
        next_py.gh = fake

    def run_main(self, argv):
        import contextlib
        import io
        with contextlib.redirect_stdout(io.StringIO()):
            next_py.main(argv)

    def reads(self):
        return self.calls.count("project")

    def test_a_bare_call_and_group_choose_an_item_so_never_cache(self):
        self.run_main([])
        self.run_main(["--group"])
        self.assertEqual(self.reads(), 2)

    def test_listing_a_status_is_not_cached_either(self):
        self.run_main([])
        self.run_main(["--list", "Now"])
        self.assertEqual(self.reads(), 2)

    def test_naming_items_reads_the_cache_the_choosing_call_left(self):
        self.run_main(["--group"])
        self.run_main(["AF-01", "AF-02"])
        self.assertEqual(self.reads(), 1)


class TheCacheItself(CacheIsolated):
    def test_an_unreadable_or_corrupt_file_is_a_miss_not_a_crash(self):
        with open(loop_cache.path("queue"), "w", encoding="utf-8") as f:
            f.write("{not json")
        self.assertIsNone(loop_cache.read("queue", 60))

    def test_a_directory_that_cannot_be_written_is_a_slower_run(self):
        loop_cache.DIR = "/dev/null/nowhere"
        loop_cache.write("queue", {"a": 1})          # must not raise
        self.assertIsNone(loop_cache.read("queue", 60))
        loop_cache.drop("queue")                     # must not raise


if __name__ == "__main__":
    unittest.main()
