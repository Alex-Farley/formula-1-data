"""
A row a local loader changed cites the loader, not the build (CR-61).

tools/fastf1_load.py and tools/ergast_load.py write into rows build.py has
already written: they upsert race_entries on (race_id, driver_id), and the
Jolpica loader rederives drivers.podiums. Left alone, an overwritten row kept
F1DB's `source` and `source_id` while carrying FOM's or Jolpica's values, and
every guard that reads a row's licence off its citation - verify.py's
REDISTRIBUTION and PROVENANCE RESOLVES, tools/parquet_export.py's refusal,
web/scripts/api.mjs's - passed it.

So a loader takes a snapshot of the rows it is about to touch, writes, and
hands the snapshot back here. Any row that now differs from it is re-cited:
`source` becomes the loader's, and `source_id` goes to NULL, which is the
state of a row a loader inserted after the build. Both routes then see it -
the citation resolves to a source classed `no`, and a source with no stored
id is what verify.py fails outside a declared local copy and what both
exports refuse.

A row the loader wrote back unchanged keeps its citation: the build is a
function of F1DB, and the same value from a second source changes nothing a
reader is told. Whole rows are compared, with no column list, so a column a
loader starts writing later is covered without anyone remembering this.
"""


def snapshot(cur, table, where="1", args=()):
    """Every row of `table` matching `where`, keyed by its id."""
    return {r[0]: r for r in cur.execute(
        f'SELECT id, * FROM "{table}" WHERE {where}', args)}


def cite_changed(cur, table, before, source, where="1", args=()):
    """Cite `source` on every row in `before` that no longer matches it.

    `where` and `args` must select the rows `before` was taken over. A row
    the loader inserted is not in `before` and already carries the loader's
    own source; a row that has gone is not re-cited. Returns how many rows
    were re-cited.
    """
    now = snapshot(cur, table, where, args)
    changed = [i for i, row in before.items() if i in now and now[i] != row]
    for i in changed:
        cur.execute(f'UPDATE "{table}" SET source = ?, source_id = NULL '
                    f'WHERE id = ?', (source, i))
    return len(changed)
