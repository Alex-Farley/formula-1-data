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
import contextlib
import importlib.util
import io
import json
import os
import tempfile
import unittest
from unittest import mock

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

    def __init__(self, items=(291, 292), reject=(), error="could not resolve to a node",
                 die_on=None, auto_added=(), add_error=None, lagging=False, batch="answers"):
        self.items = {n: f"I_{n}" for n in items}
        # How the one-request status write answers: "answers" sets every item
        # it is not told to reject and says so alias by alias; "unreadable"
        # fails with no body; anything else is the stderr of a refusal with
        # no body, as the limiter gives.
        self.batch = batch
        self.mutations = []            # the -f fields of each one-request write
        self.batched = []              # item ids a one-request write set
        self.reject = set(reject)      # item ids item-edit refuses, as a stale id would be
        self.error = error
        # Issues the project's auto-add puts on the board just before
        # file.py's item-add, which GitHub then refuses as a duplicate.
        self.auto_added = set(auto_added)
        self.add_error = add_error     # any other refusal of item-add
        self.lagging = lagging         # item-list does not yet show what auto-add added
        self.die_on = die_on           # (verb, nth): that call ends the run, as gh() does
        self.calls = []
        self.fields = FIELDS

    def try_(self, *args, out=False):
        """`gh_try`: (succeeded, stderr), or with `out` (succeeded, stderr, stdout)."""
        self.calls.append(args[:2])
        if args[:2] == ("api", "graphql"):
            fields = dict(args[k + 1].split("=", 1) for k, a in enumerate(args) if a == "-f")
            self.mutations.append(fields)
            if self.batch == "unreadable":
                return False, "connection reset by peer", ""
            if self.batch != "answers":
                return False, self.batch, ""
            data, errors = {}, []
            for key, item in fields.items():
                if key[:1] == "i" and key[1:].isdigit():
                    if item in self.reject:
                        data[f"s{key[1:]}"] = None
                        errors.append({"path": [f"s{key[1:]}"], "message": self.error})
                    else:
                        data[f"s{key[1:]}"] = {"projectV2Item": {"id": item}}
                        self.batched.append(item)
            body = {"data": data, **({"errors": errors} if errors else {})}
            return not errors, (f"gh: {self.error}" if errors else ""), json.dumps(body)
        if args[:2] == ("project", "item-add"):
            number = int(args[args.index("--url") + 1].rsplit("/", 1)[1])
            if self.add_error:
                return False, self.add_error, ""
            if number in self.auto_added:
                if not self.lagging:
                    self.items[number] = f"I_{number}"
                return False, "Content already exists in this project (addProjectV2ItemById)", ""
            self.items[number] = f"I_{number}"
            return True, "", json.dumps({"id": self.items[number]})
        item = args[args.index("--id") + 1]
        if item in self.reject:
            return False, self.error
        self.edited = item
        return True, ""

    def __call__(self, *args, as_json=False):
        self.calls.append(args[:2])
        head = args[:2]
        if self.die_on and head[1] == self.die_on[0] and self.count(head[1]) == self.die_on[1]:
            raise SystemExit(f"gh {head[1]}: refused")
        if head == ("project", "view"):
            return BOARD
        if head == ("project", "field-list"):
            return self.fields
        if head == ("project", "item-list"):
            return {"items": [{"id": i, "content": {"number": n}} for n, i in self.items.items()]}
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
        self.addCleanup(setattr, file_py, "gh_try", file_py.gh_try)
        file_py.gh = fake
        file_py.gh_try = fake.try_
        # gh_failed asks gh_preflight.unauthenticated(), which is a real
        # `gh auth status` that the secondary limiter counts.
        preflight = file_py.gh_preflight
        self.addCleanup(setattr, preflight, "unauthenticated", preflight.unauthenticated)
        preflight.unauthenticated = lambda: False

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

    def test_a_failure_that_survives_a_refetch_ends_the_run(self):
        fake = FakeGh(items=(291,), reject=("I_291",))
        self.use(fake)
        with self.assertRaises(SystemExit):
            file_py.set_status(291, "Done")
        self.assertEqual(fake.count("item-edit"), 2)      # it tried against fresh ids

    def test_ids_a_run_suspected_and_could_not_recheck_are_not_inherited(self):
        # The one thing the drop between attempts buys: the edit failed, so
        # the ids are suspect, and the refetch that would have confirmed them
        # died too. The next process must start from GitHub, not from these.
        loop_cache.write("items", {"291": "I_stale"})
        fake = FakeGh(items=(291,), reject=("I_stale",), die_on=("item-list", 1))
        self.use(fake)
        with self.assertRaises(SystemExit):
            file_py.set_status(291, "Done")
        self.assertIsNone(loop_cache.read("items", file_py.ITEMS_TTL))

    def test_a_rate_limit_stops_at_once_instead_of_replaying_every_call(self):
        # The failure the cache exists to avoid. Retrying extends it, and the
        # uncached code stopped at the first refusal.
        fake = FakeGh(items=(291,), reject=("I_291",),
                      error="GraphQL: API rate limit already exceeded for user ID 37551336.")
        self.use(fake)
        with self.assertRaises(SystemExit):
            file_py.set_status(291, "Done")
        self.assertEqual(fake.count("item-edit"), 1)
        self.assertEqual(fake.count("item-list"), 1)

    def test_a_payload_of_the_wrong_shape_is_a_miss_not_a_traceback(self):
        # .claude/loop survives a branch switch, so a payload written by
        # another version of these scripts must not crash them for a whole
        # TTL - and every `file.py status` failing for fifteen minutes is how
        # a group's issues end up stuck at In progress.
        for items in (["not", "a", "map"],                       # not a dict
                      {"project": "PVT_1", "options": {}},       # the board's payload
                      {"291": {"id": "I_291"}}):                 # right keys, wrong values
            loop_cache.write("board", {"unexpected": True})
            loop_cache.write("items", items)
            fake = FakeGh(items=(291,))
            self.use(fake)
            file_py.set_status(291, "Done")
            self.assertEqual(fake.edited, "I_291", items)

    def test_a_status_change_drops_the_queue_the_next_read_would_have_reused(self):
        # next.py's cache holds the status this call just changed, and the
        # *In progress elsewhere* footer an inheriting fork reads is built
        # from it.
        loop_cache.write("queue", {"ranked": [], "in_progress": [], "unplaced": []})
        fake = FakeGh(items=(291,))
        self.use(fake)
        file_py.set_status(291, "In progress")
        self.assertIsNone(loop_cache.read("queue", 3600))

    def test_a_board_a_run_suspected_and_could_not_recheck_is_not_inherited(self):
        # The other half of the drop pair: the edit failed, so the ids are
        # suspect, and the refetch died at its first call.
        loop_cache.write("board", {"project": "PVT_1", "field": "F_status",
                                   "options": {n: f"O_{n}" for n in file_py.STATUSES}})
        loop_cache.write("items", {"291": "I_stale"})
        fake = FakeGh(items=(291,), reject=("I_stale",), die_on=("view", 1))
        self.use(fake)
        with self.assertRaises(SystemExit):
            file_py.set_status(291, "Done")
        self.assertIsNone(loop_cache.read("board", file_py.BOARD_TTL))

    def test_an_issue_not_on_the_board_is_added_and_the_map_dropped(self):
        fake = FakeGh(items=(291,))
        self.use(fake)
        file_py.set_status(999, "Next")
        self.assertEqual(fake.count("item-add"), 1)
        self.assertEqual(fake.edited, "I_999")
        self.assertIsNone(loop_cache.read("items", file_py.ITEMS_TTL))

    def test_an_issue_the_boards_auto_add_got_to_first_still_gets_its_status(self):
        # CR-92: `file.py new` on #1023 created the issue, the project's
        # auto-add put it on the board, and the item-add GitHub then refused
        # as a duplicate ended the run with the issue on no status.
        fake = FakeGh(items=(291,), auto_added=(1023,))
        self.use(fake)
        file_py.set_status(1023, "Someday")
        self.assertEqual(fake.count("item-add"), 1)       # not added twice
        self.assertEqual(fake.count("item-list"), 2)      # it went and looked
        self.assertEqual(fake.edited, "I_1023")

    def test_any_other_refusal_of_an_add_ends_the_run_at_once(self):
        fake = FakeGh(items=(291,), add_error="GraphQL: API rate limit already exceeded for user ID 1.")
        self.use(fake)
        with self.assertRaises(SystemExit):
            file_py.set_status(1023, "Someday")
        self.assertEqual(fake.count("item-add"), 1)
        self.assertEqual(fake.count("item-list"), 1)
        self.assertEqual(fake.count("item-edit"), 0)

    def test_a_duplicate_refusal_that_is_also_a_rate_limit_is_not_retried(self):
        fake = FakeGh(items=(291,), add_error=(
            "Content already exists in this project; API rate limit already exceeded for user ID 1."))
        self.use(fake)
        with self.assertRaises(SystemExit):
            file_py.set_status(1023, "Someday")
        self.assertEqual(fake.count("item-add"), 1)
        self.assertEqual(fake.count("item-list"), 1)

    def test_a_board_that_has_not_caught_up_says_the_issue_has_no_status(self):
        fake = FakeGh(items=(291,), auto_added=(1023,), lagging=True)
        self.use(fake)
        with self.assertRaises(SystemExit) as stopped:
            file_py.set_status(1023, "Someday")
        self.assertEqual(fake.count("item-add"), 2)       # once per pass, no more
        self.assertEqual(fake.count("item-edit"), 0)
        self.assertIn('file.py status 1023 "Someday"', str(stopped.exception.code))

    def test_a_status_the_board_will_never_have_is_refused_before_any_call(self):
        fake = FakeGh()
        self.use(fake)
        with self.assertRaises(SystemExit):
            file_py.set_status(291, "Somewhen")
        self.assertEqual(fake.calls, [])


