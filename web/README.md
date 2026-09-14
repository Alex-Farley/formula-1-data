# The web front end

A React app that queries `f1.db` **in the browser**. SQLite is compiled to
WebAssembly and runs in a Web Worker; the database is fetched once, kept in
IndexedDB, and every page is real SQL against it — the same file `./f1` queries
from the command line.

There is no server, no API and no build step on the data. That is the point:
the database is already a single self-contained file, so the front end is a
static site that can be dropped on GitHub Pages, Netlify, Vercel or an S3
bucket and will work. Nothing you query leaves the tab.

Every route is also written out as a real HTML file at build time, straight
from the database, so each page has its own URL, title and content whether or
not JavaScript runs. See *Prerendering* below.

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

**The digest travels in the asset URL, and that is not optional.** The three
big files are served `immutable` for a year, which is what makes a second visit
free — but they live at paths that never change, so the promise is only true if
something makes the URL move when the bytes do. The loader appends
`?v=<digest>` from the manifest to `f1.db.gz`, `f1.db` and `sql-wasm.wasm`.

Without it the failure is specific and total. The manifest is fetched
`no-cache`, so it is always this build's; the database beside it comes out of a
cache that was told not to ask again until next year. The reader gets this
build's manifest with last build's database, the length check catches the
pairing, and the site will not open at all:

```
The database could not be opened
the database arrived incomplete — 20,963,328 bytes of 21,123,072
```

That is not a hypothesis. Those are two real databases — the 20.0 MB one this
front end was deployed with, and the 20.1 MB one that landed with the sprint-race
data — and every returning reader saw that screen from the moment the second
was deployed until the version went into the URL. A mismatch is now also
retried once with `cache: 'reload'` before it is fatal, which is what rescues a
reader whose cache was poisoned before this shipped, or one behind a proxy that
keys on the path alone.

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
src/queries/            a page's SQL and column lists, read by the page and by prerender.js
src/components/         the shell, DataTable, filters, states, the search palette
src/charts/             scales, the figure frame, four chart types
src/pages/              one file per route
scripts/prepare-assets.js  stages the database, its gzip, the wasm, a manifest
scripts/prerender.js       writes a real HTML file for every route
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

## Prerendering, and why the router changed

The site used to route on the hash. A fragment is never sent to a server, so
`/#/drivers/hamilton` was not a URL anything could fetch: all 2,385 pages here
shared one address, one title and one entry in any index. For a database whose
whole claim is that each figure is traceable, being impossible to cite was the
biggest thing wrong with it.

`scripts/prerender.js` now runs after `vite build` and writes a real
`index.html` for every route, straight out of `f1.db` — the page's facts as
plain HTML, with its own `<title>`, description, canonical URL, Open Graph tags
and JSON-LD. It also writes `sitemap.xml`, `robots.txt` and a `404.html`.
`App.jsx` is a `BrowserRouter`, and deep links resolve because the file is
really there, not because anything rewrites them.

```bash
npm run build                        # includes the prerender
SITE_ORIGIN=https://example.com npm run build     # canonical URLs and sitemap
SITE_BASE=/f1/ npm run build                      # served from a subdirectory
```

**The static block is not hydrated.** It lives in `#prerendered`, outside
`#root`, so React never reconciles with it and there is no markup contract to
keep: `main.jsx` removes it when the database is open. Two useful consequences
fall out of that:

- **First paint no longer waits for twenty megabytes.** A new reader used to
  watch a progress bar for several seconds before seeing anything. Now they get
  the page, and the app replaces it underneath when it is ready.
- **A failed load degrades to the facts.** The block is removed on `ready` and
  only on `ready`. If `f1.db` cannot be fetched at all, the reader keeps the
  page rather than being left with an error panel and nothing else.

Three things must agree on where the site lives, and they all read the same two
variables so they cannot drift: vite's `base`, the router's `basename`, and the
canonical URLs and sitemap prerender.js writes. `SITE_BASE` defaults to `/` and
`SITE_ORIGIN` only affects canonical and `og:url`, so a wrong one costs a tag
rather than a working site.

