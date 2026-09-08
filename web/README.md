# The web front end

A React app that queries `f1.db` **in the browser**. SQLite is compiled to
WebAssembly and runs in a Web Worker; the database is fetched once, kept in
IndexedDB, and every page is real SQL against it — the same file `./f1` queries
from the command line.

There is no server, no API and no build step on the data. That is the point:
the database is already a single self-contained file, so the front end is a
static site that can be dropped on GitHub Pages, Netlify, Vercel or an S3
bucket and will work. Nothing you query leaves the tab.

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # → dist/, ready to upload
npm run preview        # serve the built site locally
npm test               # drive the built site in a real browser (~10 s)
```

`npm run dev` is the loop — it starts in a couple of hundred milliseconds and
hot-reloads. Reach for `build` + `preview` only to check the real thing before
deploying.

**If you rebuild the database, restart `npm run dev`.** The assets are staged
into `public/` when the dev server starts, so a `python3 build.py` while it is
running leaves you looking at the previous data through a live UI.

## The four files the site serves

`npm run dev` and `npm run build` both run `scripts/prepare-assets.js` first,
which stages these into `public/`. None of them is committed: `f1.db` is a
build artefact of `build.py` at the repository root, the wasm comes back with
`npm install`, and a second copy of either in git is a copy that can drift.

| File | What it is | Size |
|---|---|---|
| `f1.db.gz` | the database, gzipped — the normal path | ~4.5 MB |
| `f1.db` | the database as built — the fallback path | 20 MB |
| `sql-wasm.wasm` | the SQLite engine, from the installed sql.js | 643 KB |
| `db-manifest.json` | a digest, the sizes, and the database's version | ~200 B |

## How twenty megabytes gets to a reader

This is the part of the front end most worth understanding, because it is the
part that decides whether the site is usable at all.

**The manifest is fetched first, and it is the cache key.** It carries a
content digest of `f1.db`. The loader looks that digest up in IndexedDB: on a
second visit the bytes come straight off disk and the database is open in a few
hundred milliseconds with no network transfer at all. A rebuild changes the
digest and evicts the old copy on the way past. A digest rather than an ETag or
a `Last-Modified`, because those are the host's opinion of the file — they
differ between hosts, and a rebuild that produces identical bytes should not
throw away a warm cache.

**The gzip is shipped as a file, not left to the host.** Static hosts do not
agree about whether they will compress an unknown binary type and several will
not, so `prepare-assets.js` gzips the database itself. That makes the 4.5 MB
transfer a property of this repository rather than of whoever is serving it.

**Whether it arrives compressed is not ours to decide.** Plenty of servers —
Vite's own `preview` among them — serve a `.gz` with `Content-Encoding: gzip`,
and the browser inflates it before this code ever sees it. Others hand over the
raw member. Handing already-inflated bytes to `DecompressionStream` fails with
a bare "Failed to fetch", which is a miserable thing to debug in a deployment
you do not control. So the loader asks the bytes rather than the headers: a
gzip member starts `1f 8b`. Then it checks the length against the manifest,
because a truncated download otherwise shows up as a corrupt database several
queries later, which reads as a broken site rather than a broken transfer.

**All of it happens in a worker.** Decompressing 20 MB, instantiating the wasm
and then running a query over 27,460 race entries is time the main thread
cannot spend painting or responding to a keystroke. In a worker it is time the
page spends drawing a progress bar.

**Why not fetch only the pages a query needs?** Range-request VFSs exist and
would make the first paint cheaper. They also need the host to honour byte
ranges, and they turn the aggregate queries this site is mostly made of — a
`GROUP BY` over every race entry — into hundreds of round trips. Fetching the
file once and keeping it makes the *second* page free rather than the first
page cheap, which for a reference work is the better trade.

## What is where

```
src/data/worker.js      SQLite, the loader, and the query protocol
src/data/client.js      the main thread's side of the worker
src/data/cache.js       IndexedDB, keyed on the database's digest
src/data/useQuery.js    the { loading, error, data } hooks every page uses
src/lib/                NULL rendering, Commons URLs, the map projection
src/components/         the shell, DataTable, filters, states, the search palette
src/charts/             scales, the figure frame, four chart types
src/pages/              one file per route
test/smoke.mjs          drives the built site in a browser
```

`DataTable` renders any `{ columns, rows }` result, which is why the same
component draws the season list and an arbitrary query typed into the SQL page.
Given a column spec it takes labels, alignment and a renderer — which is how an
id becomes a link without the table knowing anything about routes. Given none
it works both out from the values themselves.

**Nulls sort last, in both directions.** SQLite sorts NULL first and this
database uses NULL for "not established", so sorting the driver register by
career points naively puts everyone nobody has a total for at the top.
Ordering by a missing value means nothing either way, so they go to the bottom
of both.

## The pages

| Route | Shows |
|---|---|
| `/` | What the database holds, and the way in |
| `/seasons`, `/seasons/:year` | Both championship tables, the title race round by round, the calendar, who entered |
| `/races`, `/races/:year/:round` | Every round; the full classification, the qualifying sheet and the pit stops |
| `/drivers`, `/drivers/:id` | The register, and a career counted from the race records |
| `/constructors`, `/constructors/:id` | Records, lineage chains, every win, every car built |
| `/circuits`, `/circuits/:id` | The register, traced centrelines, layouts as they changed |
| `/circuits/atlas` | All 25 traced circuits: walk a lap, colour it by turn rate, compare them at one scale |
| `/cars`, `/cars/:id` | The chassis register, specifications and photographs |
| `/records` | Published records, and leaderboards derived on every load |
| `/reference/eras` | Eras, regulations, scoring systems, innovations, safety |
| `/reference/quality` | The confidence ladder, the gaps, the disagreements, the coverage |
| `/reference/sources` | Every source, and what each licence cost or bought |
| `/reference/glossary` | Vocabulary and people |
| `/reference/sql` | Arbitrary SQL, the same as `./f1 sql` |

Press <kbd>/</kbd> or <kbd>⌘K</kbd> anywhere for a search across all 3,494
drivers, constructors, circuits, chassis, seasons and races at once. A register
of 862 drivers reached only by scrolling an alphabetical table is a register
nobody reads.

## The track atlas

`circuit_geometry.centreline` is a GeoJSON MultiLineString: the ways of an
OpenStreetMap relation, **in no particular order**. Drawing that needs nothing
more — every way is a line — but measuring along it, or putting a marker a
given distance round, needs the ways stitched end to end into one ordered ring
first. `src/lib/lap.js` does that, and the atlas is what it buys.

**The one-metre join is measured, not chosen.** Ways in a relation share their
junction nodes exactly, so a real join is not "close", it is identical: 1,201
of the 1,208 way ends here sit at 0.000 m from another end. The seven that do
not are 5.4 m to 63.4 m away, and every one is a genuine hole in the trace. A
metre is far above serialisation noise and far below the smallest real gap.
A looser figure stops measuring the same thing — at the 30 m this project used
until now, the Monaco and Montjuïc holes read as joins and only Las Vegas was
ever reported.

**Twenty-two of the twenty-five close.** `build.py` decides it when the row is
admitted and stores the verdict in `closes`, `loose_ends` and `segment_count`;
`verify.py` re-derives all three from the geometry on every build and fails if
the stored answer has drifted. So the front end is not deciding anything — it
reproduces a result the database guarantees, and can check its own stitch
against `measured_km`. The three that do not close are still drawn, in amber,
because an incomplete trace is the best shape anyone has for that circuit; the
scrubber is simply disabled for them.

**Turn rate is derived from the shape, and labelled as such wherever it
appears.** The database holds no corner data at all — no numbers, no names, no
apex positions, no sector boundaries. `turnRate()` measures how fast the
bearing changes over a 50 m window, which is a property of the traced line and
nothing more. The window is not decoration: OSM node spacing is irregular, so a
per-node angle mostly measures how finely that stretch happened to be traced.
The five colour bands are the quintiles of the real distribution over all 6,272
points of the 22 closed laps, so each band is a fifth of the traced distance;
bands picked by hand put 65% of every circuit in the bottom two and washed the
picture out.

Everything is projected to **metres east and south of each circuit's own
centre**, which is what lets the wall switch between fitting each frame to its
circuit and giving every frame the same extent. In the second state the sizes
are honestly comparable: Long Beach really is under half of Spa.

## The look: Pit Wall

The interface is an instrument panel, not a magazine. Condensed display type
(Saira Condensed) carries names and figures, Saira carries the interface, and
**every number that lines up in a column is set in JetBrains Mono** — in a
database whose subject is numbers, the figures get the characterful face and
the prose gets out of the way.

**Dark is not an inversion of light.** Each is stepped against its own ground:
light is paper under a pit-lane strip light, dark is the timing screen. Both
were measured rather than eyeballed, and `tokens.css` records the numbers. One
of them decides a rule elsewhere — accent against body ink is 3.07:1 in light
and 2.78:1 in dark, and only the first clears the 3:1 that would let colour
mark a link on its own, so links keep an underline in both.

Two marks do most of the work:

- **The result rail** down the left of a classification: podium, scored
  points, classified, retired. It is read from `race_entries`, so it is data
  rather than decoration, and it always sits beside the position text — the
  colour never carries the meaning alone.
- **A lit edge** on each stat tile, which is what separates an instrument
  reading from a card. Border, fill and shadow are otherwise spent sparingly;
  the radius is 3px, because a rounded card says "app" and this says "panel".

## National racing colours, and why not team liveries

A per-constructor livery colour **has no source this project can admit**, and
the search is documented at the top of `src/lib/racingColours.js`: F1DB has no
colour field, Wikidata's P465 is absent on every F1 constructor sampled
(Ferrari, McLaren, Williams, Team Lotus, Vanwall, Brabham), the Wikipedia team
infobox has no colour parameter, and formula1.com publishes the current season
only under FOM copyright.

The last point is the one that decides it. This project ranks a source on
licence, cadence and **independent checkability**, and says the third is the
one that matters — it is why fan sites are forbidden as authority. Nothing here
can check a livery hex. A livery is also per-season and often mid-season, so
one colour per constructor is a claim the sport does not support.

So the interface uses the **international racing colours** instead: the
AIACR/FIA convention under which a car was painted for the country it was
entered by, in force until sponsor liveries displaced it around 1968. It is the
reason Ferrari is red. It keys off `constructors.country`, which all 150 rows
have, and covers 131 of them — the countries whose colour is unambiguous.
The rest get nothing rather than a guess.

It is never called a team colour in the interface, and **none of it is in
`f1.db`**: it is presentation metadata, kept in the front end so no unsourced
value can enter the database. If a licensed, checkable livery set turns up,
replacing that one file is the whole job.

One thing the module has to do on the way: the register spells countries
inconsistently — five constructors are "British" where fifty-three are "United
Kingdom", with three "French", one "Italian" and one "Brazilian" among the
nouns, and a few carrying two countries. `canonicalCountry()` folds them.

## The charts

Four figures, hand-drawn as SVG rather than pulled from a charting library —
a line, a column, a bar and a dot plot. Writing them directly costs less than
bending a library into the specs below.

Every figure carries **a table of its own numbers**. That is not decoration: a
value that can only be got at by hovering is a value a keyboard user and a
screen reader cannot get at at all, and it is also the value nobody can copy
into anything else.

A few rules the toolkit enforces, worth knowing before adding a fifth chart:

- **Colour is validated, not chosen by eye.** The three series colours are
  slots 1–3 of the reference categorical palette, run through the palette
  validator against this app's own light and dark chart surfaces with every
  pair in play. `src/charts/palette.js` records the numbers it returned. Three
  is the cap: the fourth slot puts yellow beside orange and that pair fails the
  all-pairs floors.
- **The brand red is never a data mark.** It is the one interactive colour —
  links, the focus ring, the current nav item — and a mark wearing it would be
  a mark that looks clickable. It also fails the dark-mode lightness band.
- **Text never wears the series colour.** Marks carry the colour; values,
  labels and ticks use ink tokens.
- **Direct-label selectively, and drop a label that would collide.** Lines
  converge at the right-hand edge far more often than they separate — a
  two-point championship is the whole reason to draw one — and nudging labels
  apart detaches a number from its line. A colliding label is dropped; the
  legend names the series and the crosshair gives every value.
- **Axis ticks must be round, and whole where the values are.** A tick drawn at
  0.25 and printed as "0.3" is an axis that lies, and a years axis asked for
  more ticks than it has years prints 1985 twice.
- **Bars are capped at 24 px and rounded at the data end only,** square at the
  baseline they are measured from.

## Testing

```bash
npm run build && npm test
```

`test/smoke.mjs` loads the built site in Chromium and checks what it renders
**against `f1.db` itself** — every expected count is read from the same
database the page is querying, so the test does not have to be edited when the
data grows, and it fails when the page is actually broken.

It is the only thing that checks the app works. `npm run build` proves the
JavaScript compiles; it cannot tell you that the worker started, that 20 MB of
gzip decompressed, that SQLite instantiated, that a query returned or that a
chart drew anything — all of which fail silently at build time and blankly in a
browser.

Two of its assertions are there for specific reasons rather than for coverage:
that a photograph renders **both its licence and its photographer**, because
displaying a Commons image without its credit is a licence violation and not a
style choice; and that a `DELETE` typed into the console is refused *and* the
table it named is still there afterwards.

Two details worth keeping if you edit it: the whole app is loaded **once** and
then navigated through its own router (a `page.goto` per route would refetch
the database and re-instantiate the wasm every time), and the preview server is
spawned detached and killed as a process group, so a cancelled run does not
leak a server holding the port.

```bash
CHROME_PATH=/path/to/chrome npm test   # reuse a browser instead of downloading one
```

## Deploying

The build is a directory of static files that carries its own database, so it
needs a static host and nothing else — no server, no API, no database to
provision. `base: './'` and the `HashRouter` mean there is no deploy-time
configuration and no rewrite rules to get wrong: the same `dist/` works at a
domain root, in a subdirectory, or anywhere else.

Three numbers decide which hosts are viable. The largest single file is
`f1.db` at **19.99 MiB**, the whole `dist/` is about **26 MB**, and each
first-time reader transfers **4.7 MB** before the database is in their
IndexedDB and later visits cost nothing.

### Cloudflare

Free, works with a private repository, and its 25 MiB per-file cap clears
`f1.db` with room to spare. Connecting a repository in the current dashboard
produces a **Worker**, not a Pages project, which is why `wrangler.jsonc` sits
at the repository root: a Worker takes its configuration from the repository
rather than from the dashboard. That file declares the site as static assets
and has no Worker code, because there is none to have.

In the dashboard, under Settings → Build:

| Setting | Value |
| --- | --- |
| Root directory | **blank** |
| Build command | `sh tools/cloudflare-build.sh` |
| Deploy command | `npx wrangler deploy` |
| Environment variable | `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` = `1` |

The build command is a script in the repository rather than a line in a
dashboard field, so it can be read and changed like anything else here. It
rebuilds `f1.db` from `data/*.py`, runs `verify.py`, and only then builds the
front end — so a deployed site can never carry a database that failed its own
checks. `verify.py` exits non-zero, `set -e` stops the script, and Cloudflare
keeps serving the previous deployment rather than publishing a bad one.

That gate is the reason to rebuild rather than use the committed `f1.db`. It
costs a few seconds, and `build.py` is deterministic: a rebuild from unchanged
sources produces the same digest, so a deploy that changes no data does not
evict every reader's cached copy.

**Root directory must be blank.** `wrangler.jsonc` is at the repository root,
so `npx wrangler deploy` has to run there to find it, and the build script
expects to start there too. Setting it to `web` breaks the deploy, and setting
it to anything that is not in the repository fails the clone with "root
directory not found" before a build even starts.

The environment variable matters too. `playwright` is a devDependency of this
front end and its install script downloads about 150 MB of browsers that only
the test suite uses. Without it the build still succeeds, but every deploy
pays for a download nothing uses.

The build script does not simply run `python3`. Cloudflare's image puts an
asdf-managed Python first on PATH which is **compiled without the sqlite3
extension** — `import sqlite3` raises `ModuleNotFoundError: No module named
'_sqlite3'`, which a database build cannot survive. The system Python beside
it is a distribution build and has the module, so the script asks each
candidate whether it can import sqlite3 and takes the first that can. If none
can, it says so rather than failing on a traceback thirty lines into a build
log.

Cloudflare also runs `pip install -r requirements.txt` before the build
command, because a requirements.txt at the repository root looks like a
Python project to it. Nothing in that file is needed to build the database or
the site — it is there for `tools/fastf1_load.py` alone — so it costs about
ninety seconds of fastf1, numpy, scipy and matplotlib per deploy. Setting
`SKIP_DEPENDENCY_INSTALL` = `1` in the build environment skips it; the script
installs what it actually needs itself.

Two things resolve because Cloudflare clones the whole repository regardless:
`prepare-assets.js` reads `../f1.db`, and `.node-version` pins Node 22. That
file is at the repository root rather than in `web/` **because the build root
is the repository root** — Cloudflare looks for it there, and a Node older
than 20.19 will not run Vite 8 at all. `NODE_VERSION=22` as an environment
variable does the same job if you would rather not rely on the file.

The build output is not configured anywhere in the dashboard: `wrangler.jsonc`
points at `web/dist`. Check the config with `npx wrangler deploy --dry-run`,
which reads it and lists the files it would upload without needing an account.

### GitHub Pages

`.github/workflows/pages.yml` does this, and additionally rebuilds the
database and runs `verify.py` before it builds the site, so a deployed site
can never carry a database that failed its own checks. It is manual-only
because Pages needs the repository to be public or the account to be on Pro
or Team; the workflow header records the details.

### Anywhere else

Netlify reads the same `_headers` file and needs the same three settings.
Any host that serves a directory works — including `npm run preview` on your
own machine, which serves the production build on `localhost:4173`.

The `_headers` file is written by `prepare-assets.js` rather than committed,
because `public/` is generated. It tells hosts that read it to cache the
database, the wasm and the hashed assets forever, and never to cache
`db-manifest.json` — a stale manifest is the one failure that leaves a reader
on an old database indefinitely.

## Things worth knowing before changing it

**Routing is hash-based.** `#/drivers/senna`, not `/drivers/senna`. A static
host has nothing to rewrite deep links with, and `base: './'` plus a
`HashRouter` means the built site works from any subdirectory with no
configuration. If you put this behind a server that can rewrite, switching to
`BrowserRouter` is a two-line change.

**`locateFile` ignores the filename it is given.** sql.js ships several glue
builds that ask for different wasm filenames — a bundler resolves the `browser`
condition, which wants `sql-wasm-browser.wasm`. The binaries are identical, so
the staging script lands one at a single known name and the worker points every
request there. Getting this wrong does not produce a 404: a dev server answers
an unknown path with `index.html`, and you get
`WebAssembly.instantiate(): expected magic word` instead.

**`standings.after_round IS NULL` is the season as it finished,** not a missing
round. `as_of` reads "final" on those rows, they are what the dropped-scores
rule produced, and for the 2018 constructors' table they are not the same as
the last round's. Reading `after_round` arithmetically turns those NULLs into
round zero, which plots a champion's season total before the first race of the
year — which is exactly what happened here before it was caught.

**Never use `display: contents` on a wrapper you also style through.** The box
tree looks right and CSS selectors match the DOM, so `.fields > dd` silently
matches nothing: the rules, the hairlines and the wrapping all stop applying,
and a provenance URL with no break opportunity pushes the whole page sideways
on a phone. Use a keyed `Fragment`.

**Derived beats stored, here as well.** `circuits.last_gp` is NULL for the 27
venues still in use, so the circuit pages read their race counts and their
first and last Grand Prix from `v_circuits`, which derives them from the races.
Career wins, poles and podiums are counted from `race_entries` on every page
load rather than read from a column.

**A NULL is "not established", never zero,** and renders as an em dash
everywhere. Do not coalesce it to 0. Where a stored figure and a derived one
disagree — a career points total that is net of dropped scores against one that
is gross, a chassis credited six wins by its article and none by the entry
lists — the page shows both and says why, because that disagreement is the
interesting part and is what this database exists to keep.

**The SQL page only runs reads, and a rollback is what guarantees it.** A
statement cannot be classified as a read by looking at its first word: SQLite
accepts a `WITH` clause in front of `DELETE`, so `WITH t AS (SELECT 1) DELETE
FROM drivers` begins with `WITH` and empties the table. Rather than chase that
with a cleverer pattern — which then rejects an honest `WHERE note LIKE
'%delete%'` — every statement runs inside a transaction that is always rolled
back. The keyword check that remains is a courtesy, so a reader who types a
write gets an explanation rather than an empty result.

## What it does not do

No lap-by-lap anything: `laps`, `stints`, `race_timing` and
`race_control_messages` are empty in the committed database, and the pages that
would use them do not exist rather than existing empty. `tools/ergast_load.py
--from-dump --timing` and `tools/fastf1_load.py` fill some of that locally —
those rows are non-commercial and are never committed — and when they are
loaded the SQL console can reach them today.
