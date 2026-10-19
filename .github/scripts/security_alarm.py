#!/usr/bin/env python3
"""File an item of the queue for every open security alert nobody has
filed (AF-121).

    security_alarm.py     security.yml, weekly and after CodeQL runs on main

Code-scanning, Dependabot and secret-scanning alerts were seen only by a
person who opened the repository's Security tab. On 2026-10-18 sixteen
code-scanning alerts were open and none had been triaged; two were real
(#1063). The maintainer ruled on #1064 that alerts are checked regularly and
the important ones become issues, on the pattern of refresh_alarm.py: a
workflow notices and files, and the loop triages from the queue.

NOTICE, FILE, NEVER ACT
    Nothing here dismisses an alert or changes code. It reads the open
    alerts, groups them, and opens an issue for each group that no open
    issue already covers. Only the maintainer dismisses an alert; the
    body of every issue says how the loop hands one over for that.

ONE ISSUE PER GROUP, NEVER ONE PER RUN
    A group is one rule in one file for code scanning, one package for
    Dependabot, every secret-scanning alert together, and every
    code-scanning alert about a workflow together. An alert is
    already filed when its address appears in the body of an open issue
    this job opened, or one the owner, a member or a collaborator wrote -
    a `decision` listing alerts to dismiss, say - and is never filed twice
    while that issue is open. A new alert in a group whose issue is still
    open is added to that issue's body, which is otherwise left as it is,
    and a comment says so. The group's issue is found by the marker at the
    foot of its body, and only in an issue this job opened.

ONLY THE REPOSITORY'S OWN ISSUES COUNT
    The repository is public, so anyone can open an issue, name alerts in
    it or copy a marker into it - the marker is a hash of a public rule id
    and path, and the secrets' is a constant. An issue by anyone else
    neither holds an alert back nor is written to and labelled by this job,
    and next.py places by a severity label only an issue this job opened.

WHERE IT GOES IN THE QUEUE
    `source: security`, `size: ?`, an `SC-n` id, and one severity label:
    `security: high` for a secret and for a critical or high alert,
    `security: medium` for a medium one or a code-scanning error,
    `security: low` for a low one, a warning or a note. A code-scanning
    alert with neither a security severity nor a severity GitHub names is
    read as medium, the middle, and the body says it was not stated. The
    job's token cannot write the user-owned board, so the label carries
    the placement: next.py reads an issue with one and no status - the
    project's automation adds it with none - as *Now* at its top under the
    refresh alarms, *Next* or *Someday* at its foot. A status a person
    gives it is obeyed.

A SECRET IS NAMED, NEVER DESCRIBED
    The repository is public and so is every issue. A secret-scanning
    issue gives only the alerts' addresses, which only someone with access
    to the alerts can open: not the kind of secret, not where it is, never
    the value the API returns beside it. A code-scanning alert is filed
    with its rule and file, because the code it points at is public
    already, except one about a workflow - a rule under `actions/`, or a
    file under `.github/` - which is given by its address alone like a
    secret: an injection into a workflow is not announced before it is
    fixed. Its marker is the same for every such alert, because one hashed
    from its rule and file would name them to anyone who tried the few
    `actions/` rules against the few workflows.

A CHECK THAT CANNOT SEE
    Each kind is read on its own. A kind the token may not read, or that is
    not enabled, is named in the log and the job summary, the other kinds
    are still filed, and the step fails at the end, so a watch that is
    blind to one kind says so rather than reporting nothing open.

Needs GH_TOKEN (the workflow's own token, with issues: write and
security-events: read), GH_REPO and RUN_URL.
"""
import hashlib
import json
import os
import re
import subprocess
import sys

PREFIX = "SC"
# The workflow token's login in the REST API: the author of every issue
# this job opens.
BOT = "github-actions[bot]"
# The author associations whose issues may hold an alert back. A bot's is
# CONTRIBUTOR, so it is matched by login instead.
TRUSTED = frozenset({"OWNER", "MEMBER", "COLLABORATOR"})
SOURCE = "source: security"
QUEUE_LABELS = (SOURCE, "size: ?")
SEVERITY_LABELS = {
    "high": ("security: high", "B60205", "A secret, or a critical or high alert; heads Now"),
    "medium": ("security: medium", "D93F0B", "A medium alert or a code-scanning error; Next"),
    "low": ("security: low", "FBCA04", "A low alert, a warning or a note; Someday"),
}
RANK = {"low": 1, "medium": 2, "high": 3}
KINDS = ("code-scanning", "dependabot", "secret-scanning")
MARK = re.compile(r"<!-- security-alert ([0-9a-f]{16}) -->")


