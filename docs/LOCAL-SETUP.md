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

| What you need | Why |
|---|---|
| **WSL** — Windows only | gives you the Linux shell the scripts need; see step 0 |
| **git**, **make**, **curl** | fetch the code, run the checks; a fresh Ubuntu has none of them |
| **`gh`** (GitHub's command-line tool) | how the queue scripts talk to GitHub — **must be a current version**, see step 3 |
| **Python 3.9 or newer** | builds and checks the database |
| **Node 22.13 or newer** | builds and tests the website |
| **ruff** and **actionlint** | two of the three linters CI runs |
| **Claude Code** | runs the loop |

You do **not** need to copy anything from another computer. Every skill,
script, agent and rule the loop uses is committed to this repository, so
cloning it is the whole transfer.

## Step by step

### 0. If you are on Windows

Skip this if you are on macOS or Linux.

The loop cannot run on Windows as it comes. Three of its own scripts are
bash (`precheck.sh`, `ci-wait.sh`, `progress.sh`), the checks run through
`make`, and neither bash nor `make` exists in Command Prompt or PowerShell.
There are no Windows versions of them in this repository.

The fix is **WSL**, Windows Subsystem for Linux: a real Ubuntu running
inside Windows. With it, every command in this guide works as written. In a
PowerShell window opened **as Administrator**:

```powershell
wsl --install
```

Restart when it asks. Ubuntu then starts and asks you to choose a username
and password — they are new, and separate from your Windows login. When it
finishes you have a Linux prompt, and that prompt is where everything else
in this guide happens.

Worked if: typing `uname` at that prompt prints `Linux`.

**Do the rest of this guide inside WSL, and clone fresh there** — do not
reuse a folder you already cloned in Windows. Windows git usually saves
files with Windows line endings, and bash then refuses to run those three
scripts, complaining about `\r`. A clone made inside WSL does not have the
problem.

Your Windows copy does no harm. Leave it, or delete it once WSL works.

### 1. The tools Ubuntu does not come with

```bash
sudo apt update
sudo apt install -y git make curl
```

A fresh Ubuntu — including the one WSL has just installed — has Python but
not `make`, and without `make` step 9 stops with `make: command not found`.
On macOS these arrive with `xcode-select --install`.

Worked if: `git --version` and `make --version` both answer.

### 2. Get the code

```bash
git clone https://github.com/Alex-Farley/formula-1-data
cd formula-1-data
```

Worked if: `ls` shows `build.py`, `f1.db` and a `web` folder.

### 3. Install `gh`, but not the easy way

This is the one step with a trap in it. On Linux, `apt-get install gh`
installs version 2.45, which is too old: it is missing a feature
(`--json` on `pr checks`) that the loop uses to watch CI. It will look
installed, and then the first time the loop waits for CI it stops with
`gh is on PATH but too old for these scripts`. Before that check existed it
slept silently for twenty minutes instead, which is why this step is here.

Install a current one instead. On Ubuntu or WSL, follow GitHub's own
instructions at
<https://github.com/cli/cli/blob/trunk/docs/install_linux.md> — the few
lines under *Debian, Ubuntu Linux* add GitHub's package repository and
install from it. On a Mac, `brew install gh`.

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

### 4. Sign `gh` in

```bash
gh auth login
```

Choose GitHub.com, then HTTPS, then say **Yes** when it offers to use your
GitHub login for git as well — that is what lets you push branches without
being asked for a password. Then log in through the browser when it offers.

Then add one extra permission the board needs:

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

If `gh auth refresh` answers that it cannot refresh this kind of login, you
are signed in from a `GH_TOKEN` environment variable rather than a browser
login. Unset it and run `gh auth login` again, or add the `project` scope
to that token where you created it.

### 5. Python

Nothing to install. The database build uses only what comes with Python
itself:

```bash
python3 --version
```

Worked if: 3.9 or newer. (`requirements.txt` lists `fastf1`, but that is
only for the timing loaders, which are not part of this.)

### 6. Node, for the website

Ubuntu does not come with Node, and its own `nodejs` package is older than
this project needs. Install nvm —
<https://github.com/nvm-sh/nvm#installing-and-updating> — then:

```bash
nvm install 22
node --version
cd web && npm ci && cd ..
```

On macOS, `brew install node@22` instead of nvm.

Worked if: node reports **22.13 or newer** (`.node-version` says 22, and
`web/package.json` asks for at least 22.13), and `npm ci` finishes without
errors. `npm ci` downloads the website's dependencies exactly as recorded —
it is not the same as `npm install`, and the loop expects this one.

### 7. The two linters

```bash
sudo apt install pipx
pipx install ruff
pipx ensurepath
```

`pipx ensurepath` adds pipx's folder to your `PATH`; **close the terminal
and open a new one** afterwards, or `ruff` will still look missing. On a
fresh Ubuntu there may be no `pip` at all, so pipx is the answer either
way. On macOS, `brew install ruff`.

`actionlint` is not in Ubuntu's package list. Download the binary for your
system from <https://github.com/rhysd/actionlint/releases> and put it
somewhere on your `PATH`, such as `/usr/local/bin`. On macOS,
`brew install actionlint` does it in one step.

The third linter, Biome, downloads itself when needed. Nothing to do.

Worked if: `ruff --version` and `actionlint --version` both answer.

### 8. Claude Code itself

Follow <https://docs.claude.com/en/docs/claude-code/setup>. On Linux and
macOS that page gives you a one-line install:

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Inside WSL, run it at the Ubuntu prompt, not in PowerShell. The first time
you start it, it asks you to sign in.

Worked if: `claude --version` prints a version number.

### 9. Check it all works

```bash
make all
make lint
```

Worked if: `make all` prints a line starting `All checks passed.` and then
a couple of `wrote …` lines, and neither command stops with an error.

**Both are noisier than you expect, and that is fine.** `All checks
passed.` is followed by a warning count — six today, because the repository
has six things on the record it has not resolved. Then ruff says `All
checks passed!`, and Biome ends with something like `Found 30 warnings`.
None of those is a failure. What matters is that each command runs to the
end and gives you the prompt back. This takes a couple of minutes the first
time.

If `make lint` stops saying `actionlint` is missing, step 7 did not finish
— that is the usual culprit, and it is the only tool the lint step will not
run without.

## Your first run

```bash
claude
```

Then, inside Claude Code:

```
/backlog-loop next
```

It will pick the top item off the board, work it in a separate context, get
an independent review, and merge when CI is green. The session itself shows
nothing at all while that happens.

**It merges by itself, and merging publishes the site.** When the review
passes and CI is green, the loop merges its pull request into `main`, and
every push to `main` builds and deploys lapledger.org. Your first run is a
production change. Read *Two things to know before you merge anything*,
below, before you type this.

To watch what it is doing, open a second terminal, `cd` to the folder you
cloned, and run:

```bash
tail -f .claude/loop/progress.log
```

That file is the only view you get of a running item, and it stays empty
until the first stage finishes. **Quiet is normal.** Three runs have been
killed by someone assuming a silent session had hung.

Other ways to start it:

- `/backlog-loop <ITEM-ID>` — one named item instead of the top one. The id
  is the tag at the start of an issue's title, such as `VD-30`, and the
  issue has to be open.
- `/backlog-loop until-paused` — keep going until you stop it
- add `fast`, `balanced` or `thorough` to set the pace; `balanced` is the
  default

## If something goes wrong

**`make: command not found`** — step 1. A fresh Ubuntu does not have it.

**`claude: command not found`** — step 8, or you installed it in PowerShell
rather than at the Ubuntu prompt.

**`ruff: command not found` after installing it** — step 7's `pipx
ensurepath`, and then a new terminal.

**`npm ci` complains about the Node version** — step 6. You need 22.13 or
newer, and Ubuntu's own package is older.

The queue scripts check themselves before doing anything, and say which of
three things is wrong. If you see:

**`gh is not on PATH`** — step 3 did not happen, or the terminal cannot
find it. Try `gh --version`.

**`gh is on PATH but too old for these scripts`** — step 3's trap. You have
2.45. Install a current one and make sure it is found first.

**`gh ran but could not confirm a working credential`** — step 4. Run
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
