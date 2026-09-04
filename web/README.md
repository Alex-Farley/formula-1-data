# The web front end

A React app that queries `f1.db` **in the browser**. SQLite is compiled to
WebAssembly, the 1.6 MB database is fetched whole, and every page is real SQL
against it — the same file `./f1` queries from the command line.

There is no server, no API and no build step on the data. That is the point:
the database is already a single self-contained file, so the front end is a
static site that can be dropped on GitHub Pages, Netlify, Vercel or an S3
bucket and will work. Nothing you query leaves the tab.

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # → dist/, ready to upload
npm run preview        # serve the built site locally
npm test               # drive the built site in a real browser (~4s)
```

`npm run dev` is the loop — it starts in about 200 ms and hot-reloads. Reach
for `build` + `preview` only to check the real thing before deploying.

**If you rebuild the database, restart `npm run dev`.** The assets are copied
into `public/` when the dev server starts, so a `python3 build.py` while it is
running leaves you looking at the previous data through a live UI.

`npm run dev` and `npm run build` both run `scripts/copy-assets.js` first,
which copies two files into `public/`:

| File | From | Why it is not committed |
|---|---|---|
| `f1.db` | the repository root | It is a build artefact of `build.py`. A second copy in git would drift from the first. |
| `sql-wasm.wasm` | `node_modules/sql.js` | It belongs to sql.js and comes back with `npm install`. |

So the database the site serves is always the one the last `python3 build.py`
produced. Rebuild the database, and the next `npm run build` picks it up.

## What is where

```
src/db.js            opens the database, runs statements
src/useQuery.js      the { loading, error, data } hook every page uses
src/format.js        NULL rendering, spans, numeric and prose column detection
src/components/      DataTable, page furniture, loading and error states
src/charts/          the chart toolkit — scales, marks, four chart types
src/pages/           one file per route
test/smoke.mjs       drives the built site in a browser
```

`DataTable` renders any `{ columns, rows }` result, which is why the same
component draws the season list and an arbitrary query typed into the SQL
page. It decides alignment and wrapping from the values themselves — numbers
go right in tabular figures, anything over 60 characters is treated as prose
and allowed to wrap, everything else stays on one line.

## The pages

| Route | Shows |
|---|---|
| `/` | Every season, champion, margin and constructors' title |
| `/seasons/:year` | One season: the context, then pole, winner and fastest lap per round |
| `/drivers`, `/drivers/:id` | The register, and a driver's recorded entries |
| `/constructors`, `/constructors/:id` | Records, lineage chains, and every win |
| `/circuits`, `/circuits/:id` | The register, configurations raced, winners, races held |
| `/cars`, `/cars/:id` | The 29 landmark chassis, full spec and design history |
| `/trends` | Four charts over the race records |
| `/console` | Arbitrary SQL, the same as `./f1 sql` |
| `/gaps` | `known_gaps`, `discrepancies` and what is still unverified |

## The charts

Four figures, hand-drawn as SVG rather than pulled from a charting library —
these are a line, a column, a dot plot and a bar, and writing them directly
costs less than bending a library into the mark specs below.

Every figure carries **a table of its own numbers**. That is not decoration:
a value that can only be got at by hovering is a value a keyboard user and a
screen reader cannot get at at all.

A few rules the toolkit enforces, worth knowing before adding a fifth chart:

- **Colour is validated, not chosen by eye.** The series hue is the blue from
  the reference categorical palette, checked against this app's own light and
  dark panel colours. The brand red was the obvious first choice and fails the
  dark-mode lightness band (OKLCH L 0.739 against a 0.48–0.67 band). Keeping
  the two apart also means a data mark never impersonates the red that says
  "you can click this" everywhere else.
- **Text never wears the series colour.** Marks carry the colour; values,
  labels and ticks use ink tokens.
- **Direct-label selectively.** The endpoint of a line, the peak of a scatter,
  the cap of a column — never a number on every point.
- **Axis ticks must be round.** A tick drawn at 0.25 and printed as "0.3" is
  an axis that lies; `ticks()` in `scales.js` picks 1 / 2 / 2.5 / 5 steps, and
  asking it for too many ticks is what pushes it off them.
- **Bars are capped at 24px and rounded at the data end only,** square at the
  baseline they are measured from, with a 2px gap to their neighbour.

## Testing

```bash
npm run build && npm test
```

`test/smoke.mjs` loads the built site in Chromium and checks what it renders
**against `f1.db` itself** — the expected row counts are read from the same
database the page is querying, so the test does not have to be edited every
time the data grows, and it fails when the page is actually broken.

It is the only thing that checks the app works. `npm run build` proves the
JavaScript compiles; it cannot tell you that SQLite loaded, that a query
returned, or that a chart drew anything — all of which fail silently at build
time and blankly in a browser.

Two details worth keeping if you edit it: the whole app is loaded **once** and
then navigated through its own router (a `page.goto` per route would refetch
the 1.6 MB database and re-instantiate the wasm every time), and the preview
server is spawned detached and killed as a process group, so a cancelled run
does not leak a server holding the port.

```bash
CHROME_PATH=/path/to/chrome npm test   # reuse a browser instead of downloading one
```

## Things worth knowing before changing it

**Routing is hash-based.** `#/drivers/senna`, not `/drivers/senna`. A static
host has nothing to rewrite deep links with, and `base: './'` plus a
`HashRouter` means the built site works from any subdirectory with no
configuration. If you put this behind a server that can rewrite, switching to
`BrowserRouter` is a two-line change.

**`locateFile` ignores the filename it is given.** sql.js ships several glue
builds that ask for different wasm filenames — a bundler resolves the
`browser` condition, which wants `sql-wasm-browser.wasm`. The binaries are
identical, so the copy script lands one at a single known name and `db.js`
points every request there. Getting this wrong does not produce a 404: a dev
server answers an unknown path with `index.html`, and you get
`WebAssembly.instantiate(): expected magic word` instead.

**Derived beats stored, here as well.** `circuits.last_gp` is NULL for the 27
venues still in use, so the circuit page reads its race counts and its first
and last Grand Prix from `v_circuits`, which derives them from the races.
The same rule the database follows for driver wins applies to what is
displayed.

**A NULL is "not established", never zero,** and renders as an em dash
everywhere. Do not coalesce it to 0.

**The SQL page only runs reads.** That is a guard rail, not a security
boundary — the database is a copy in the visitor's tab and a reload restores
it. It exists so a mistyped `DELETE` gives a message rather than silently
emptying the table you are looking at.

## What it does not do

No full finishing order, because the database does not hold one: only the
winner, the pole and the fastest lap are recorded per race. A driver's page
says so rather than implying the blanks are DNFs. When
`tools/fastf1_load.py` fills 2018– results, those pages get richer with no
change here.
