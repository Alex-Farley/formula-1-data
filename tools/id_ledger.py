#!/usr/bin/env python3
"""
The ids a release has published, by natural key, so the next one keeps them.

`meta.id_stability_stable` names the tables whose integer `id` the
maintainers undertake not to renumber. Nothing measured it, and between
v2.26 and the build that was to be v2.27 the undertaking broke for two of
the seven (DA-55): 19,545 `qualifying` ids moved down by one behind a single
row removed from 1979, and 151 `pit_stops` ids, in 2026 rounds 13 to 17,
moved up by 21 behind the 21 stops F1DB added late to round 13. An id is handed out in
insert order, so a row removed or added mid-table renumbers everything after
it; nothing a loader does can keep the promise by construction.

So the promise is kept against a record of it. data/ids/<table>.txt holds, for
every table ID_STABILITY declares stable, each id a release published and the
natural key it was published for:

    # release: 2.26
    # key: race_id, driver_id
    7538|[320,"gianfranco-brancatelli"]

    build.py   gives every row of a table in ID_LEDGER_APPLIED (data/current.py)
               the id its key holds in the ledger, and a row the ledger has
               never seen an id above every id the ledger holds, in insert
               order. An id whose row has gone stays in the ledger and is never
               handed to another key; the row it named, should it come back,
               gets it back.
    verify.py  fails a build in which a row of any stable table holds an id
               other than its key's in the ledger, or an id the ledger gives
               another key. For the applied tables the build has already made
               that so; for the rest - races, race_entries and the others,
               whose ids other rows cite and so cannot be handed back at the
               end of a build - it is the measurement.

The ledger is a source, committed, and the build reads nothing else to keep
it: no tag, no git, no clock ([D-01]). What moves it on is this tool, run
after each release is tagged, which reads the f1.db committed at the tag and
adds the ids that release published - the rows new since the one before -
to every stable table's ledger. An entry already in a ledger is never
changed: a tag that published another id for a key the ledger holds is a
promise already broken, and the tool refuses it rather than record it.

    python3 tools/id_ledger.py --write [TAG]   add the ids the f1.db at TAG
                                               (default: the last v* tag)
                                               published; then `make all`
    python3 tools/id_ledger.py --check         exit 1 where a ledger is behind
                                               the last tag, 2 where there is
                                               no tag to compare against
"""
import json
import os
import sqlite3
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEDGERS = os.path.join(ROOT, "data", "ids")


def path(table):
    return os.path.join(LEDGERS, f"{table}.txt")


def _encode(key):
    return json.dumps(list(key), ensure_ascii=False, separators=(",", ":"))


