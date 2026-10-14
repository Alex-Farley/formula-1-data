#!/usr/bin/env python3
"""
The floors `verify.py` holds, and which of them a change lowered (AF-103).

    python3 .claude/skills/backlog-loop/floors.py OLD NEW [--body FILE]
    python3 .claude/skills/backlog-loop/floors.py --list FILE

`verify.py` keeps minimums - the rows a bulk table holds, the times a
harvested column is filled, the records the build derives - that are raised
when a harvest legitimately adds and never lowered without the maintainer's
ruling. #935 lowered one, 3911 to 3910, and only the reviewer saw it.
`precheck.sh` runs this on the branch's `verify.py` against the one it
branched from and refuses a lowered floor whose ruling the PR body does not
name.

A floor is any name with FLOOR in it that is assigned:
    FLOOR = 60                         -> "<function>:FLOOR"
    FLOORS = (("standings", 34563),)   -> "standings"
    COLUMN_FLOORS = (("chassis", "weight_kg", 201, "harvest/..."),)
                                       -> "chassis.weight_kg"
    SOME_FLOORS = {"standings": 34563} -> "standings"
A row's key is the strings before its number, joined by dots, so the harvest
file named after the figure is not part of it. The file is parsed, never
imported: running verify.py's module body would open the database.

Refuses what it cannot read. A FLOOR name assigned in any other shape -
unpacked, indexed, augmented, a row whose number comes first or that has none
- and two floors with one key are an error, exit 2, never a floor skipped: a
floor this cannot read is one a change could lower in silence. Teach it the
shape, or rename. It reads assignments only: a floor changed through an
attribute, a method call (`FLOORS.append`) or a loop target is not seen, and
verify.py holds none of those today.

Prints one line per floor lowered or removed, `<key> <old> <new>`, with
`removed` for a floor that is gone, since a deleted floor guards nothing.
With `--body FILE` (the PR body) each line ends `ruled` or `unruled`: ruled
when one line of the body holds the word "floor", a ruling (`#n` or `D-nn`)
and the floor itself as `<key> <old> -> <new>`, the form SKILL.md gives -
    Floor lowered: article_images.race_id 3916 -> 3910, ruled on #838
The key is bounded so that a ruling for `chassis.weight_kg` is not one for
`chassis`. Exits 0 whatever it finds, and 2 when a file cannot be read.
"""
import ast
import re
import sys


class Unreadable(ValueError):
    pass


def _number(node):
    """The node's value when it is a plain number, else None."""
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) \
            and not isinstance(node.value, bool):
        return node.value
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        inner = _number(node.operand)
        return None if inner is None else -inner
    return None


def floors(source):
    """{key: value} for every floor in `source`; Unreadable on a shape it
    cannot read or a key it has already seen."""
    found = {}

    def put(key, value, line):
        if key in found:
            raise Unreadable(f"line {line}: floor {key} is held twice")
        found[key] = value

    def names(target):
        if isinstance(target, ast.Name):
            return [target.id]
        if isinstance(target, (ast.Tuple, ast.List)):
            return [n for t in target.elts for n in names(t)]
        if isinstance(target, (ast.Starred, ast.Subscript)):
            return names(target.value)
        return []

    def take(name, value, func, line):
        n = _number(value)
        if n is not None:
            put(f"{func or '<module>'}:{name}", n, line)
            return
        if isinstance(value, ast.Dict):
            for k, v in zip(value.keys, value.values):
                if not (isinstance(k, ast.Constant) and isinstance(k.value, str)) \
                        or _number(v) is None:
                    raise Unreadable(f"line {line}: {name} has an entry that is not "
                                     "a name and a number")
                put(k.value, _number(v), line)
            return
        if not isinstance(value, (ast.Tuple, ast.List)):
            raise Unreadable(f"line {line}: {name} is neither a number nor rows of them")
        for row in value.elts:
            if not isinstance(row, (ast.Tuple, ast.List)):
                raise Unreadable(f"line {line}: {name} has a row that is not a tuple")
            words, n = [], None
            for item in row.elts:
                n = _number(item)
                if n is not None:
                    break
                if not (isinstance(item, ast.Constant) and isinstance(item.value, str)):
                    raise Unreadable(f"line {line}: {name} has a row with a computed "
                                     "value before its number")
                words.append(item.value)
            if n is None or not words:
                raise Unreadable(f"line {line}: {name} has a row without a name "
                                 "before its number")
            put(".".join(words), n, line)

    def visit(node, func):
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                visit(child, child.name)
                continue
            if isinstance(child, ast.Assign):
                for target in child.targets:
                    if isinstance(target, ast.Name):
                        if "FLOOR" in target.id:
                            take(target.id, child.value, func, child.lineno)
                    elif any("FLOOR" in n for n in names(target)):
                        raise Unreadable(f"line {child.lineno}: a floor assigned "
                                         "other than by its name")
            elif isinstance(child, (ast.AnnAssign, ast.AugAssign)):
                if any("FLOOR" in n for n in names(child.target)):
                    if isinstance(child, ast.AnnAssign) and child.value is not None \
                            and isinstance(child.target, ast.Name):
                        take(child.target.id, child.value, func, child.lineno)
                    else:
                        raise Unreadable(f"line {child.lineno}: a floor changed in place")
            visit(child, func)

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


RULING = re.compile(r"#\d+\b|\bD-\d+\b")


def ruled(body, key, was, now):
    """Whether one line of `body` names this floor, its change and a ruling."""
    shown = "removed" if now is None else str(now)
    floor = re.compile(r"(?<![\w.])" + re.escape(key) + r"\s+" + re.escape(str(was))
                       + r"\s*(?:->|→)\s*" + re.escape(shown) + r"(?!\w|\.\w)")
    return any(re.search(r"floor", line, re.I) and RULING.search(line) and floor.search(line)
               for line in body.splitlines())


def read(path):
    with open(path, encoding="utf-8") as f:
        return floors(f.read())


def main(argv):
    try:
        if len(argv) == 2 and argv[0] == "--list":
            for key, value in sorted(read(argv[1]).items()):
                print(key, value)
            return 0
        body = None
        if len(argv) == 4 and argv[2] == "--body":
            with open(argv[3], encoding="utf-8") as f:
                body = f.read()
            argv = argv[:2]
        if len(argv) != 2:
            print(__doc__.strip().splitlines()[2].strip(), file=sys.stderr)
            return 2
        old, new = read(argv[0]), read(argv[1])
    except (OSError, SyntaxError, ValueError) as e:
        print(f"floors.py: {e}", file=sys.stderr)
        return 2
    for key, was, now in lowered(old, new):
        line = f"{key} {was} {'removed' if now is None else now}"
        if body is not None:
            line += " ruled" if ruled(body, key, was, now) else " unruled"
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