**`appType: 'mpa'`, and no SPA fallback anywhere.** An SPA rewrite answers any
unmatched path with `index.html` and a 200 — so a missing `f1.db` would arrive
as HTML pretending to be a database, and the first sign of it would be the wasm
compiler complaining about a magic word. Unmatched paths 404. `vite.config.js`
carries a small preview middleware that resolves `/drivers/hamilton` to
`dist/drivers/hamilton/index.html`, because that is what Cloudflare's static
assets do by default and a preview that disagrees with the host hides exactly
the bug nobody finds until they share a link.

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
| `/data` | The database itself: the files, the version and build date, how far to trust it, the licence position |
| `/data/quality` | The confidence ladder, the gaps, the disagreements, the coverage |
| `/data/sources` | Every source, and what each licence cost or bought |
| `/data/sql` | Arbitrary SQL, the same as `./f1 sql`; `?q=` is the permalink |
| `/reference/eras` | Eras, regulations, scoring systems, innovations, safety |
| `/reference/glossary` | Vocabulary and people |

`/reference`, `/reference/quality`, `/reference/sources` and `/reference/sql`
are the old addresses of the `/data` pages. The app answers each with a
`<Navigate replace>` that keeps the query string, and `prerender.js` writes a
redirecting page at each path for a cold arrival, so a citation written before
the move still resolves. Eras and the glossary are about the sport, not the
database; they kept their addresses and are reached from Seasons, Cars,
Circuits, Races and the home page rather than from the masthead.

Press <kbd>/</kbd> or <kbd>⌘K</kbd> anywhere for a search across all 3,494
drivers, constructors, circuits, chassis, seasons and races at once. A register
of 862 drivers reached only by scrolling an alphabetical table is a register
nobody reads.

## The voice, and where a page sends you next

**Write for the reader, not for the schema.** A lede says what is on the page
and what can be done with it; it does not defend a modelling decision. The
methodology has two pages of its own — `/data/quality` and `/data/sources` —
and everywhere else links to them rather than repeating them.

A note beside a table survives only if a reader would **misread the table
without it**: that a blank is an unestablished figure rather than a zero, that
a repeated position is a shared drive rather than a duplicated row, that a
margin before 1991 is net of dropped scores. "Why the column is stored this
way" is not that, and belongs in a code comment, in `schema.sql`, or on the
quality page.

**Every page ends by naming two to four routes out of it.** `Onward` in
`components/Page.jsx` renders that band; where the destination can be computed
from the data on the page it is — a driver's last team and best season, the
constructor's most successful design, the last race held at a circuit — because
a specific link is taken far more often than a generic one. `Stepper` puts the
neighbour on either side under the heading, which is how a reader walks a
calendar or a run of seasons without going back to a list.

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

**The mark is a chequered flag**, four squares by four on a rounded panel,
the light cells on the panel's diagonal chequer and one cell in the lower half
taken by the accent. Sixteen cells rather than six because at 32 px the coarser
grid read as an application icon, and the one accent cell carries the brand at
20 px, where a rule thin enough to fit would disappear. The same
geometry is inlined as the favicon in `index.html`, on a dark panel because a
tab has no theme.

One mark does most of the work:

- **The result rail** down the left of a classification: podium, scored
  points, classified, retired. It is read from `race_entries`, so it is data
  rather than decoration, and it always sits beside the position text — the
  colour never carries the meaning alone.

A stat tile has no lit edge. The mockups drew a short accent bar on each one
to separate an instrument reading from a card; it spent the accent on a mark
that carries no action, and on a Ferrari page it measured 1.002:1 against
rosso corsa in light (`VD-26`). The hairline grid and the mono label do that
work now. Border, fill and shadow are otherwise spent sparingly; the radius
is 3px, because a rounded card says "app" and this says "panel".

## National racing colours, and team liveries from 2010