class SettingAGroupsStatus(CacheIsolated):
    """PM-45: a group's statuses in one request each way, and never an issue
    left at an old status without the run saying which."""
    use = SettingAStatus.use

    def run_(self, numbers, status="In progress"):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            try:
                file_py.set_statuses(numbers, status)
            finally:
                self.printed = out.getvalue().split("\n")
        return self.printed

    def test_a_group_of_four_is_one_write_not_four(self):
        fake = FakeGh(items=(1, 2, 3, 4))
        self.use(fake)
        printed = self.run_([1, 2, 3, 4])
        self.assertEqual(len(fake.mutations), 1)
        self.assertEqual(fake.count("item-edit"), 0)
        self.assertEqual(sorted(fake.batched), ["I_1", "I_2", "I_3", "I_4"])
        self.assertEqual(printed[:4], [f"#{n} In progress" for n in (1, 2, 3, 4)])
        self.assertEqual(fake.mutations[0]["option"], "O_In progress")

    def test_the_ids_are_variables_never_query_text(self):
        fake = FakeGh(items=(1, 2))
        self.use(fake)
        self.run_([1, 2])
        query = fake.mutations[0]["query"]
        self.assertNotIn("I_1", query)
        self.assertEqual(query.count("updateProjectV2ItemFieldValue"), 2)

    def test_a_half_done_batch_writes_only_the_unconfirmed_issue_again(self):
        # GraphQL answers 200 with errors beside the data it managed.
        loop_cache.write("items", {"1": "I_1", "2": "I_stale", "3": "I_3"})
        fake = FakeGh(items=(1, 2, 3), reject=("I_stale",))
        self.use(fake)
        printed = self.run_([1, 2, 3])
        self.assertEqual(sorted(fake.batched), ["I_1", "I_3"])
        self.assertEqual(fake.count("item-edit"), 1)
        self.assertEqual(fake.edited, "I_2")              # against a fresh id
        self.assertEqual(sorted(printed[:3]), [f"#{n} In progress" for n in (1, 2, 3)])

    def test_an_answer_that_cannot_be_read_confirms_nothing(self):
        fake = FakeGh(items=(1, 2, 3), batch="unreadable")
        self.use(fake)
        printed = self.run_([1, 2, 3])
        self.assertEqual(fake.count("item-edit"), 3)      # each written alone
        self.assertEqual(printed[:3], [f"#{n} In progress" for n in (1, 2, 3)])

    def test_the_limiter_refusing_the_batch_ends_the_run_naming_every_issue(self):
        fake = FakeGh(items=(1, 2, 3), batch="GraphQL: was submitted too quickly (secondary rate limit)")
        self.use(fake)
        with self.assertRaises(SystemExit) as stopped:
            self.run_([1, 2, 3])
        self.assertEqual(fake.count("item-edit"), 0)      # retrying extends it
        said = str(stopped.exception.code)
        self.assertIn("#1, #2, #3", said)
        self.assertIn('file.py status 1 2 3 "In progress"', said)
        self.assertIn("once the limiter has cleared", said)

    def test_a_failure_one_at_a_time_names_what_is_not_yet_set(self):
        # #2's fallback write fails against fresh ids too; #1 is confirmed,
        # #2 and #3 are not, and the run says so.
        loop_cache.write("items", {"1": "I_1", "2": "I_2", "3": "I_3"})
        fake = FakeGh(items=(1, 2, 3), reject=("I_2",))
        fake.batch = "answers"
        self.use(fake)
        with self.assertRaises(SystemExit) as stopped:
            self.run_([2, 1, 3])
        self.assertEqual(self.printed[:2], ["#1 In progress", "#3 In progress"])
        self.assertIn("not confirmed", str(stopped.exception.code))
        self.assertIn("#2;", str(stopped.exception.code))

    def test_one_issue_is_the_one_issue_path(self):
        fake = FakeGh(items=(1,))
        self.use(fake)
        self.assertEqual(self.run_([1, 1], "Done")[0], "#1 Done")   # named twice, written once
        self.assertEqual(fake.mutations, [])
        self.assertEqual(fake.count("item-edit"), 1)

    def test_an_issue_off_the_board_is_added_alone_and_the_rest_batched(self):
        fake = FakeGh(items=(1, 2))
        self.use(fake)
        printed = self.run_([1, 2, 999])
        self.assertEqual(sorted(fake.batched), ["I_1", "I_2"])
        self.assertEqual(fake.count("item-add"), 1)
        self.assertEqual(fake.edited, "I_999")
        self.assertEqual(printed[:3], ["#1 In progress", "#2 In progress", "#999 In progress"])

    def test_a_bad_status_is_refused_before_any_call(self):
        fake = FakeGh(items=(1, 2))
        self.use(fake)
        with self.assertRaises(SystemExit):
            self.run_([1, 2], "Somewhen")
        self.assertEqual(fake.calls, [])

    def test_the_command_line_takes_several_numbers_then_the_status(self):
        seen = []
        with mock.patch.object(file_py, "set_statuses", lambda ns, s: seen.append((ns, s))), \
                mock.patch("sys.argv", ["file.py", "status", "451", "450", "In progress"]):
            file_py.main()
        self.assertEqual(seen, [([451, 450], "In progress")])


