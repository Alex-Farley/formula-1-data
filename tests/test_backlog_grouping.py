"""What `next.py --group` may and may not propose, on a fixed queue.

WHY THIS FILE EXISTS
    Grouping decides what rides into one pull request, and a wrong proposal
    is not a crash: it is two unrelated items in one diff, which is the cost
    grouping exists to avoid, discovered by a reviewer at 40,000 tokens. The
    scorer reads titles and bodies, so its mistakes are the kind that only
    show against a queue whose right answer is known — and the live queue
    cannot be that, because it changes under the test and its API rate-limits.

    Every case here is a rule the loop's skills state in prose: the head is
    the queue's next item, a companion is size S in the head's status band or
    the one below, `blocked` and `decision` are never swept in, a shared
    prose file or a shared `source:` label is not a theme, and a signal
    common to the whole queue says nothing about any two items.

    Two review rounds found the same defect in two places: a signal that
    was never scored, and a test that read as if it covered one. The route
    regex excluded a preceding backtick while the fixture backticked its
    routes, so routes matched nothing anywhere and these tests passed on the
    path signal alone; then the replacement route test reached its threshold
    on the adjacency bonus rather than on the route. So: write the fixture
    the way the queue writes, and make every signal carry an item over the
    threshold *on its own* somewhere in here, or it is not tested.
"""
import importlib.util
import os
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = importlib.util.spec_from_file_location(
    "backlog_next", os.path.join(ROOT, ".claude", "skills", "backlog-loop", "next.py"))
next_py = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(next_py)

CARS = "web/src/pages/cars.jsx"
PHOTO = "web/src/lib/photo.js"
# One row per item: (number, status, title, size, extra labels, body). The
# board order within a status is this order, which is what a person drags.
#
#   signal              named by                            df   verdict
#   `cars.jsx`          VD-33 AX-13 VD-40 VD-42              4   a signal
#   `/constructors`     VD-33 IX-71 VD-42                    3   a signal
#   `/records`          VD-33 IX-71                          2   a signal
#   `photo.js`          VD-33 AX-14 (AX-14's in its title)   2   a signal
#   `web/README.md`     VD-33 PM-24 PM-25                    3   a signal, prose
#   `docs/METHOD.md`    VD-33 PM-25                          2   a signal, prose
#   `docs/SOURCES.md`   VD-33 PM-25                          2   a signal, prose
#   `f1.db`             VD-33 CR-07 PM-24 CD-50 CD-51        5   noise
#   `/drivers`          VD-33 AX-13 PM-24 CD-50 CD-51        5   noise
#
# Each companion below crosses the threshold on one signal alone, so no test
# here can pass on a different signal than the one it names.
QUEUE = [
    (1, "Now", "VD-33: 602 photographs are advertised and shown on two.", "S", [],
     f"`{CARS}` renders them and `{PHOTO}` picks them. `/constructors` and\n"
     "`/records` advertise them; `/drivers` shows none. `AX-13` is the same\n"
     "page. The count comes from `f1.db`; `web/README.md`, `docs/METHOD.md`\n"
     "and `docs/SOURCES.md` all describe the build that makes it."),
    (2, "Next", "AX-13: Photograph `alt` is the file name.", "S", [],
     f"`{CARS}` writes the file name into `alt`, and `/drivers` does the same."),
    (3, "Next", "PM-24: Two Cloudflare build settings are unconfirmed.", "S", [],
     "`web/README.md` states one of them. `f1.db` is what the deploy serves to\n"
     "`/drivers` and every other page."),
    (4, "Next", "IX-71: Two registers open on their emptiest rows.", "S", [],
     "`/constructors` and `/records` sort by a column empty for most of them."),
    (5, "Next", "VD-40: A photograph item nobody can start.", "S", ["blocked"],
     f"`{CARS}`, and the service it needs is down."),
    (6, "Next", "VD-41: A photograph question for a person.", "S", ["decision"],
     "`VD-33` asked it, and it is not an agent's to answer."),
    (7, "Next", "VD-42: Thumbnails are three redirects.", "S", [],
     f"`{CARS}` serves them, on `/constructors`."),
    (8, "Next", "CD-50: Prose about the database.", "S", [],
     "`f1.db` on `/drivers`, and nothing else shared."),
    (9, "Next", "CD-51: More prose about the database.", "S", [],
     "`f1.db` on `/drivers` once more."),
    (10, "Next", "CD-52: The caption under the photograph says nothing.", "S", [],
     "`VD-33` is the same page; this is the line beneath it."),
    (11, "Next", "VD-43: An unrelated colour decision.", "S", [],
     "The same critique raised it and it touches nothing this one touches."),
    (12, "Next", f"AX-14: `{PHOTO}` returns no dimensions, so the page reflows.", "S", [],
     "Nothing in this body names anything the head names."),
    (16, "Next", "PM-25: Three documents describe the build differently.", "S", [],
     "`web/README.md`, `docs/METHOD.md` and `docs/SOURCES.md` disagree, and\n"
     "nothing else here is shared."),
    (13, "Next", "IX-70: The photograph strip needs a plan.", "M", [],
     "`VD-33` names the page; this one is a few sittings."),
    (14, "Now", "CR-07: The season is a magic number in nine files.", "M", [],
     "`build.py` and eight others hardcode it, and `f1.db` carries it."),
    (15, "Someday", "IA-99: A photograph caption has no source.", "S", [],
     "`VD-33` again, one status too far down to ride with it."),
]