# ------------------------------------------------------------- the decisions

def code_severity(alert):
    """(level, stated) for a code-scanning alert: the security severity
    where the rule has one, else the rule's severity."""
    rule = alert.get("rule") or {}
    security = (rule.get("security_severity_level") or "").lower()
    if security in ("critical", "high"):
        return "high", True
    if security in ("medium", "low"):
        return security, True
    plain = (rule.get("severity") or "").lower()
    if plain == "error":
        return "medium", True
    if plain in ("warning", "note"):
        return "low", True
    return "medium", False


def dependabot_severity(alert):
    level = ((alert.get("security_advisory") or {}).get("severity") or "").lower()
    if level in ("critical", "high"):
        return "high", True
    if level in ("medium", "low"):
        return level, True
    return "medium", False


def clean(text, limit=160):
    """Alert text as one line of an issue body: no markup that could close
    the marker or a code span, no newline, and short."""
    text = re.sub(r"[`<>\r\n]+", " ", str(text or "")).strip()
    return text if len(text) <= limit else text[:limit - 1].rstrip() + "…"


def withheld(rule_id, path):
    """Whether a code-scanning alert is about a workflow, and so is given
    by its address alone."""
    return str(rule_id or "").startswith("actions/") or str(path or "").startswith(".github/")


def key(*parts):
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:16]


def groups(alerts):
    """{key: group} from {kind: [alert]}. A group is dict(kind, title,
    alerts=[(number, url, line, level, stated)])."""
    found = {}

    def add(k, kind, title, level, stated, number, url, line):
        found.setdefault(k, dict(kind=kind, title=title, alerts=[]))["alerts"].append(
            (number, url, line, level, stated))

    for a in alerts.get("code-scanning", []):
        rule = a.get("rule") or {}
        location = ((a.get("most_recent_instance") or {}).get("location") or {})
        path = clean(location.get("path") or "an unknown file")
        name = clean(rule.get("description") or rule.get("id") or "an unnamed rule", 100)
        level, stated = code_severity(a)
        if withheld(rule.get("id"), location.get("path")):
            # One key for them all: see the docstring.
            k = key("code-scanning", "workflow")
            add(k, "code-scanning", "Code scanning: an alert about a workflow", level, stated,
                a["number"], a["html_url"], "")
            found[k]["withheld"] = True
            continue
        line = f"`{path}:{location.get('start_line', '?')}` - {clean(rule.get('id'))}"
        add(key("code-scanning", str(rule.get("id")), path), "code-scanning", f"Code scanning: {name}, in {path}", level, stated,
            a["number"], a["html_url"], line)
    for a in alerts.get("dependabot", []):
        dep = a.get("dependency") or {}
        package = dep.get("package") or {}
        name = clean(package.get("name") or "an unnamed package", 80)
        ecosystem = clean(package.get("ecosystem") or "unknown", 20)
        advisory = a.get("security_advisory") or {}
        level, stated = dependabot_severity(a)
        line = (f"{clean(advisory.get('ghsa_id'))} - {clean(advisory.get('summary'))} "
                f"(`{clean(dep.get('manifest_path'))}`)")
        add(key("dependabot", ecosystem, name), "dependabot",
            f"Dependabot: {name} ({ecosystem}) has a known vulnerability", level, stated,
            a["number"], a["html_url"], line)
    for a in alerts.get("secret-scanning", []):
        add(key("secret-scanning"), "secret-scanning",
            "Secret scanning: an alert is open", "high", True,
            a["number"], a["html_url"], "")
    return found


def trusted(issue):
    """Whether an issue speaks for the repository: this job's own, or one
    by the owner, a member or a collaborator."""
    return ((issue.get("user") or {}).get("login") == BOT
            or issue.get("author_association") in TRUSTED)


def referenced(bodies, repo):
    """{(kind, number)} for every alert address in these bodies. Read as a
    number, so alert 1 is not found inside the address of alert 12."""
    pattern = re.compile(rf"https://github\.com/{re.escape(repo)}/security/"
                         r"(code-scanning|dependabot|secret-scanning)/(\d+)(?!\d)")
    return {(m.group(1), int(m.group(2))) for b in bodies for m in pattern.finditer(b or "")}


def severity(alerts):
    """(level, stated): the highest of these alerts' levels, and whether
    GitHub stated one for every alert."""
    return (max((a[3] for a in alerts), key=RANK.__getitem__),
            all(a[4] for a in alerts))