class ReadingTheQueue(CacheIsolated):
    def use(self, calls):
        def fake(*args):
            calls.append(args[0])
            return []

        def fake_board():
            calls.append("board")
            return []
        self.addCleanup(setattr, next_py, "gh", next_py.gh)
        self.addCleanup(setattr, next_py, "board_rows", next_py.board_rows)
        next_py.gh = fake
        next_py.board_rows = fake_board

    def test_choosing_the_next_item_always_reads_github(self):
        # The collision the *In progress* status exists to prevent: two forks
        # taking the same item because one read a board from two minutes ago.
        calls = []
        self.use(calls)
        next_py.load()
        next_py.load()
        self.assertEqual(calls.count("board"), 2)

    def test_a_call_that_names_its_items_may_use_the_cache(self):
        calls = []
        self.use(calls)
        next_py.load()                       # `next.py --group` populates it
        next_py.load(allow_cache=True)       # `next.py VD-33 AX-13` reads bodies
        self.assertEqual(calls.count("board"), 1)

    def test_a_queue_payload_of_the_wrong_shape_is_a_miss_not_a_traceback(self):
        # .claude/loop survives a branch switch, so a payload written by an
        # older version of these scripts must not crash the next one.
        calls = []
        self.use(calls)
        loop_cache.write("queue", {"rows": []})
        next_py.load(allow_cache=True)
        self.assertEqual(calls.count("board"), 1)

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
        self.assertEqual(calls.count("board"), 2)