Two presentation maps, and nothing in `f1.db`. **From 2010, `src/lib/liveries.js` (`AF-04`,
decided 2026-09-13: the front end may carry liveries, the database never).
What a source *can* establish is which colour a team raced in a season and what
the team called it — papaya, Aston Martin Racing Green, rosso corsa — and that
is the fact each entry carries, with the page it was read from and the words it
was read in: the team's own launch release or brand page first, then
formula1.com's launch coverage and the Wikipedia car article — or, for a season
no car article describes, the per-season main and secondary colour tables of
Wikipedia's *Formula One sponsorship liveries* article. The hex is this
palette's rendering of the named colour, not a measurement, and **a mark draws
it unchanged** — papaya is `#ff8000` on every surface and in both themes
(`AF-16`, decided 2026-09-14). It used to be moved in lightness until it
cleared 3:1, the way `VD-27` moved the eight national colours, which is what
turned papaya into `#d66c00` and Mercedes' black into a mid grey. The mark is
decorative: the team's name is always beside it, so the colour never carries
the information alone. What replaces the shift is an edge — `app.css` rings
`.livery` in a colour mixed from the fill and the theme's ink: a darker edge of
papaya on a papaya bar, the outline of a white one on a white panel. Every mark
reads as an outlined bar; what the ring never does is change the colour inside
it. The `{light,
dark}` pair survives for the one surface that still owes 3:1, a **chart
series**, where a line is told from its neighbour by colour with the legend as
the only key.

An entry carries a **`scheme`** — a primary and one or two accents, in that
order — rather than one colour (`AF-15`, decided 2026-09-14: a single principal
colour cannot express silver-and-teal or white-red-black, and Haas and Racing
Bulls were the same white). A mark still draws the primary alone, and the
accents carry no pair — putting them on a page is `AF-17`, which is also
where Haas and Racing Bulls stop being one white bar: both race white in
2026, so the primary alone cannot tell them apart.
Every colour of a scheme says whose choice it is: **`named`** where the word is
the team's own — papaya, Rosso Scuderia, Titanium — and **`sourced`**, which is
the one place the "nothing unsourced" promise is qualified. `sourced: false`
marks a colour this project added because the team is recognised by it and no
cited page names it, and the maintainer's decision is that recognisability wins
here — nothing in this file enters `f1.db`, so these are presentation values,
not database facts — provided no surface presents such a colour as the team's
official one. Two colours are marked so today, Toro Rosso's red and silver
before its 2017 relaunch; a colour cannot be the team's own word and unsourced
at once, and `test/conventions.mjs` refuses one that is. All 180 constructor-seasons from 2010
to 2026 are coloured: `AF-04` left twelve with no source found, and `AF-09`
filled them from the livery article above. `LIVERY_GAPS` is empty and stays
checked — `test/conventions.mjs` holds both lists to `f1.db` so every
constructor-season is in exactly one, and the next one nobody can source is
declared there rather than guessed. `colourForEntry()` routes by era —
the national convention to 1967, nothing for 1968–2009 (a declared gap, drawn
in the neutral palette), the livery from 2010 — and paints the standings and
classification tables, the title-race chart, the calendar strip's winner bar,
and the band on a driver's and a constructor's page.

