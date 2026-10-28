"""The site's statements of the CC BY 4.0 grant, shown refusing (PM-50).

WHY THIS FILE EXISTS
    verify.py reads every sentence on the site that puts this project's
    writing under CC BY 4.0 and requires it to say which of it. Every build
    since the check was added has been against sentences that pass it, so a
    check that passed whatever it was given would read exactly like one that
    works. These tests give grant_scope_faults the two sentences PM-47's
    review found on /about, as they were written in site.js, and see them
    refused; and see the wording the site uses now pass, and fail once its
    figures are not the grant's. No test here reads f1.db or the committed
    pages.

    python3 -m unittest tests.test_grant_scope
"""
import unittest

import verify

# web/src/lib/site.js before 07e4e75, the defect PM-47's review caught: the
# DOCUMENTS entry for LICENSE-DATA, and /about's paragraph split over two
# string literals the way the file wrote it.
DOCUMENTS_THEN = r"""
  [
    'LICENSE-DATA',
    'The terms the data is offered under — CC BY-SA 4.0, and CC BY 4.0 for what this project wrote itself — and why share-alike rather than something looser.',
  ],
"""
ABOUT_THEN = r"""
      'The data is offered under CC BY-SA 4.0 — with this project’s own writing under CC BY 4.0 — ' +
        'and the code under the MIT licence; the circuit ' +
        'centrelines are © OpenStreetMap contributors under ODbL 1.0.',
"""

# The wording the site uses at PM-50, in both of its forms: site.js's string
# literals and Data.jsx's JSX text.
ABOUT_NOW = r"""
      'The data is offered under CC BY-SA 4.0 — with the columns named in ' +
        'meta.project_prose_columns, this project’s reading of each disagreement, its ' +
        'account of each gap and the prose of ten of its twelve reference tables, under CC BY 4.0 ' +
        '— and the code under the MIT licence.',
"""
DATA_NOW = """
        <p className="measure">
          Most of what this project wrote itself — its reading of
          every disagreement, its account of every gap and the prose of ten of its twelve reference
          tables — is CC BY 4.0 and carries no share-alike;{' '}
          <code>meta.project_prose_columns</code> names those columns inside the database.{' '}
        </p>
"""


class GrantScope(unittest.TestCase):
    def test_refuses_the_unscoped_sentences_pm47_found(self):
        for source in (DOCUMENTS_THEN, ABOUT_THEN):
            with self.subTest(source=source.strip()[:40]):
                faults = verify.grant_scope_faults(source, 10, 12)
                self.assertEqual(len(faults), 1, faults)
                self.assertIn("names none of the disagreements, the gaps, "
                              "the reference tables", faults[0])

    def test_joins_a_sentence_split_over_string_literals(self):
        # Neither half of ABOUT_THEN's sentence would be read as a grant
        # alone; joined, it is one.
        self.assertTrue(any("own writing under CC BY 4.0 — and the code" in s
                            for s in verify.source_sentences(ABOUT_THEN)))

    def test_passes_the_wording_the_site_uses(self):
        for source in (ABOUT_NOW, DATA_NOW):
            with self.subTest(source=source.strip()[:40]):
                self.assertEqual(verify.grant_scope_faults(source, 10, 12), [])

    def test_refuses_figures_that_are_not_the_grants(self):
        for source in (ABOUT_NOW, DATA_NOW):
            for granted, authored in ((11, 12), (10, 13)):
                with self.subTest(source=source.strip()[:40], pair=(granted, authored)):
                    faults = verify.grant_scope_faults(source, granted, authored)
                    self.assertEqual(len(faults), 1, faults)
                    self.assertIn(f"says ten of twelve reference tables, and the grant "
                                  f"is {granted} of {authored}", faults[0])

    def test_refuses_a_scope_missing_one_part(self):
        source = ABOUT_NOW.replace("account of each gap", "account of what is missing")
        faults = verify.grant_scope_faults(source, 10, 12)
        self.assertEqual(len(faults), 1, faults)
        self.assertIn("names none of the gaps:", faults[0])

    def test_does_not_read_the_facts_artefact_as_a_grant(self):
        # f1-facts.db's CC BY 4.0 says nothing about this project's writing.
        source = ("'Its facts are also published alone, as f1-facts.db, under "
                  "CC BY 4.0 with no share-alike.',")
        self.assertEqual(verify.grant_scope_faults(source, 10, 12), [])


if __name__ == "__main__":
    unittest.main()
