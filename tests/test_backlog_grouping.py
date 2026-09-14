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
    prose file is not a theme, and a signal common to the whole queue says
    nothing about any two items.
"""
import importlib.util
import os
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = importlib.util.spec_from_file_location(
    "backlog_next", os.path.join(ROOT, ".claude", "skills", "backlog-loop", "next.py"))
next_py = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(next_py)

CARS = "web/src/pages/cars.jsx"
# One row per item: (number, status, title, size, extra labels, body).
QUEUE = [
    (1, "Now", "VD-33: 602 photographs are advertised and shown on two.", "S", [],
     f"`{CARS}` renders them, and `/constructors` advertises them. `AX-13` is the same page.\n"
     "The count comes from `f1.db`; `web/README.md` describes the build that makes it."),
    (2, "Next", "AX-13: Photograph `alt` is the file name.", "S", [],
     f"`{CARS}` writes the file name into `alt`."),
    (3, "Now", "CR-07: The season is a magic number in nine files.", "M", [],
     "`build.py` and eight others hardcode it, and `f1.db` carries it."),
    (4, "Next", "PM-24: Two Cloudflare build settings are unconfirmed.", "S", [],
     "`web/README.md` states one of them, and `f1.db` is what the deploy serves."),
    (5, "Next", "VD-40: A photograph item nobody can start.", "S", ["blocked"],
     f"`{CARS}`, and the service it needs is down."),
    (6, "Next", "VD-41: A photograph question for a person.", "S", ["decision"],
     "`VD-33` asked it and it is not an agent's to answer."),
    (7, "Next", "VD-42: Thumbnails are three redirects.", "S", [],
     f"`{CARS}` serves them, on `/constructors`."),
    (8, "Next", "CD-50: Prose about the database.", "S", [], "`f1.db`, and nothing else shared."),
    (9, "Next", "CD-51: More prose about the database.", "S", [], "`f1.db` once more."),
    (10, "Someday", "IA-99: A photograph caption has no source.", "S", [],
     "`VD-33` again, one status too far down to ride with it."),
    (11, "Next", "IX-70: The photograph strip needs a plan.", "M", [],
     "`VD-33` names the page; this one is a few sittings."),
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
        self.ranked, _, _ = next_py.load()

    def item(self, ident):
        return next(r for r in self.ranked if r["ident"] == ident)

    def propose(self, ident, skip=frozenset()):
        head = self.item(ident)
        rows = next_py.companions(head, self.ranked, set(skip), {head["number"]})
        return [r["ident"] for _, r, _ in rows], {r["ident"]: why for _, r, why in rows}

    def test_the_head_is_the_queues_next_item_not_the_best_scoring_one(self):
        self.assertEqual(next_py.first_eligible(self.ranked, set())["ident"], "VD-33")

    def test_a_shared_file_and_a_cross_reference_are_what_propose_a_companion(self):
        idents, why = self.propose("VD-33")
        self.assertEqual(idents, ["AX-13", "VD-42"])
        self.assertIn("named by VD-33", why["AX-13"])
        self.assertIn(f"shares {CARS}", why["AX-13"])

    def test_a_shared_prose_file_alone_is_not_a_theme(self):
        # PM-24 shares only web/README.md with the head - where each would add
        # a paragraph, not where either one's work lands.
        self.assertNotIn("PM-24", self.propose("VD-33")[0])

    def test_a_signal_the_whole_queue_carries_proposes_nothing(self):
        # Five of the ten name f1.db. CD-50 and CD-51 share it with the head
        # and with each other, and none of them is grouped on it.
        for ident in ("VD-33", "CD-50"):
            idents, why = self.propose(ident)
            self.assertNotIn("CD-51" if ident == "CD-50" else "CD-50", idents)
            self.assertFalse([w for ws in why.values() for w in ws if "f1.db" in w])

    def test_a_companion_two_statuses_down_is_never_swept_up(self):
        self.assertNotIn("IA-99", self.propose("VD-33")[0])

    def test_blocked_and_decision_items_are_never_companions(self):
        idents = self.propose("VD-33")[0]
        self.assertNotIn("VD-40", idents)
        self.assertNotIn("VD-41", idents)

    def test_the_drivers_skip_list_reaches_the_companions(self):
        self.assertEqual(self.propose("VD-33", skip={"AX-13"})[0], ["VD-42"])

    def test_an_m_item_is_never_a_companion(self):
        # IX-70 names the head, which is the strongest signal there is, and
        # is size M: the rungs of one M item are already one PR.
        self.assertEqual(next_py.size_of(self.item("IX-70")), "M")
        self.assertNotIn("IX-70", self.propose("VD-33")[0])

    def test_an_m_head_searches_its_own_band_and_the_one_below(self):
        self.assertEqual(next_py.bands(self.item("CR-07")), ("Now", "Next"))

    def test_a_head_the_board_has_not_ranked_still_scores(self):
        # `next.py --group <ID>` for an In progress or unplaced item: it is
        # absent from the ranked list the scorer indexes into.
        loose = dict(self.item("VD-33"), status="In progress", number=99)
        rows = next_py.companions(loose, self.ranked, set(), {99})
        self.assertIn("AX-13", [r["ident"] for _, r, _ in rows])


if __name__ == "__main__":
    unittest.main()
