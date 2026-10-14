#!/usr/bin/env python3
"""
The floors `verify.py` holds, and which of them a change lowered (AF-103).

    python3 .claude/skills/backlog-loop/floors.py OLD NEW
    python3 .claude/skills/backlog-loop/floors.py --list FILE

`verify.py` keeps minimums - the rows a bulk table holds, the times a
harvested column is filled, the records the build derives - that are raised
when a harvest legitimately adds and never lowered without the maintainer's
ruling. #935 lowered one, 3911 to 3910, and only the reviewer saw it.
`precheck.sh` runs this on the branch's `verify.py` against the one it
branched from and refuses what it prints, unless the PR body names the floor
and the ruling.

A floor is any assignment to a name with FLOOR in it:
    FLOOR = 60                         -> "<function>:FLOOR"
    FLOORS = (("standings", 34563),)   -> "standings"
    COLUMN_FLOORS = (("chassis", "weight_kg", 201, "harvest/..."),)
                                       -> "chassis.weight_kg"
A tuple's key is the strings before its first integer, joined by dots, so the
harvest file named after the figure is not part of it. The file is parsed,
never imported: running verify.py's module body would open the database.

Prints one line per floor lowered or removed, `<key> <old> <new>`, with `-`
for a floor that is gone, since a deleted floor guards nothing at all. Exits
0 whatever it finds, and 2 when a file cannot be read or parsed.
"""
import ast
import sys


def floors(source):
    """{key: value} for every floor in `source`."""
    found = {}

    def visit(node, func):
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                visit(child, child.name)
                continue
            if isinstance(child, ast.Assign):
                for target in child.targets:
                    if isinstance(target, ast.Name) and "FLOOR" in target.id:
                        take(target.id, child.value, func)
            visit(child, func)

    def take(name, value, func):
        if isinstance(value, ast.Constant) and isinstance(value.value, int) \
                and not isinstance(value.value, bool):
            found[f"{func or '<module>'}:{name}"] = value.value
            return
        if not isinstance(value, (ast.Tuple, ast.List)):
            return
        for row in value.elts:
            if not isinstance(row, (ast.Tuple, ast.List)):
                continue
            words = []
            for item in row.elts:
                if not isinstance(item, ast.Constant):
                    break
                if isinstance(item.value, int) and not isinstance(item.value, bool):
                    if words:
                        found[".".join(words)] = item.value
                    break
                if isinstance(item.value, str):
                    words.append(item.value)

    visit(ast.parse(source), None)
    return found


def lowered(old, new):
    """[(key, old, new or None)] for each floor `new` lowers or drops."""
    out = []
    for key, was in sorted(old.items()):
        now = new.get(key)
        if now is None or now < was:
            out.append((key, was, now))
    return out


def read(path):
    with open(path, encoding="utf-8") as f:
        return floors(f.read())


def main(argv):
    try:
        if len(argv) == 2 and argv[0] == "--list":
            for key, value in sorted(read(argv[1]).items()):
                print(key, value)
            return 0
        if len(argv) != 2:
            print(__doc__.strip().splitlines()[2], file=sys.stderr)
            return 2
        old, new = read(argv[0]), read(argv[1])
    except (OSError, SyntaxError, ValueError) as e:
        print(f"floors.py: {e}", file=sys.stderr)
        return 2
    for key, was, now in lowered(old, new):
        print(key, was, "-" if now is None else now)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