**Before 1968, the national convention**, `src/lib/racingColours.js`. A per-constructor
livery *hex* has no source this project can admit, and the search is documented at the top of `src/lib/racingColours.js`: F1DB has no
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
value can enter the database.

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
npm run test:units     # the pure functions, in node:test  (~0.2 s)
npm run test:browser   # the built site, in a real browser (~15 s)
npm test               # both
```

**Two layers, because they fail differently.** `test/units.mjs` puts awkward
values through `format.js` and `lap.js` and looks at the
answers — a blank that is not a zero, a hyphenated venue that is not two words,
a three-metre hole that is not a join. `test/smoke.mjs` drives the built site
and can only reach the values that happen to be in `f1.db` on the pages it
happens to open.

**The Shapes section is the one that earns its keep.** A page is not one page;
it is a template over rows that vary in ways nobody had in front of them. The
sprint table on the race page had been broken since it was added — a string
where `DataTable` calls a function, and `result()` called on a bare status
string — and every sprint weekend since 2021 rendered blank. Thirty races.
Nothing caught it, because the only races the test opened were a 1976 grand
prix and a 1955 shared drive. The shapes are now chosen **by query** — a
pit-lane start, a field that mostly failed to qualify, a race not yet run, a
driver nobody has totals for — so the coverage follows the data instead of
going stale beside it.



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
| Build command | `cd web && npm ci && npm run build` |
| Deploy command | `npx wrangler deploy` |
| Environment variable | `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` = `1` |
| Environment variable | `SKIP_DEPENDENCY_INSTALL` = `1` |

**CI is the gate, not the deploy.** The deploy serves the `f1.db` committed to
`main` rather than rebuilding it. That file cannot reach `main` unverified:
`ci.yml` rebuilds the database from `data/*.py`, runs every integrity
check, and compares the committed artefact byte-for-byte against a fresh
build, on every push and every pull request. A database that fails its own
checks fails the merge, which is a better place to stop it than a deploy.

A `tools/cloudflare-build.sh` used to do that rebuild at deploy time and was
deleted. Three deploys were spent discovering that this dashboard field named
the script while the build log announced `cd web && npm ci && npm run build`
— and a build step whose execution cannot be established is worth less than
no build step at all. Its other work had already moved into the npm chain,
which demonstrably runs.

**If you restore anything like it, put the step in `web/package.json` instead.**
That chain runs whatever the dashboard field says, because it is what puts
`f1.db.gz` and `db-manifest.json` on the site.

**Root directory must be blank.** `wrangler.jsonc` is at the repository root,
so `npx wrangler deploy` has to run there to find it, and the build command
`cd`s into `web/` from there. Setting it to `web` breaks the deploy, and
setting it to anything that is not in the repository fails the clone with
"root directory not found" before a build even starts.

The environment variable matters too. `playwright` is a devDependency of this
front end and its install script downloads about 150 MB of browsers that only
the test suite uses. Without it the build still succeeds, but every deploy
pays for a download nothing uses.

**No step may simply run `python3`.** Cloudflare's image carries two
interpreters and neither is sufficient alone:

| Interpreter | `sqlite3` | `pip` |
| --- | --- | --- |
| asdf 3.13, first on PATH | no | yes |
| `/usr/bin/python3` 3.12 | yes | no |

The asdf build is compiled **without the sqlite3 extension** — `import
sqlite3` raises `ModuleNotFoundError: No module named '_sqlite3'`, which
anything touching the database cannot survive. So `scripts/parquet-bundle.mjs`
asks each candidate whether it can import `sqlite3` and takes the first that
can, then installs `pyarrow` for it — falling back, when that interpreter has
no `pip` of its own and Debian has stripped `ensurepip`, to borrowing the
other interpreter's `pip` with `--python-version` and `--only-binary=:all:`
so the wheel matches the target ABI. On the current image that last path is
the one that runs.

Its outcome is written to `public/build-status.txt` and served at
[`/build-status.txt`](https://lapledger.org/build-status.txt), on success as
well as failure. A step allowed to fail without stopping the deploy is exactly
the step whose reason has to reach somewhere readable, and build logs are off
for this project.

Cloudflare also runs `pip install -r requirements.txt` before the build
command, because a requirements.txt at the repository root looks like a
Python project to it. Nothing in that file is needed to build the database or
the site — it is there for `tools/fastf1_load.py` alone — so it costs about
ninety seconds of fastf1, numpy, scipy and matplotlib per deploy. Setting
`SKIP_DEPENDENCY_INSTALL` = `1` in the build environment skips it; the one
step that needs a third-party package installs it itself.

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

## The data layer is not going to be rebuilt

The whole-download design — fetch `f1.db` once, keep it in IndexedDB, query it
in a worker — has carried an unstated worry that lap timing would one day make
the file too big and force a rewrite towards range requests or a server.

It will not, and `docs/TIMING-ARCHITECTURE.md` is the measurement that settles
it: **no source has lap times under a licence that permits redistributing
them.** F1DB is the one source whose licence does allow it, which is why 22,481
of its pit stops ship, and it has no lap times. The empty `laps` table is the
correct state, not an unfinished one.

Prerendering removed the other half of the argument — a first visit no longer
waits on the download to show anything. So there is no ceiling approaching and
no reason to trade a design that works offline for one that needs a live
server. If someone proposes rebuilding this, the question is which of those two
facts has changed.

## What it does not do

No lap-by-lap anything: `laps`, `stints`, `race_timing` and
`race_control_messages` are empty in the committed database, and the pages that
would use them do not exist rather than existing empty. `tools/ergast_load.py
--from-dump --timing` and `tools/fastf1_load.py` fill some of that locally —
those rows are non-commercial and are never committed — and when they are
loaded the SQL console can reach them today.