def fake_gh(*args):
    """`gh` as next.py calls it: the board, then the open issues."""
    if args[0] == "project":
        return {"items": [{"status": s, "content": {"type": "Issue", "number": n}}
                          for n, s, _, _, _, _ in QUEUE]}
    return [{"number": n, "title": t, "body": b,
             "labels": [{"name": f"size: {size}"}] + [{"name": x} for x in extra],
             "url": f"https://example.invalid/{n}"}
            for n, _, t, size, extra, b in QUEUE]


class GroupingProposals(unittest.TestCase):
    def setUp(self):
        self.real_gh, next_py.gh = next_py.gh, fake_gh
        self.addCleanup(setattr, next_py, "gh", self.real_gh)
        # load() writes the queue cache. Without this the fixture's twelve
        # invented items land in the checkout's own .claude/loop, where the
        # next real `next.py VD-33` would read them back as the queue.
        cache = next_py.loop_cache
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.addCleanup(setattr, cache, "DIR", cache.DIR)
        cache.DIR = self.tmp.name
        self.ranked, _, _ = next_py.load()

    def item(self, ident):
        return next(r for r in self.ranked if r["ident"] == ident)

    def propose(self, ident, skip=frozenset()):
        head = self.item(ident)
        rows = next_py.companions(head, self.ranked, set(skip), {head["number"]})
        return [r["ident"] for _, r, _ in rows], {r["ident"]: why for _, r, why in rows}

    def reasons(self, ident):
        return " ".join(w for ws in self.propose(ident)[1].values() for w in ws)

    def test_the_head_is_the_queues_next_item_not_the_best_scoring_one(self):
        self.assertEqual(next_py.first_eligible(self.ranked, set())["ident"], "VD-33")

    def test_a_shared_file_and_a_cross_reference_are_what_propose_a_companion(self):
        idents, why = self.propose("VD-33")
        self.assertEqual(idents,
                         ["AX-13", "VD-42", "IX-71", "CD-52", "AX-14", "PM-25"])
        self.assertEqual(why["AX-13"],
                         ["named by VD-33", f"shares {CARS}", "ranked beside it"])

    def test_a_route_alone_carries_a_companion_over_the_threshold(self):
        # IX-71 shares two routes with the head and nothing else - no file, no
        # cross-reference, no source, and far enough down to earn no adjacency.
        # The regex must see a route written the way the queue writes it.
        idents, why = self.propose("VD-33")
        self.assertIn("IX-71", idents)
        self.assertEqual(why["IX-71"], ["both on /constructors, /records"])

    def test_an_item_that_names_the_head_is_proposed_on_that_alone(self):
        # The other direction: AX-13 is named *by* the head, CD-52 names it.
        idents, why = self.propose("VD-33")
        self.assertIn("CD-52", idents)
        self.assertEqual(why["CD-52"], ["names VD-33"])

    def test_a_signal_in_a_title_counts(self):
        # AX-14 names the shared file in its title and nothing in its body.
        # Nine open items on the live queue carry their only signal there.
        idents, why = self.propose("VD-33")
        self.assertIn("AX-14", idents)
        self.assertEqual(why["AX-14"], [f"shares {PHOTO}"])

    def test_a_shared_source_label_alone_is_not_a_theme(self):
        # VD-43 is the head's own source and shares nothing else. This is the
        # one rule `next.py`'s docstring and the skill both state outright.
        self.assertEqual(next_py.size_of(self.item("VD-43")), "S")
        self.assertNotIn("VD-43", self.propose("VD-33")[0])

    def test_three_shared_prose_files_are_a_theme_and_one_is_not(self):
        # The weighting's own claim: a prose file is worth a third of a source
        # file, so one cannot reach the threshold and three exactly can. PM-25
        # shares the head's three documents and nothing else.
        idents, why = self.propose("VD-33")
        self.assertIn("PM-25", idents)
        self.assertEqual(why["PM-25"],
                         ["shares docs/method.md, docs/sources.md, web/readme.md"])

    def test_the_ids_a_caller_already_named_are_never_proposed_back(self):
        # `next.py --group VD-33 AX-13` reads a group already chosen; AX-13 is
        # a head, not a candidate to ride with itself.
        head = self.item("VD-33")
        taken = {head["number"], self.item("AX-13")["number"]}
        rows = next_py.companions(head, self.ranked, set(), taken)
        self.assertNotIn("AX-13", [r["ident"] for _, r, _ in rows])

    def test_a_shared_prose_file_alone_is_not_a_theme(self):
        # PM-24 shares only web/README.md with the head - where each would add
        # a paragraph, not where either one's work lands. It also shares the
        # noise route, so this fails too if route noise stops being dropped.
        self.assertNotIn("PM-24", self.propose("VD-33")[0])

    def test_a_signal_the_whole_queue_carries_proposes_nothing(self):
        # Five items name f1.db and five name /drivers. CD-50 and CD-51 share
        # both with the head and with each other, and are grouped on neither.
        for ident in ("VD-33", "CD-50"):
            idents = self.propose(ident)[0]
            self.assertNotIn("CD-51" if ident == "CD-50" else "CD-50", idents)
        self.assertNotIn("f1.db", self.reasons("VD-33"))
        self.assertNotIn("/drivers", self.reasons("VD-33"))

    def test_a_file_name_is_not_a_route(self):
        # `f1.db`, `/f1.db` and `./f1 gaps` all offered the pseudo-route /f1,
        # which would walk the queue's noisiest token past a noise counter
        # that cannot see it under that spelling. A route at the end of a
        # sentence is still a route.
        def routes(text):
            return next_py.signals({"title": "ZZ-01: t", "body": text, "ident": "ZZ-01"})[1]
        self.assertEqual(routes("`f1.db` and `/f1.db` and `./f1 gaps`"), set())
        # A served path is decided by what its extension is, not by having
        # one: CLAUDE.md gives /build-status.txt as an address to open.
        self.assertEqual(routes("served at `/build-status.txt`"), {"/build-status.txt"})
        # Whatever else happens, the pseudo-route /f1 must not come back -
        # not through case, and not through an extension too long to match.
        self.assertEqual(routes("`/f1.DB`"), set())
        self.assertEqual(routes("`/f1.database`"), {"/f1.database"})
        # IS_FILE anchors at the end, so .dbx is not .db.
        self.assertEqual(routes("`/f1.dbx`"), {"/f1.dbx"})
        self.assertEqual(routes(f"`{CARS}` renders it"), set())
        self.assertEqual(routes("shown on /drivers."), {"/drivers"})
        self.assertEqual(routes("`/races/2026/13`"), {"/races/2026/13"})

    def test_a_companion_two_statuses_down_is_never_swept_up(self):
        self.assertNotIn("IA-99", self.propose("VD-33")[0])

    def test_blocked_and_decision_items_are_never_companions(self):
        idents = self.propose("VD-33")[0]
        self.assertNotIn("VD-40", idents)
        self.assertNotIn("VD-41", idents)

    def test_the_drivers_skip_list_reaches_the_companions(self):
        self.assertEqual(self.propose("VD-33", skip={"AX-13"})[0],
                         ["VD-42", "IX-71", "CD-52", "AX-14", "PM-25"])

    def test_an_m_item_is_never_a_companion(self):
        # IX-70 names the head, which is the strongest signal there is, and
        # is size M: the rungs of one M item are already one PR.
        self.assertEqual(next_py.size_of(self.item("IX-70")), "M")
        self.assertNotIn("IX-70", self.propose("VD-33")[0])

    def test_the_bands_are_the_heads_status_and_the_one_below(self):
        # An M head never reaches bands() - show_companions returns first -
        # so this is about a Now head's reach, not about M.
        self.assertEqual(next_py.bands(self.item("VD-33")), ("Now", "Next"))
        self.assertEqual(next_py.bands(self.item("IA-99")), ("Someday",))

    def test_a_head_the_board_has_not_ranked_still_scores(self):
        # `next.py --group <ID>` for an In progress or unplaced item: it is
        # absent from the ranked list the scorer indexes into.
        loose = dict(self.item("VD-33"), status="In progress", number=99)
        rows = next_py.companions(loose, self.ranked, set(), {99})
        self.assertIn("AX-13", [r["ident"] for _, r, _ in rows])


if __name__ == "__main__":
    unittest.main()
