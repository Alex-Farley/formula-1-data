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
where the queue's running order lives. So a cloud session with a valid
token can read issues, open pull requests and watch CI perfectly well, and
still cannot ask "what is next?" or move a card to *In progress*.

No credential changes this. The refusal comes back even on a request that
carries no credential at all, so it is a blanket block rather than a
permissions problem, and a token will not lift it. On your own machine there
is no proxy in the way, and everything works.

## What you need, and what each part is for

| What you need | Why |
|---|---|
| **Homebrew** — macOS only | where the Mac versions of these come from; install it from <https://brew.sh> before step 3 |
| **A GitHub account with push access** to `Alex-Farley/formula-1-data`, and access to the *Lap Ledger* board | the loop pushes branches, merges its own pull requests and moves cards; read access alone is not enough |
| **WSL** — Windows only | gives you the Linux shell the scripts need; see step 0 |
| **git**, **make**, **curl** | fetch the code, run the checks; a fresh Ubuntu may have none of them |
| **`gh`** (GitHub's command-line tool) | how the queue scripts talk to GitHub — **must be a current version**, see step 3 |
| **Python 3.9 or newer** | builds and checks the database |
| **Node 22.13 or newer** | builds and tests the website |
| **ruff**, **actionlint** and **shellcheck** | two of the three linters CI runs, and the checker actionlint hands workflow shell to |
| **Claude Code** | runs the loop |

You do **not** need to copy anything from another computer. Every skill,
script, agent and rule the loop uses is committed to this repository, so
cloning it is the whole transfer.

## Step by step

Two things trip people up in almost every step below. **Run one command at
a time.** Several of them ask for your password, and a second command
pasted in behind the first is swallowed as the password and fails with
*sudo: Authentication failure*. And **the password is invisible as you type
it** — no dots, no stars, the cursor does not move at all. That is normal.
Type it and press Enter.

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

That first window opens by itself. **To get back to the Ubuntu prompt any
time after that**, either open **Ubuntu** from the Start menu or type `wsl`
in a Command Prompt or PowerShell window. The two do not land you in the
same place: the Start-menu app starts in your Linux home folder, while
`wsl` keeps you wherever Windows was, which is usually somewhere under
`/mnt/c/`. If your prompt shows `/mnt/c/...`, type `cd ~` before carrying
on.

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
```
```bash
sudo apt install -y git make curl
```

A fresh Ubuntu — including the one WSL has just installed — has Python but
not `make`, and without `make` step 9 stops with `make: command not found`.
On macOS these arrive with `xcode-select --install`; then install Homebrew
from <https://brew.sh>, which steps 3 and 7 both use.

Worked if: `git --version` and `make --version` both answer.

### 2. Get the code

```bash
cd ~
git clone https://github.com/Alex-Farley/formula-1-data
cd formula-1-data
```

The first line matters: clone it into your home folder. Everything after
this writes `~/formula-1-data`, and two steps send you to a new terminal
and back again.

Worked if: `ls` shows `build.py`, `f1.db` and a `web` folder.

### 3. Install `gh`, but not the easy way

This is the one step with a trap in it. On Linux, `apt-get install gh`
installs version 2.45, which is too old: it is missing a feature
(`--json` on `pr checks`) that the loop uses to watch CI. It will look
installed, and then the first time the loop waits for CI it stops with
`gh is on PATH but too old for these scripts`. Before that check existed it
slept silently for twenty minutes instead, which is why this step is here.

Install a current one instead. These are GitHub's own Debian and Ubuntu
instructions, unrolled into one command per line — they add GitHub's
package repository and install `gh` from it. Run them in order, and let
each finish before starting the next:

```bash
sudo apt install -y wget
```
```bash
sudo mkdir -p -m 755 /etc/apt/keyrings
```
```bash
sudo wget -nv -O /etc/apt/keyrings/githubcli-archive-keyring.gpg https://cli.github.com/packages/githubcli-archive-keyring.gpg
```
```bash
sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
```
```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
```
```bash
sudo apt update
```
```bash
sudo apt install -y gh
```

The middle four print nothing at all on success. `sudo apt update` should
name `cli.github.com` among the servers it reached; if it says
`Temporary failure resolving` instead, see *If something goes wrong*.

Those lines are kept up to date at
<https://github.com/cli/cli/blob/trunk/docs/install_linux.md>, under
*Recommended (Official)*. On a Mac, `brew install gh` and none of this
applies.

Then check you got one new enough, by asking `gh` whether it has the
feature rather than by reading its version number:

```bash
gh pr checks --help | grep -- --json
```

Worked if: it prints a line describing `--json`. **Nothing at all means
your `gh` is too old — or is not installed at all**, whatever number
`gh --version` reports. If the shell answered `gh: command not found`, the
install above did not finish; start it again.

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
It shows a one-time code first — copy it, hyphen included. If the browser
does not open by itself, which happens inside WSL, `gh` prints the address:
open it in Windows and paste the code there.

Then add the two extra permissions the loop needs:

```bash
gh auth refresh -s project,workflow
```

A *scope* is a permission label on your login, and the loop needs two that
a plain sign-in does not grant. `project` is what lets the board be read
and a card moved. `workflow` is what lets you push a branch that changes
anything under `.github/workflows/` — GitHub refuses such a push without
it, and some items make exactly that change.

```bash
gh auth status
```

Worked if: it names your account and lists both `project` and `workflow`
among the scopes, with no mention of an invalid token.

If `gh auth refresh` answers that it cannot refresh this kind of login, you
are signed in from a `GH_TOKEN` environment variable rather than a browser
login. Unset it and run `gh auth login` again, or add the `project` and
`workflow` scopes to that token where you created it.

**Then tell git who you are.** The loop commits on your behalf, and a fresh
Ubuntu has no name or address on record — the first commit it tries would
stop with *Author identity unknown*. `gh auth login` does not set this; it
sets how you authenticate, not who you are.

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Use the address on your GitHub account, so the commits are attributed to
you.

Worked if: `git config --global user.email` prints it back.

### 5. Python

Nothing to install. The database build uses only what comes with Python
itself:

```bash
python3 --version
```

Worked if: 3.9 or newer. If it is not there at all,
`sudo apt install -y python3`. (`requirements.txt` lists `fastf1`, but that
is only for the timing loaders, which are not part of this.)

**CI runs this build on 3.9 and 3.12, and on nothing else.** Anything newer
is untested rather than unsupported — 3.14.4 has been through this whole
guide once and reached `SETUP OK` — but it is worth knowing which side of
the line you are on. If `make all` in step 9 stops with an import or syntax
error, rather than reporting a file that came out different, your
interpreter is the first thing to suspect and a 3.12 installed alongside it
is the fix.

### 6. Node, for the website

Ubuntu does not come with Node, and its own `nodejs` package is older than
this project needs. Install nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.7/install.sh | bash
```

That is the line from <https://github.com/nvm-sh/nvm#installing-and-updating>,
which is where to check whether the version in the URL has moved on.

Then **close the terminal, open a new one, and `cd ~/formula-1-data`** —
nvm only exists in a terminal opened after it was installed, and `exec
bash` does the same thing without closing the window. Then:

```bash
nvm install 22
node --version
cd web && npm ci && cd ..
```

If `nvm install` says `nvm: command not found`, the new terminal is the
step you skipped.

On macOS, nvm works the same way — install it from the same page and run
the same `nvm install 22`. (`brew install node@22` looks equivalent and is
not: Homebrew does not put a versioned Node on your `PATH`.)

`npm ci` installs the site's dependencies. It does **not** install the
browser the tests drive — Playwright's package stopped doing that on
install — so the browser is its own step, the same one CI runs:

```bash
cd web && npx playwright install --with-deps chromium && cd ..
```

This is the slow part: Chromium is about 150 MB. `--with-deps` also
installs, with `apt`, the system libraries the browser needs to start on a
fresh Ubuntu, so it asks for your password.

On macOS there are no system libraries to add — run
`cd web && npx playwright install chromium && cd ..` instead.

Worked if: node reports **22.13 or newer** (`.node-version` says 22, and
`web/package.json` asks for at least 22.13), `npm ci` finishes without
errors, and `ls ~/.cache/ms-playwright` (on macOS,
`~/Library/Caches/ms-playwright`) lists a `chromium-` folder — that last
one is the browser, and it is where the tests will look for it.

`npm ci` downloads the website's dependencies exactly as recorded — it is
not the same as `npm install`, and the loop expects this one.

### 7. The two linters

```bash
sudo apt install -y pipx shellcheck
```
```bash
pipx install ruff==0.16.7
```
```bash
pipx ensurepath
```

The pin is the point: CI runs ruff 0.16.7, and an unpinned newer one can
flag things CI never would — an afternoon spent on a finding that was never
going to fail. `pipx install --force ruff==0.16.7` corrects an unpinned one
already installed. On macOS the same pinned line works; `brew install ruff`
tracks the latest instead.

`pipx ensurepath` adds pipx's folder to your `PATH`; **close the terminal,
open a new one, and `cd formula-1-data` again** — a new terminal starts in
your home folder, and without both the `ensurepath` and the restart `ruff`
will still look missing. On a fresh Ubuntu there may be no `pip` at all, so
pipx is the answer either way.

`actionlint` is not in Ubuntu's package list. Its own installer fetches the
right binary for your machine, and this is what CI runs too:

```bash
cd ~
curl -sSfL https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash | bash -s 1.7.12
sudo mv actionlint /usr/local/bin/
cd ~/formula-1-data
```

It downloads into whatever folder you are in, which is why this starts at
home rather than inside the clone, and the third line moves it somewhere
every terminal will find. On macOS, `brew install actionlint` does both.

The third linter, Biome, downloads itself when needed. Nothing to do.

`shellcheck` is not a fourth linter. actionlint hands every workflow's
`run:` block to it when it finds one on your `PATH`, and quietly skips
those checks when it does not — so without it `make lint` can be green on a
workflow change that turns CI red. CI's runner always has it. On macOS,
`brew install shellcheck`.

Worked if: `ruff --version`, `actionlint --version` and
`shellcheck --version` all answer.

### 8. Claude Code itself

Follow <https://docs.claude.com/en/docs/claude-code/setup>. On Linux and
macOS that page gives you a one-line install:

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Inside WSL, run it at the Ubuntu prompt, not in PowerShell. The first time
you start it, it asks you to sign in.

Worked if: `claude --version` prints a version number. If it says *command
not found*, close the terminal, open a new one and `cd ~/formula-1-data` —
the installer puts `claude` in `~/.local/bin` and adds that to your `PATH`
only for terminals opened afterwards.

### 9. Check it all works

Paste all three lines. The second names any tool that is missing; the
third runs the whole build, the unit tests, all three linters and one last
check, stopping at the first thing that fails.

```bash
cd ~/formula-1-data
for t in git make python3 node npm gh claude ruff actionlint shellcheck; do command -v "$t" >/dev/null || echo "MISSING $t"; done
make all && make test && make lint && git status --short && [ -z "$(git status --porcelain)" ] && echo "SETUP OK"
```

Worked if: nothing says `MISSING`, and the last line is `SETUP OK`. Nothing
else has to be read. The first line is there because the build alone does
not touch `gh`, `claude` or `shellcheck` — a machine can reach `SETUP OK`
and still be unable to run the loop.
Each `&&` stops the chain at the first failure, and the final test is that
the build came out identical to the copy in the repository — if it did not,
the files that differ are listed and `SETUP OK` does not appear.

**`make all` and `make lint` are both noisier than you expect, and that is
fine.** `make all` prints `All checks passed.` and then a count of warnings
— the repository has a handful of things on the record it has not resolved,
and they are not failures — followed by two `wrote …` lines. Ruff says
`All checks passed!`. Biome ends with a few lines about diagnostics it did
not print, then counts of warnings and infos. None of that is a failure.

`make all` takes seconds. `make lint` takes about a minute the first time,
while it downloads Biome; after that it is quick too.

The website has its own check, and the loop runs it on every item — not
only ones that touch the site. It takes a couple of minutes the first time:

```bash
cd ~/formula-1-data/web && npm run build && npm test -- --quiet && cd ..
```

`npm run build` will say `result FAILED` and `the Parquet bundle could not
be built`. That is the download bundle for the site; it needs a Python
package the deploy installs and you do not, nothing else depends on it, and
the build carries on.

Worked if: it ends with a summary line and no failures. If it says
*Executable doesn't exist* and names a path ending in `ms-playwright`,
or that the host is missing dependencies to run browsers, the
`playwright install` half of step 6 did not happen.

If `make lint` stops with `make: actionlint: No such file or directory`
(older `make`, including macOS's, says `Command not found` instead),
the actionlint half of step 7 did not finish. The same message with `ruff`
in it means the pipx half did not — and that one stops the command before
anything else runs, because ruff goes first. Biome is the only one of the
three that fetches itself.

## Your first run

```bash
cd ~/formula-1-data
claude
```

**Before you type the next line: the loop merges by itself, and merging
publishes the site.** When the review passes and CI is green it merges its
own pull request into `main`, and every push to `main` builds and deploys
lapledger.org. Your first run is a production change. If that is not what
you want yet, do not run it: there is no rehearsal mode, and the loop that
picks an item is the loop that merges it. To work an item without
deploying, read it with
`python3 .claude/skills/backlog-loop/next.py <ITEM-ID>` and do it by hand,
opening the pull request yourself — *Working autonomously* in
`CONTRIBUTING.md` is that process.

Then, inside Claude Code:

```
/backlog-loop next
```

It will pick the top item off the board, work it in a separate context, get
an independent review, and merge when CI is green. The session itself shows
nothing at all while that happens.

To watch what it is doing, open a second terminal, `cd` to the folder you
cloned, and run:

```bash
tail -f .claude/loop/progress.log
```

If it says the file does not exist, the loop has not started yet, or you
are in the wrong folder — it creates the file before it does anything
else.

That file is the only view you get of a running item, and it stays empty
until the first stage finishes. **Quiet is normal.** Three runs have been
killed by someone assuming a silent session had hung.

One thing that is *not* quiet: Claude Code asks your permission the first
time it runs each new kind of command, and this repository ships no
approved list, so a first run asks a lot. The loop cannot move while a
prompt is waiting — so stay with it until the questions stop, or turn on
Claude Code's own setting for working without asking. A loop you walked
away from is more likely parked on a prompt than hung.

Other ways to start it:

- `/backlog-loop <ITEM-ID>` — one named item instead of the top one. The id
  is the tag at the start of an issue's title, such as `VD-30`, and the
  issue has to be open.
- `/backlog-loop until-paused` — keep going until you stop it
- add `fast`, `balanced` or `thorough` to set the pace; `balanced` is the
  default

## If something goes wrong

**`SETUP OK` did not appear, and the line above it listed `f1.db` or
`f1_compat.json`** — the build on your machine did not reproduce the
committed files. Check `python3 --version` is 3.9 or newer and that you
have not edited anything under `data/`; on a fresh clone `make all` leaves
the tree clean.

**`Executable doesn't exist at …/ms-playwright/…`** — step 6's browser
install:
`cd ~/formula-1-data/web && npx playwright install --with-deps chromium`.

**`Temporary failure resolving 'archive.ubuntu.com'`** — or any other host,
during `sudo apt update`. WSL's DNS has dropped out, which is intermittent
and nothing you did. **Run `sudo apt update` again**; that clears it more
often than not. If it does not, close the Ubuntu window, run `wsl
--shutdown` in PowerShell, wait ten seconds and start Ubuntu again. If it
still fails and you are on a VPN, disconnect it and retry. A failed
`apt update` leaves nothing half-installed — it fetches a list of packages
and gives up.

**`make: command not found`** — step 1. A fresh Ubuntu does not have it.

**`claude: command not found`** — step 8, or you installed it in PowerShell
rather than at the Ubuntu prompt.

**`ruff: command not found` after installing it** — step 7's `pipx
ensurepath`, and then a new terminal.

**`npm ci` complains about the Node version** — step 6. You need 22.13 or
newer, and Ubuntu's own package is older.

The queue scripts check `gh` before they trust it, and name which of three
things is wrong. If you see:

**`gh is not on PATH`** — step 3 did not happen, or the terminal cannot
find it. Try `gh --version`.

**`gh is on PATH but too old for these scripts`** — step 3's trap: your
`gh` has no `--json` on `pr checks`. Ubuntu's own package (2.45) is the
usual culprit. Install a current one and make sure it is the one found
first (`which -a gh`).

**`gh ran but could not confirm a working credential`** — step 4. Run
`gh auth status`. Note that this message can also appear when GitHub is
rate-limiting you rather than refusing your login, so read the line printed
*above* it: that is `gh`'s own explanation, and it is the more precise one.

If you see a raw Python traceback instead of one of these, something
genuinely unexpected happened — that is worth filing as an issue.

## A red `review` check is not your fault

That workflow runs on a credential that is currently exhausted. It is
infrastructure, not a defect in your change — do not retry it, do not edit
it to make it pass, and do not read its absence as approval. The loop runs
its own reviewer from `.claude/agents/` instead.

## Where the rules live

- `CLAUDE.md` — the conventions, and why each one exists
- `CONTRIBUTING.md` — *Working autonomously* and *The queue*
- `.claude/skills/backlog-loop/` — the driver and its scripts
- `.claude/skills/backlog-item/` — what happens to one item, start to merge