def plan(found, issues, repo):
    """[(action, key, group, new_alerts, issue)]: 'open' for a group no open
    issue of this job's holds the marker of, 'add' for one whose issue is
    open, in each case only for alerts no trusted open issue mentions.
    Highest severity first, by the new alerts' severity."""
    seen = referenced([i.get("body") for i in issues if trusted(i)], repo)
    owner = {}
    for i in issues:
        if (i.get("user") or {}).get("login") != BOT:
            continue
        for m in MARK.finditer(i.get("body") or ""):
            owner.setdefault(m.group(1), i)
    steps = []
    for k, g in found.items():
        new = [a for a in g["alerts"] if (g["kind"], a[0]) not in seen]
        if new:
            steps.append(("add" if k in owner else "open", k, g, new, owner.get(k)))
    return sorted(steps, key=lambda s: (-RANK[severity(s[3])[0]], s[2]["title"]))


def next_number(titles, prefix=PREFIX):
    used = [int(m.group(1)) for t in titles for m in [re.match(rf"^{prefix}-(\d+): ", t)] if m]
    return max(used, default=0) + 1


DISMISS = {
    "code-scanning": ("code-scanning", "-f state=dismissed "
                      "-f 'dismissed_reason=false positive' -f 'dismissed_comment=<why>'",
                      "`false positive`, `won't fix` or `used in tests`"),
    "dependabot": ("dependabot", "-f state=dismissed -f dismissed_reason=tolerable_risk "
                   "-f 'dismissed_comment=<why>'",
                   "`fix_started`, `inaccurate`, `no_bandwidth`, `not_used` or `tolerable_risk`"),
    "secret-scanning": ("secret-scanning", "-f state=resolved -f resolution=false_positive "
                        "-f 'resolution_comment=<why>'",
                        "`false_positive`, `wont_fix`, `revoked` or `used_in_tests`"),
}


def alert_lines(alerts):
    return "\n".join(f"- {a[1]}" + (f" - {a[2]}" if a[2] else "") for a in alerts)


def body(k, group, alerts, repo, run_url):
    path, flags, reasons = DISMISS[group["kind"]]
    level, stated = severity(alerts)
    parts = [
        f"**Open {group['kind']} alerts, filed by security.yml:**\n" + alert_lines(alerts),
        f"**Severity:** {level}"
        + ("" if stated else " (GitHub stated none for at least one alert, read as medium)")
        + f". The `security: {level}` label places this in the queue while no person has "
        "given it a status.",
    ]
    if group["kind"] == "secret-scanning":
        parts.append("**A secret.** Open the alert, which only someone with access to the "
                     "repository's alerts can. If it is real, revoking it comes before anything "
                     "else, and that is the maintainer's to do: the loop marks this `decision` "
                     "and does not take it. Nothing about the secret goes in this issue or in a "
                     "pull request: the repository is public.")
    elif group.get("withheld"):
        parts.append("**A workflow.** Its rule and file are left out of this issue, which is "
                     "public: open the alert, which only someone with access to the "
                     "repository's alerts can. Say no more about it in a pull request than "
                     "the fix needs until the fix has merged.")
    parts += [
        "**For whoever picks this up.** It is an item of the queue. A real alert is fixed "
        "under the usual review, with `Closes #n` in the pull request; the alert closes "
        "itself when the next scan no longer finds it. A false positive, or an alert in "
        "test code, is not dismissed by the loop: only the maintainer may dismiss one. Put "
        "it to them with `file.py decision`, listing each alert, the reason, and the command:"
        f"\n\n    gh api -X PATCH repos/{repo}/{path}/alerts/<number> {flags}\n\n"
        f"The reason is one of {reasons}.",
        f"Kept by security.yml (`.github/scripts/security_alarm.py`), last by {run_url}. A "
        "later alert in this group is added here while this issue is open; once it is "
        "closed, an alert still open is filed again.",
    ]
    return "\n\n".join(parts) + f"\n\n<!-- security-alert {k} -->\n"


def added(old, new, run_url, raised=None):
    """The issue's body with these alerts added above its marker, and
    everything a person wrote in it left as it was. `raised` is the level
    these alerts raise the issue to, if they do; the block says so, since
    the severity line above it keeps the level the issue was opened at."""
    lines = f"**Added by {run_url}:**\n" + alert_lines(new)
    if raised:
        lines += (f"\n\n**Severity:** raised to {raised} by these. The `security: {raised}` "
                  "label places this in the queue while no person has given it a status.")
    m = None
    for m in MARK.finditer(old):
        pass
    if m is None:
        return old.rstrip() + "\n\n" + lines + "\n"
    return old[:m.start()].rstrip() + "\n\n" + lines + "\n\n" + old[m.start():]


