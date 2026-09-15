# Running the backlog loop on your own machine

This is a setup guide for one job: getting `/backlog-loop` working on a
computer in front of you. It assumes you have used a terminal before and
nothing else — every step says what to type, and what you should see if it
worked.

If you only want to *read* the database or browse the site, you do not need
any of this. Start at `README.md` instead.

**On Windows, read step 0 before anything else** — it changes every command
in this guide.

## Why it has to be your own machine

A Claude Code session running in the cloud reaches GitHub through a proxy,
and that proxy refuses one particular kind of request — GraphQL. GitHub
serves its project boards *only* over GraphQL, and the Lap Ledger board is
where the queue's running order lives. So a cloud session can read issues,
open pull requests and watch CI perfectly well, and still cannot ask "what
is next?" or move a card to *In progress*.

No credential changes this. The refusal comes back even on a request that
carries no credential at all, so it is a blanket block rather than a
permissions problem, and a token will not lift it. On your own machine there
is no proxy in the way, and everything works.

## What you need, and what each part is for

| | Why |
|---|---|
| **WSL** — Windows only | gives you the Linux shell the scripts need; see step 0 |
| **Claude Code** | runs the loop |
| **git** | fetches the code and pushes your branches |
| **`gh`** (GitHub's command-line tool) | how the queue scripts talk to GitHub — **must be a current version**, see step 2 |
| **Python 3.9 or newer** | builds and checks the database |
| **Node 22** | builds and tests the website |
| **ruff** and **actionlint** | two of the three linters CI runs |

You do **not** need to copy anything from another computer. Every skill,
script, agent and rule the loop uses is committed to this repository, so
cloning it is the whole transfer.

## Step by step

### 0. If you are on Windows

Skip this if you are on macOS or Linux.

The loop cannot run on Windows as it comes. Three of its own scripts are
bash (`precheck.sh`, `ci-wait.sh`, `progress.sh`), the checks run through
`make`, and neither exists in Command Prompt or PowerShell. There are no
Windows versions of them in this repository.

The fix is **WSL**, Windows Subsystem for Linux: a real Ubuntu running
inside Windows. With it, every command in this guide works exactly as
written. In a PowerShell window opened **as Administrator**:

```powershell
wsl --install
```

Restart when it asks. Ubuntu then starts and asks you to choose a username
and password — they are new, and separate from your Windows login. When it
finishes you have a Linux prompt, and that prompt is where everything else
in this guide happens, including installing Claude Code.

Worked if: typing `uname` at that prompt prints `Linux`.

**Do the rest of this guide inside WSL, and clone fresh there** — do not
reuse a folder you already cloned in Windows. Two things go wrong if you
do. Windows git can save files with different line endings, and it does not
keep the mark that says a script is runnable; bash then refuses to run
those three scripts. A clone made inside WSL has neither problem.

Your Windows copy does no harm. Leave it, or delete it once WSL works.

### 1. Get the code

```bash
git clone https://github.com/Alex-Farley/formula-1-data
cd formula-1-data
```

Worked if: `ls` shows `build.py`, `f1.db` and a `web` folder.

### 2. Install `gh`, but not the easy way

This is the one step with a trap in it. On Linux, `apt-get install gh`
installs version 2.45, which is too old: it is missing a feature
(`--json` on `pr checks`) that the loop uses to watch CI. Everything will
look installed and then hang for twenty minutes.

Install a current one instead — from GitHub's own apt repository, from a
release tarball, or on a Mac with `brew install gh`.

Then check you got one new enough, by asking `gh` whether it has the
feature rather than by reading its version number:

```bash
gh pr checks --help | grep -- --json
```

Worked if: it prints a line describing `--json`. **Nothing at all means
your `gh` is too old**, whatever number `gh --version` reports.

This is the same test the loop itself runs, and it tests for the feature on
purpose: the release that introduced it is easy to get wrong, and a version
number you half-remember is not evidence. If you have just installed a
newer `gh` and still get nothing, the old one is earlier in your `PATH` —
`which -a gh` will show you both.

### 3. Sign `gh` in

```bash
gh auth login
```

Choose GitHub.com, then HTTPS, then log in through the browser when it
offers. Then add one extra permission the board needs:

```bash
gh auth refresh -s project
```

A *scope* is a permission label on your login — `project` is the one that
lets the board be read. Without it the loop can see issues but not their
running order.

```bash
gh auth status
```

Worked if: it names your account and lists `project` among the scopes, with
no mention of an invalid token.

### 4. Python

Nothing to install. The database build uses only what comes with Python
itself:

```bash
python3 --version
```

Worked if: 3.9 or newer. (`requirements.txt` lists `fastf1`, but that is
only for the timing loaders, which are not part of this.)

### 5. Node, for the website

```bash
node --version
cd web && npm ci && cd ..
```

Worked if: node reports 22 (the version in `.node-version`), and `npm ci`
finishes without errors. `npm ci` downloads the website's dependencies
exactly as recorded — it is not the same as `npm install`, and the loop
expects this one.

### 6. The two linters

```bash
pip install ruff
```

If pip refuses with *externally-managed-environment* — recent Ubuntu, and
so most WSL installs, do this — use `pipx` instead, which keeps the tool in
its own place:

```bash
sudo apt install pipx
pipx install ruff
```

`actionlint` is not in Ubuntu's package list. Download the binary for your
system from <https://github.com/rhysd/actionlint/releases> and put it
somewhere on your `PATH`, such as `/usr/local/bin`. On macOS,
`brew install actionlint` does it in one step.

The third linter, Biome, downloads itself when needed. Nothing to do.

Worked if: `ruff --version` and `actionlint --version` both answer.

### 7. Check the whole thing works

```bash
make all
make lint
```

Worked if: `make all` ends with *All checks passed* and a count, and
`make lint` finishes silently. This takes a couple of minutes the first
time.

If `make lint` stops complaining that `actionlint` is missing, step 6 did
not finish — that is the usual culprit, and it is the only tool the lint
step will not run without.

## Your first run

```bash
claude
```

Then, inside Claude Code:

```
/backlog-loop next
```

It will pick the top item off the board, work it in a separate context, get
an independent review, and merge when CI is green — then go quiet. To watch
what it is doing, open a second terminal:

```bash
tail -f .claude/loop/progress.log
```

That file is the only view you get of a running item, and it stays empty
until the first stage finishes. **Quiet is normal.** Three runs have been
killed by someone assuming a silent session had hung.

Other ways to start it:

- `/backlog-loop AF-12` — one named item instead of the top one
- `/backlog-loop until-paused` — keep going until you stop it
- add `fast`, `balanced` or `thorough` to set the pace; `balanced` is the
  default

## If something goes wrong

The queue scripts check themselves before doing anything, and say which of
three things is wrong. If you see:

**`gh is not on PATH`** — step 2 did not happen, or the terminal cannot find
it. Try `gh --version`.

**`gh is on PATH but too old for these scripts`** — step 2's trap. You have
2.45. Install a current one and make sure it is found first.

**`gh ran but could not confirm a working credential`** — step 3. Run
`gh auth status`. Note that this message can also appear when GitHub is
rate-limiting you rather than refusing your login, so read the line printed
*above* it: that is `gh`'s own explanation, and it is the more precise one.

If you see a raw Python traceback instead of one of these, something
genuinely unexpected happened — that is worth filing as an issue.

## Two things to know before you merge anything

**Merging `main` publishes the site.** Cloudflare builds and deploys
lapledger.org on every push to `main`, so merging a pull request is a
production change, not just a repository one.

**A red `review` check is not your fault.** That workflow runs on a
credential that is currently exhausted. It is infrastructure, not a defect
in your change — do not retry it, do not edit it to make it pass, and do not
read its absence as approval. The loop runs its own reviewer from
`.claude/agents/` instead.

## Where the rules live

- `CLAUDE.md` — the conventions, and why each one exists
- `CONTRIBUTING.md` — *Working autonomously* and *The queue*
- `.claude/skills/backlog-loop/` — the driver and its scripts
- `.claude/skills/backlog-item/` — what happens to one item, start to merge
