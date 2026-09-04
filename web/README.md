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
```

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
src/pages/           one file per route
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
| `/console` | Arbitrary SQL, the same as `./f1 sql` |
| `/gaps` | `known_gaps`, `discrepancies` and what is still unverified |

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

No charts. The database has good material for them — pole-to-win conversion
by decade, title margins, the power and weight of the cars over time — and
none of it is plotted here. That is the obvious next thing to build.

No full finishing order, because the database does not hold one: only the
winner, the pole and the fastest lap are recorded per race. A driver's page
says so rather than implying the blanks are DNFs. When
`tools/fastf1_load.py` fills 2018– results, those pages get richer with no
change here.
