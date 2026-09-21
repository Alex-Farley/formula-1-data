#!/usr/bin/env python3
"""A short-lived on-disk cache for the queue scripts' GitHub reads.

WHY THIS EXISTS
    `next.py` reads the whole board and every open issue on each run - two
    paginated GraphQL reads, one of them a ProjectsV2 item list, which is the
    expensive kind - and `file.py` spent four calls on every status change.
    On 2026-09-14 a day of that tripped GitHub's secondary rate limiter: it
    is not one of the buckets `/rate_limit` reports (every one of those read
    full while it was active), it refuses every GraphQL call while it lasts,
    and it extends if you keep trying. Grouping made the pressure worse
    rather than better - each issue of a group needs a status on the way in
    and another on the way out.

    It recurred on 2026-09-21 after a fourteen-item run, against a board that
    had grown to 273 items. The cache was not the thing that had failed: what
    had changed was the load it covers, which scales with queue size times
    forks per hour and had grown on both axes. `PM-44` cut the reads
    themselves rather than caching more of them - the board query now asks
    for the two fields it uses instead of every field of every item, and the
    issue read asks for bodies only where one is printed or scored. Neither
    lever is this file's, and the division stands: cheaper reads here,
    remembered ones only where staleness cannot cost anything.

WHAT IS CACHED, AND WHY STALENESS CANNOT COST ANYTHING
    - The board metadata `file.py` needs - project id, Status field id, its
      option ids - changes only when a person edits the field, and a miss is
      visible: the status name is absent from the map, so it refetches.
    - The issue -> project item id map is stable while an item is on the
      board, and a wrong id makes `item-edit` fail, which drops the cache and
      retries once against fresh data.
    - The queue `next.py` reads is cached **only for a call that names its
      items**, where the ids are already chosen and a body two minutes old
      changes nothing. Choosing the next item always reads GitHub: that is
      where a stale board would let two forks take the same item, which is
      the collision the *In progress* status exists to prevent.

    A cache that cannot be read or written is a slower run, never a failure.

The files sit in `.claude/loop/` beside `progress.log`, which is gitignored.
A worktree keeps its own, so a fork shares nothing with the main checkout;
two processes in one checkout do share these files, and every race between
them costs a refetch rather than a wrong write - which is the whole reason
nothing that chooses an item is allowed to read them.
"""
import json
import os
import time

DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "loop"))


def path(name):
    return os.path.join(DIR, f"{name}-cache.json")


def read(name, max_age):
    """The payload written under `name` if it is younger than `max_age`
    seconds, else None. Any unreadable or unparsable file is a miss."""
    try:
        with open(path(name), encoding="utf-8") as f:
            blob = json.load(f)
    except (OSError, ValueError):
        return None
    if not isinstance(blob, dict) or time.time() - blob.get("at", 0) > max_age:
        return None
    return blob.get("payload")


def write(name, payload):
    target = path(name)
    try:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        tmp = f"{target}.{os.getpid()}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"at": time.time(), "payload": payload}, f)
        os.replace(tmp, target)          # atomic: a reader never sees half a file
    except OSError:
        pass


def drop(name):
    try:
        os.remove(path(name))
    except OSError:
        pass