class TheWiring(CacheIsolated):
    """`load()` takes the decision as an argument, so testing it alone leaves
    the decision itself - which argv may use the cache - unproven."""

    ROWS = [(1, "Now", "AF-01: A thing.", "S"), (2, "Next", "AF-02: Another.", "S")]

    def setUp(self):
        super().setUp()
        self.calls = []

        def fake(*args):
            self.calls.append(args[0])
            if args[:2] == ("issue", "view"):
                return {"body": "b"}        # `one_body`, on the bare call
            return [{"number": n, "title": t, "body": "b", "labels": [{"name": f"size: {z}"}],
                     "url": f"https://example.invalid/{n}"} for n, _, t, z in self.ROWS]

        def fake_board():
            self.calls.append("board")
            return [(n, st) for n, st, _, _ in self.ROWS]

        self.addCleanup(setattr, next_py, "gh", next_py.gh)
        self.addCleanup(setattr, next_py, "board_rows", next_py.board_rows)
        next_py.gh = fake
        next_py.board_rows = fake_board

    def run_main(self, argv):
        import contextlib
        import io
        with contextlib.redirect_stdout(io.StringIO()):
            next_py.main(argv)

    def reads(self):
        return self.calls.count("board")

    def test_a_bare_call_and_group_choose_an_item_so_never_cache(self):
        # Both arms of the decision, each against a cache the previous call
        # populated - a bare call that reused it would hand a fork an item
        # another fork took inside the TTL.
        self.run_main([])
        self.run_main([])
        self.run_main(["--group"])
        self.run_main(["--group"])
        self.assertEqual(self.reads(), 4)

    def test_listing_a_status_is_not_cached_either(self):
        self.run_main([])
        self.run_main(["--list", "Now"])
        self.assertEqual(self.reads(), 2)

    def test_naming_items_reads_the_cache_the_choosing_call_left(self):
        self.run_main(["--group"])
        self.run_main(["AF-01", "AF-02"])
        self.assertEqual(self.reads(), 1)

    def test_group_with_an_id_still_chooses_so_still_reads_github(self):
        # `--group` is stripped from argv before the cache decision, so the id
        # form looks like "a call that names its items" and is not: it scores
        # every candidate on the board, and a two-minute-old board can hand a
        # fork an item another fork set In progress inside that window.
        self.run_main(["--group"])
        self.run_main(["--group", "AF-01"])
        self.assertEqual(self.reads(), 2)


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


