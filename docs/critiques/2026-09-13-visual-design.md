# Visual design critique — 2026-09-13

**Critic:** `visual-design-critic`, second run.
**Subject:** a fresh `npm run build` of `main` at `aed5fb5` (v2.23), served
with `vite preview` and driven in Playwright Chromium at 1440, 768, 400 and
320 px, both themes. Contrast figures computed from resolved token values
probed on the running page.
**Brief:** the maintainer's asks of 2026-09-13 — a "more exciting" design
language, better track visualisation, a current-season area with more imagery,
correct constructor colours, better tables. Judge typography, hierarchy,
colour, density, rhythm, data graphics and identity against the content the
site has to serve, within the project's constraints: no unsourced fact in the
database, no FOM material, Commons attribution fail-closed; presentation
metadata allowed in the front end.
**Prior:** `docs/critiques/2026-09-11-visual-design.md`, `docs/BACKLOG.md`.
IDs continue from `VD-23`; the numbers below are the critic's order of impact
and the author assigned the IDs.

**Read-only.** Screenshots and capture scripts in the session scratch
directory; **the repository was not modified.**

**Re-checked by the author before filing:** `app.css` paints an accent bar on
`.stats` tiles; `racingColours.js` gives Italy `#c8102e` against `--accent`
`#c81028`; `Atlas.jsx` fixes `strokeWidth="1.6"`; `CommonsImage` and
`CommonsCredit` are imported by `Car.jsx` and `Cars.jsx` only; `/constructors`
sorts alphabetically by default; the Monza race table's *Grand Prix* and
*Layout* columns are constant. Finding 1 duplicates `IA-17` and is filed under
that ID. Finding 12 is a recount of open `VD-03`, not a new item.

---

## The three that matter

**1. The current season is the historical template with live numbers poured
into it.** `/seasons/2026` (13 of 23 rounds run) heads its chart **"HOW THE
TITLE WAS DECIDED"** and its tables **"FINAL DRIVERS' STANDINGS"** / **"FINAL
CONSTRUCTORS' STANDINGS"**. The only genuinely time-critical fact on the site —
*"Next session: Race for the Madrid Grand Prix … in 9 hours"* — is an unstyled
body paragraph below the tiles, smaller and lighter than "The grid: 23
drivers…" beneath it. The calendar's last ten rows are ten identical `not yet
run` chips against thirty em dashes. *(drove the site · defect)* → **`IA-17`**,
with `PD-28`.

**2. The corner-radius encoding — the best idea in the product — is
invisible.** `/circuits/atlas`, dark: adjacent bands of the sequential ramp
measure **1.23 : 1.48 : 1.45 : 1.40** against each other, and `--seq-1` is
**2.83:1** against `--stage`. Spa's trace is one flat blue from La Source to
the Kemmel Straight; the five legend swatches are indistinguishable.
`Atlas.jsx:246` fixes `strokeWidth="1.6"`, so colour is the sole channel.
`VD-17`/`AX-07` fixed the pale end against the stage and left band-to-band
separation untouched — **the fix did not reach the thing the chart is for**.
*(drove the site; computed from resolved tokens · defect)* → **`VD-25`**.

**3. The accent is not reserved, and the racing colour collides with it.**
`app.css:494–500` paints a 22×2 px `--accent` bar on *every* stat tile — eight
on `/drivers/verstappen`, eight on `/constructors/ferrari`, six on
`/circuits/monza`. The token file's own rule ("Never a data mark… one red, and
it means *you can act on this*") is broken by the component that uses it most.
Worse: `racingColours.js` gives Italy `#c8102e` against `--accent` `#c81028` —
**1.002:1**. On Ferrari's page, nine red marks in one viewport carry three
different meanings. *(read the source; computed · defect)* → **`VD-26`**.

---

## The rest, by consequence

**4. The racing-colour swatches are one hex for two themes.** → **`VD-27`.**
Against the panel — dark: US blue **1.78:1**, British racing green
**2.07:1**, bleu de France **2.67:1**, Swiss red **2.74:1**. Light: Belgian
yellow **2.38:1**, silver **2.64:1**. Six of eight fail 3:1 in one theme or the
other, and on `/constructors` (dark) the 3×16 px band is the row's only
identity mark. Before adding any constructor colour, give each entry a `{light,
dark}` pair keyed the same way `--seq-*` already is. The reasoning in
`racingColours.js` is sound and I would not reopen it; the rendering of it is
the defect. *(drove the site; computed · defect)*

