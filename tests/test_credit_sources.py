"""The credit check, shown refusing what it exists to refuse (AF-102).

WHY THIS FILE EXISTS
    verify.py runs tools/credit_sources.py against the committed documents
    and a database that agree, so the run there reads as a pass however the
    check is written. Each test here builds a small database of its own -
    nothing in it depends on the committed f1.db - and a document with ONE
    statement the check must refuse, and asserts it is refused and named.
    The first test passes a statement that agrees, so a check that refused
    everything could not pass either.

    python3 -m unittest tests.test_credit_sources
"""
import os
import sqlite3
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import credit_sources as cs  # noqa: E402 - tools/ has to be on the path first


def database():
    con = sqlite3.connect(":memory:")
    con.executescript("""
        CREATE TABLE source_registry (id INTEGER PRIMARY KEY, authority TEXT, domains TEXT);
        INSERT INTO source_registry VALUES
            (3, 'official', 'formula1.com'), (6, 'official', 'formula1.com'),
            (8, 'reference', 'en.wikipedia.org'), (10, 'reference', 'github.com,f1db'),
            (18, 'authored', NULL), (99, 'reference', 'example.org');
        CREATE TABLE table_provenance (tbl TEXT PRIMARY KEY, source_id INTEGER);
        INSERT INTO table_provenance VALUES ('glossary', 18);
        CREATE TABLE glossary (term TEXT);
        INSERT INTO glossary VALUES ('apex');
        CREATE TABLE unsourced (x INTEGER);
        CREATE TABLE drivers (id INTEGER, source_id INTEGER);
        CREATE TABLE constructors (id INTEGER, source_id INTEGER);
    """)
    # 80 F1DB, 13 formula1.com across two of its entries, 7 Wikipedia: the
    # shape #773 credited to Wikipedia alone.
    rows = [10] * 80 + [3] * 6 + [6] * 7 + [8] * 7
    con.executemany("INSERT INTO drivers VALUES (?, ?)", enumerate(rows))
    con.executemany("INSERT INTO constructors VALUES (?, ?)",
                    enumerate([10] * 60 + [3] * 40))
    return con


AGREES = """# Credits

## Attribution text

<!-- credit:drivers -->Some driver records are derived from
[Wikipedia](https://en.wikipedia.org/)<!-- /credit -->. <!-- credit:drivers,constructors -->Most
driver and constructor records are from [F1DB](https://github.com/f1db/f1db)<!-- /credit -->,
and <!-- credit:drivers,constructors -->the rest from formula1.com<!-- /credit -->.
<!-- credit:glossary -->Written for this project<!-- /credit -->.
"""


class CreditSources(unittest.TestCase):
    def setUp(self):
        self.con = database()
        self.addCleanup(self.con.close)

    def faults(self, text):
        return cs.faults(self.con, {"DOC": text})

    def test_a_statement_that_agrees_passes(self):
        self.assertEqual(self.faults(AGREES), (4, []))

    def test_a_source_most_rows_cite_must_be_named(self):
        # #773: the credit named Wikipedia for rows most of which cite F1DB.
        text = AGREES.replace("<!-- credit:drivers,constructors -->Most",
                              "<!-- credit:constructors -->Most")
        found, bad = self.faults(text)
        self.assertEqual(len(bad), 1, bad)
        self.assertIn("F1DB is cited by 80 of 100 `drivers` rows", bad[0])

    def test_entries_of_one_publisher_are_counted_together(self):
        # formula1.com is 6 + 7 rows under two registry entries: 13%, over
        # the share, though neither entry is on its own.
        text = AGREES.replace("<!-- credit:drivers,constructors -->the rest",
                              "<!-- credit:constructors -->the rest")
        found, bad = self.faults(text)
        self.assertEqual(len(bad), 1, bad)
        self.assertIn("formula1.com is cited by 13 of 100 `drivers` rows", bad[0])

    def test_a_small_source_need_not_be_named(self):
        # Wikipedia's 7% is under the share.
        text = AGREES.replace("<!-- credit:drivers -->Some driver", "Some driver")
        text = text.replace("en.wikipedia.org/)<!-- /credit -->", "en.wikipedia.org/)")
        self.assertEqual(self.faults(text), (3, []))

    def test_a_named_source_no_row_cites_is_refused(self):
        text = AGREES.replace("<!-- credit:drivers -->Some driver",
                              "<!-- credit:drivers,constructors -->Some driver")
        found, bad = self.faults(text)
        self.assertEqual(bad, ["DOC, Attribution text: credits Wikipedia for "
                               "`constructors`, which no row of it cites"])

    def test_the_words_are_read_not_the_marker(self):
        # The same marker around prose naming the wrong source.
        text = AGREES.replace("from [F1DB](https://github.com/f1db/f1db)",
                              "from [Wikipedia](https://github.com/f1db/f1db)")
        found, bad = self.faults(text)
        self.assertIn("DOC, Attribution text: credits Wikipedia for `constructors`, "
                      "which no row of it cites", bad)
        self.assertTrue(any("F1DB is cited by 80" in b for b in bad), bad)

    def test_a_link_target_is_not_a_name(self):
        # A link's URL is not what the reader reads.
        text = AGREES.replace("the rest from formula1.com",
                              "the rest from [the official site](https://www.formula1.com/)")
        found, bad = self.faults(text)
        self.assertTrue(any("formula1.com is cited by 13" in b for b in bad), bad)
        self.assertIn("DOC, Attribution text: the credit for drivers, constructors "
                      "names no source", bad)

    def test_an_authored_table_is_credited_through_its_provenance(self):
        text = AGREES.replace("Written for this project", "From F1DB")
        found, bad = self.faults(text)
        self.assertIn("DOC, Attribution text: credits F1DB for `glossary`, "
                      "which no row of it cites", bad)
        self.assertTrue(any("written for this project is cited by 1 of 1" in b
                            for b in bad), bad)

    def test_a_table_that_records_no_source_is_refused(self):
        text = AGREES + "<!-- credit:unsourced -->F1DB<!-- /credit -->\n"
        text += "<!-- credit:no_such_table -->F1DB<!-- /credit -->\n"
        found, bad = self.faults(text)
        self.assertIn("DOC, Attribution text: `unsourced` is not a table that "
                      "records its sources", bad)
        self.assertIn("DOC, Attribution text: `no_such_table` is not a table "
                      "that records its sources", bad)

    def test_a_source_the_names_do_not_cover_must_still_be_credited(self):
        self.con.executemany("INSERT INTO constructors VALUES (?, 99)",
                             [(i,) for i in range(100, 120)])
        found, bad = self.faults(AGREES)
        self.assertEqual(len(bad), 1, bad)
        self.assertIn("a source registry entry no name in NAMES stands for", bad[0])

    def test_each_heading_is_its_own_statement(self):
        # F1DB is credited for `drivers` under one heading and not the other.
        text = AGREES + ("\n## Elsewhere\n\n<!-- credit:drivers -->formula1.com"
                         "<!-- /credit --> and <!-- credit:drivers -->Wikipedia"
                         "<!-- /credit -->\n")
        found, bad = self.faults(text)
        self.assertEqual(len(bad), 1, bad)
        self.assertTrue(bad[0].startswith("DOC, Elsewhere: F1DB is cited by 80"), bad)

    def test_the_committed_documents_carry_spans(self):
        # Without them the check runs on an empty set and passes on nothing.
        found = sum(len(cs.statements(t)) for t in cs.read().values())
        self.assertGreater(found, 0)


if __name__ == "__main__":
    unittest.main()