class AGhFailure(unittest.TestCase):
    def ending(self, said, unauthenticated):
        preflight = file_py.gh_preflight
        self.addCleanup(setattr, preflight, "unauthenticated", preflight.unauthenticated)
        preflight.unauthenticated = unauthenticated
        with self.assertRaises(SystemExit) as caught:
            file_py.gh_failed(said)
        return str(caught.exception.code)

    def test_a_limiter_refusal_spends_no_call_asking_about_the_credential(self):
        # CR-95: `unauthenticated()` is a `gh auth status` the limiter counts,
        # and it answers "no credential" against the limiter whatever the
        # truth. The stub raises if it is called; the message is the proof.
        def asked():
            raise AssertionError("spent a call on a refused API")
        said = self.ending("You have exceeded a secondary rate limit", asked)
        self.assertTrue(said.startswith("You have exceeded a secondary rate limit\n"))
        self.assertIn("extends the refusal", said)
        self.assertNotIn(file_py.gh_preflight.UNAUTH, said)

    def test_any_other_failure_still_asks_and_names_the_credential(self):
        calls = []
        said = self.ending("HTTP 401: Bad credentials",
                           lambda: calls.append(1) or True)
        self.assertEqual(calls, [1])
        self.assertIn(file_py.gh_preflight.UNAUTH, said)
        self.assertNotIn("extends the refusal", said)


if __name__ == "__main__":
    unittest.main()