**5. The stat tile is the site's signature and it does not rank.** →
**`VD-28`.** Verstappen's eight read `2015–`, `246`, `71`, `132`, `48`, `37`,
`4`, `P1` — identical size, weight and colour. A reader came for **71** and
**4**; they get equal billing with entries. `/races/2026/13` sets three of five
tiles as *underlined names in 22 px display type*, so the underline runs
through the descenders. On `/constructors/ferrari` the seventh tile's label
wraps to two lines, dropping its figure **22 px below the other seven
baselines**, and its title-year list stretches the row to ~200 px. Two ranks:
one or two lead figures at display size, the rest at ~60%; names in `--sans`,
not the condensed display face; never let a tile label wrap. *(drove the site ·
defect)*

**6. Tables carry columns that hold no information.** → **`VD-29`.**
`/circuits/monza` → *Every race held here* (76 rows): **Grand Prix** is
"Italian Grand Prix" 76 times, **Layout** is an em dash 76 times — two of five
columns, ~40% of the width. `/drivers/verstappen` → *Every entry* (246 rows):
**Constructor** is "Red Bull Racing" 246 times. `/seasons/2026`'s standings are
only Pos / Driver / Points, with ~500 px of void between name and figure and no
gap or wins column — the comparison the page exists to make is not drawn. Rule
for `DataTable`: a column whose values are all equal collapses to a line above
the table; add the columns that vary. *(drove the site · defect)*

**7. `/constructors` opens on its least interesting rows.** → **`VD-30`.**
Default sort is alphabetical: AFM, AGS, Alfa Special, Amon, Andrea Moda,
Apollon, Arzani-Volpini. Roughly 60 of the 78 numbers on the first screen are
zero. Sort registers by entries descending by default; alphabetical stays one
click away. *(drove the site · defect)*

**8. At 400 px, `/drivers` hides the column it is sorted by.** → **`VD-31`.**
Only **Driver** and **Nationality** are visible; Wins — which determines the
order — is behind a horizontal scroll, so the list reads as arbitrary. Pin the
active sort column as column two at narrow widths. Separately, the masthead
consumes **280 px** before the `h1` at every route, and `/races/2026/13` at 320
needs ~900 px of scroll past five stacked tiles to reach the classification.
*(drove the site · defect)*

**9. No map on the page where a map would mean most.** → **`VD-32`.**
`/races/2026/13` draws nothing; the circuit is a text link in a tile, while the
browser has already merged the geometry. On `/circuits/monza` the trace sits in
a ~640 px box on a 1440 page with ~55% of the row empty. Reuse `LapFigure` on
the race page at tile-row height, with the winner's name under it; give the
circuit page's map the full measure. *(drove the site · defect)* *Author's note:
`AF-03` — F1DB's layout outlines — puts a shape on every race page, including
the 55 circuits with no trace, and is the larger half of this fix.*

**10. 602 photographs are advertised and almost never shown.** → **`VD-33`.**
The home page's sixth stat tile says `602 PHOTOGRAPHS`;
`CommonsImage`/`CommonsCredit` are imported only by `Car.jsx` and `Cars.jsx`.
Circuits are the highest-yield surface (80 venues, few name-matching problems)
and would answer "more imagery" without the `PD-18` driver-name data work.
*(read the source; drove the site · defect)*

**11. Energy — preference, labelled as such.** → **`VD-34`.** The condensed
display `h1` is the only thing on the page with any velocity; below it,
everything is a white card on grey — twenty-five near-identical boxes on the
home page, and "WHERE TO START" reproduces the top nav item for item. The
excitement is available in the data, not in chrome: draw Ferrari's wins chart
in rosso corsa rather than generic `--series-1`; mark Verstappen's four title
years on the dot plot instead of plotting them as four more blue dots; let the
2026 leader's line own the season chart. *(preference)*

**12. `VD-03` is still open and has not drifted further.** Recount: **19**
literal font sizes, **28** literal spacing values. Worth saying only because
findings 5 and 6 will add components. *(read the source)* → stays **`VD-03`**.

---

## What is well made, and should survive

The token file's stated reasoning and its measured contrast figures;
`--ink-faint` zeros in the registers (`VD-04` landed and works — the careers
do surface); tabular figures applied consistently; the four-state result rail
with the accent-wash P1 row on `/races/*`; Monza's *HOW IT CHANGED* layout
timeline; the atlas's *"What this is, and is not"* and the radius-not-g-force
caveat, which is the best writing on the site; the `sprint` chip; the mono
eyebrow above every `h1`.

## Not examined

The prerendered HTML and no-JS rendering (`VD-01` still open); throttled cold
load; `/reference/*`, `/quality`, `/eras`, `/glossary`, `/sql`; print and
forced-colors; motion; 768 px in dark systematically; hover and focus states
beyond the nav.