def read(table, where=None):
    """(release, key columns, {key tuple: id}) from the table's ledger, or
    None where it has none. Refuses a ledger that gives one key two ids or
    one id two keys, which no write of this tool produces."""
    file = os.path.join(where, f"{table}.txt") if where else path(table)
    if not os.path.exists(file):
        return None
    release, columns, ids, seen = None, None, {}, set()
    with open(file, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            line = line.rstrip("\n")
            if line.startswith("# release: "):
                release = line[len("# release: "):]
            elif line.startswith("# key: "):
                columns = tuple(c.strip() for c in line[len("# key: "):].split(","))
            elif line.startswith("#") or not line:
                continue
            else:
                head, _, rest = line.partition("|")
                rid, key = int(head), tuple(json.loads(rest))
                if key in ids or rid in seen:
                    raise SystemExit(f"{file}:{n}: id {rid} or key {list(key)} "
                                     f"appears twice; a ledger is written by "
                                     f"tools/id_ledger.py, never by hand")
                ids[key] = rid
                seen.add(rid)
    if release is None or columns is None:
        raise SystemExit(f"{file}: no '# release:' or '# key:' line")
    return release, columns, ids


def write(table, release, columns, ids, where=None):
    file = os.path.join(where, f"{table}.txt") if where else path(table)
    os.makedirs(os.path.dirname(file), exist_ok=True)
    with open(file, "w", encoding="utf-8", newline="\n") as f:
        f.write(f"# The integer ids of `{table}` that releases up to {release} "
                f"published, by natural key.\n"
                f"# Written by tools/id_ledger.py --write after a release is "
                f"tagged, read by build.py and\n"
                f"# verify.py, and never edited by hand (DA-55).\n"
                f"# release: {release}\n"
                f"# key: {', '.join(columns)}\n")
        for key, rid in sorted(ids.items(), key=lambda kv: kv[1]):
            f.write(f"{rid}|{_encode(key)}\n")


def held(con, table, columns, schema="main"):
    """[(id, key tuple)] for every row of `table`, in id order."""
    cols = ", ".join(f'"{c}"' for c in columns)
    return [(r[0], tuple(r[i] for i in range(1, len(r)))) for r in con.execute(
        f'SELECT id, {cols} FROM {schema}."{table}" ORDER BY id')]


def departures(rows, ids):
    """(moved, reused) for a table's rows against its ledger: the rows whose
    key the ledger holds under another id, and the rows whose id the ledger
    gives to another key. Both empty is the undertaking kept."""
    owner = {rid: key for key, rid in ids.items()}
    moved = [(rid, key, ids[key]) for rid, key in rows
             if key in ids and ids[key] != rid]
    reused = [(rid, key, owner[rid]) for rid, key in rows
              if rid in owner and owner[rid] != key]
    return moved, reused


def assign(con, table, columns, ids):
    """Give every row of `table` its key's id from the ledger, and a row the
    ledger has never seen the next id above every id it holds, in the order
    the build inserted them. Returns how many rows changed id. The table must
    be one no other row cites by id: this rewrites the ids, not references
    to them."""
    rows = held(con, table, columns)
    keys = [key for _, key in rows]
    if len(set(keys)) != len(keys):
        raise SystemExit(f"{table}: its natural key ({', '.join(columns)}) "
                         f"names more than one row, so the ledger cannot say "
                         f"which id is whose")
    nxt = max(ids.values(), default=0) + 1
    change = []
    for rid, key in rows:
        if key in ids:
            want = ids[key]
        else:
            want, nxt = nxt, nxt + 1
        if want != rid:
            change.append((rid, want))
    # Through the negatives, so no step of the rewrite collides with an id
    # another row still holds.
    con.executemany(f'UPDATE "{table}" SET id = ? WHERE id = ?',
                    [(-want, rid) for rid, want in change])
    con.execute(f'UPDATE "{table}" SET id = -id WHERE id < 0')
    return len(change)


def merge(table, ids, rows):
    """The ledger with a release's rows added. Refuses a row that disagrees
    with an entry already held: that release renumbered what an earlier one
    published."""
    out = dict(ids)
    owner = {rid: key for key, rid in ids.items()}
    for rid, key in rows:
        if key in out and out[key] != rid:
            raise SystemExit(f"{table}: the release gives {list(key)} id {rid}, "
                             f"where the ledger holds {out[key]}")
        if rid in owner and owner[rid] != key:
            raise SystemExit(f"{table}: the release gives id {rid} to "
                             f"{list(key)}, where the ledger gives it to "
                             f"{list(owner[rid])}")
        out[key] = rid
        owner[rid] = key
    return out


def _stable():
    sys.path.insert(0, ROOT)
    from data import current as N
    return {t: k for t, (s, k) in N.ID_STABILITY.items() if s == "stable"}


def behind(tag):
    """The stable tables whose ledger is missing or names a release other
    than the tag's."""
    release = tag[1:] if tag and tag.startswith("v") else tag
    out = []
    for table in sorted(_stable()):
        got = read(table)
        if got is None or got[0] != release:
            out.append(table)
    return out


def main(argv):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import release_due
    if "--write" in argv:
        rest = [a for a in argv if a != "--write"]
        tag = rest[0] if rest else release_due.last_tag()
        if not tag:
            print("id ledger: no v* tag to read the published ids from")
            return 2
        handle, temp = tempfile.mkstemp(suffix=".db")
        os.close(handle)
        try:
            if not release_due.tag_database(tag, temp):
                print(f"id ledger: git cannot give the f1.db committed at {tag}")
                return 2
            con = sqlite3.connect(f"file:{temp}?mode=ro", uri=True)
            version = con.execute("SELECT value FROM meta WHERE key = 'version'").fetchone()[0]
            for table, columns in sorted(_stable().items()):
                got = read(table)
                if got is not None and got[1] != tuple(columns):
                    raise SystemExit(
                        f"{table}: the ledger is keyed on ({', '.join(got[1])}) and "
                        f"ID_STABILITY on ({', '.join(columns)}); a key that changed "
                        f"is a maintainer's decision, not this tool's")
                ids = merge(table, got[2] if got else {}, held(con, table, columns))
                write(table, version, columns, ids)
                print(f"id ledger: {table} {len(ids):,} ids, "
                      f"{len(ids) - (len(got[2]) if got else 0):+,} from {tag}")
            con.close()
        finally:
            os.unlink(temp)
        print("id ledger: now `make all`, which rebuilds f1.db against it")
        return 0
    if "--check" in argv:
        tag = release_due.last_tag()
        if not tag:
            print("id ledger: no v* tag in this checkout to compare against")
            return 2
        late = behind(tag)
        if late:
            print(f"id ledger: behind {tag} for {', '.join(late)}: "
                  f"python3 tools/id_ledger.py --write, then make all")
            return 1
        print(f"id ledger: at {tag}")
        return 0
    print(__doc__.strip().splitlines()[0])
    print("usage: tools/id_ledger.py --write [TAG] | --check")
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