# ---------------------------------------------------------------- the effects

class Unreadable(Exception):
    pass


def gh(*args, check=True):
    out = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    if check and out.returncode:
        sys.exit(f"gh {' '.join(args[:2])} failed: {out.stderr.strip()}")
    return out


def read_lines(path):
    """Every page of a REST list, one JSON value a line."""
    out = gh("api", "--paginate", "--jq", ".[]", path, check=False)
    if out.returncode:
        raise Unreadable(out.stderr.strip() or f"gh api {path} failed")
    return [json.loads(line) for line in out.stdout.splitlines() if line.strip()]


def main():
    repo, run_url = os.environ["GH_REPO"], os.environ["RUN_URL"]
    alerts, blind = {}, {}
    for kind in KINDS:
        try:
            alerts[kind] = read_lines(f"repos/{repo}/{kind}/alerts?state=open&per_page=100")
        except Unreadable as e:
            blind[kind] = str(e)
            print(f"::error::could not read the open {kind} alerts: {e}")
    print("open alerts: " + ", ".join(f"{k} {len(v)}" for k, v in alerts.items()))
    # Pull requests are in this list too; only issues are the queue's.
    # An alert is filed only against a whole read of the open issues: one
    # that missed the issue already holding it would file it twice.
    try:
        issues = [i for i in read_lines(f"repos/{repo}/issues?state=open&per_page=100")
                  if "pull_request" not in i] if alerts else []
    except Unreadable as e:
        sys.exit(f"::error::could not read the open issues, so nothing is filed: {e}")
    steps = plan(groups(alerts), issues, repo)
    done = []
    if any(s[0] == "open" for s in steps):
        for label, colour, description in [(SOURCE, "5319E7", "Security alerts; filed by security.yml"),
                                           *SEVERITY_LABELS.values()]:
            gh("label", "create", label, "--color", colour, "--description", description, "--force")
        # Every issue's title, read through the REST listing like the open
        # issues above: `gh issue list --label` goes through the search
        # index, which can miss an SC issue filed minutes ago and hand its id
        # out again, and would miss one whose label was taken off. The same
        # titles `next.py --next-id SC` reads from the issues, though it also
        # reads docs/LANDED.md, which holds no SC entry.
        out = gh("api", "--paginate", "--jq", ".[] | select(.pull_request == null) | .title",
                 f"repos/{repo}/issues?state=all&per_page=100", check=False)
        number = None if out.returncode else next_number(out.stdout.splitlines())
        if number is None:
            print(f"::warning::no item id for the new issues: {out.stderr.strip()}")
    for action, k, group, new, issue in steps:
        if action == "add":
            # A higher severity adds its label; next.py reads the highest
            # label an issue carries, and only while it has no status. A
            # lower one changes nothing.
            have = [lv for lv, (name, *_) in SEVERITY_LABELS.items()
                    if name in {lb["name"] for lb in issue.get("labels", [])}]
            level = severity(new)[0]
            raised = level if all(RANK[level] > RANK[h] for h in have) else None
            gh("issue", "edit", str(issue["number"]), "--body",
               added(issue["body"], new, run_url, raised))
            gh("issue", "comment", str(issue["number"]), "--body",
               f"{len(new)} more open alert(s) in this group, added to the body by {run_url}.")
            if raised:
                gh("issue", "edit", str(issue["number"]), "--add-label", SEVERITY_LABELS[level][0])
            done.append(f"#{issue['number']}: added {len(new)}")
            continue
        title = (f"{PREFIX}-{number:02d}: " if number else "") + group["title"]
        number = number + 1 if number else None
        url = gh("issue", "create", "--title", title[:250], "--body",
                 body(k, group, new, repo, run_url),
                 "--label", ",".join((*QUEUE_LABELS, SEVERITY_LABELS[severity(new)[0]][0]))
                 ).stdout.strip()
        done.append(f"{url}: {title}")
    print("\n".join(done) or "nothing new to file")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write("## Security alerts\n\n"
                    + "".join(f"- {k}: {len(v)} open\n" for k, v in alerts.items())
                    + "".join(f"- {k}: **not readable** ({e})\n" for k, e in blind.items())
                    + "\n" + ("\n".join(f"- {d}" for d in done) or "Nothing new to file.") + "\n")
    if blind:
        sys.exit("::error::a kind of alert could not be read: " + ", ".join(blind))


if __name__ == "__main__":
    main()
