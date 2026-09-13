# Backlog

One list, whatever the source. A finding from a critique, an item the project
has been carrying in its own documents for versions, an idea you had in the car —
they compete for the same time, so they belong in the same place and get ranked
against each other rather than by who raised them.

## How this works

Every item is a checkbox with an **ID**, a **source**, and a **size**. Nothing
else is required.

    - [ ] `PD-04` **Attach discrepancies to the facts.** One component, three
          call sites. — *product critique · S*

**IDs** are a prefix and a number, and they never get reused:

| Prefix | Source |
|---|---|
| `PD-n` | product design critique |
| `AX-n` | accessibility critique |
| `IX-n` | interaction design critique |
| `VD-n` | visual design critique |
| `CD-n` | content design critique |
| `IA-n` | information architecture critique |
| `DA-n` | data architecture critique |
| `SD-n` | service design critique |
| `UR-n` | user research walkthrough |
| `PM-n` | the project's own record — `known_gaps`, `discrepancies`, a *still open* in `docs/`, a `verify.py` warning |
| `AF-n` | yours — an idea, a defect, a want |
| `CR-n` | code review (whole-codebase engineering review) |

A critique's own numbering carries straight over: finding 4 of the product
critique is `PD-04`, and stays `PD-04` even if the list is reordered. A second
product critique continues the sequence rather than restarting it.

**Size** is what it costs, not how much it matters:

- **S** — one sitting. A component, a query, a copy change.
- **M** — a few sittings, shippable in pieces.
- **L** — needs a plan first, and probably a decision that is not obvious.
- **?** — not costed yet. An honest state, and better than a guessed size.

Time here is bursty and unpredictable, so **an L that cannot be broken into
shippable pieces should be a decision to make, not a task to start.**

**Done** items get ticked, keep their ID, and move to *Landed* with the commit
that closed them. **Declining** is a normal outcome: move it to *Declined* with
one line saying why. Neither is deleted — what was declined and why is what a
later critique has to argue against, and a re-raised item can be answered from
here.

New critiques file their findings here as new IDs. `docs/critiques/` keeps the
full reasoning and the evidence; this file is the queue, not the argument.

This is also the **only** queue. An agent working unattended starts here,
reassesses an item against the repository as it is now before touching it —
items go stale, land under other IDs, or get superseded — and files anything it
discovers back here under these conventions. The process around that is in
`CONTRIBUTING.md` under *Working autonomously*.

---

## Decisions needed

One place to look. Each is an open item elsewhere in this file; the ID is
the link. An autonomous run does not take these; it works around them and
adds to this list when it finds another. Struck through when decided, with
the date, then removed at the next tidy.

- ~~`AF-04` **Which eras get a livery palette, and what a hex must cite.**~~
  Decided 2026-09-13 by the maintainer: **2010 onwards**, 2026 first, each
  value sourced to the team's own brand material (press kit, brand guideline
  or launch release; no fan colour-code sites) and carried as a light/dark
  pair, never in `f1.db`; 1950–67 stays the national convention; 1968–2009
  is a declared gap drawn in the neutral series palette. The item in *Next*
  is the work.
- ~~`IA-20` **Rung three: may a search question leave the tab?**~~ Decided
  2026-09-13 by the maintainer: **deferred** until rungs one and two have
  shipped and the question library's coverage can be seen. Not to be taken
  by an autonomous run; re-raise here with that evidence. If it is then yes,
  as an explicit opt-in that sends only the question and the schema and runs
  the returned SQL locally.

- ~~`LV-01` **Live session data.**~~ Decided 2026-09-12: the weekend
  timetable (a) and after-the-fact session classifications (b); a live feed
  (c) declined unless a licence is obtained. Work continues as `LV-02` and
  `LV-03` under *Next*.
- ~~`PM-04` **The GitHub repository description.**~~ Decided and applied
  2026-09-12.
- ~~`PM-33` **Review cost: which model, and when a fix needs no further
  pass.**~~ Decided 2026-09-13 by the maintainer, after the 2026-09-12 run
  spent 40,000-130,000 tokens a reviewer pass over two or three passes a PR:
  Opus for a first pass on data and front-end alike (the front end reviewed
  thoroughly, with a design eye); a fresh Sonnet context to confirm a fix or
  to review a docs-, backlog- or wording-only change; one reviewer, with the
  licence reviewer added only when a source is added or reclassified, a
  workflow, export or publishing path is touched, or a whole dataset is
  taken from one source; a post-PASS fix that is only documentation wording,
  a blank line or a comment merges without a further pass, named in the PR
  comment. Set in `.claude/skills/backlog-loop/SKILL.md`; `CLAUDE.md` and
  `CONTRIBUTING.md` point at it (#98).
- ~~`LV-04` **Is a full season's timetable within facts-only?**~~ Decided
  2026-09-12: option (a), proceed as facts-only, with the reading recorded in
  `docs/COMMERCIAL-READINESS.md` (a public schedule the promoter and the FIA
  both publish, not a compilation whose value is in the collecting; five
  rows an event) and the FIA event timetable as the independent check still
  owed (`known_gaps` #15). #91 leaves draft.
- ~~`PD-03` **`/records`.**~~ Decided 2026-09-12: derive the records; the
  item in *Now* is the work.
- ~~`IA-02` **The masthead's "Reference" slot**~~ Decided 2026-09-12:
  becomes "Data"; the item in *Now* is the work.
- ~~`WK-01` **The qualifying-format history.**~~ Decided 2026-09-12: go
  ahead, FIA-sourced; the item in *Next* is the work.
- ~~`AF-02` **The wording of the cross-checked claim.**~~ Decided 2026-09-12:
  the cross-checked wording stands; the three follow-ons in *Next* remain.

## Now

*Re-ranked 2026-09-13 by the maintainer, after a design review of the seven
asks he put to it — a more exciting design language, better track
visualisation, a current-season area, correct constructor colours, better
tables, natural-language search, and what an expert would add — with four
independent critics run the same day; filed in
`docs/critiques/2026-09-13-*.md`, the synthesis in
`2026-09-13-design-review.md`. His direction: **Now and Next concentrate on
the visual elements.** The non-visual queue is unchanged and sits under
*Carried over* below Next. The 2026-09-11 re-ranking note that stood here is
in that day's critiques; its false statements are all landed and three of its
four *Now* items had landed too, still listed open (`PM-34`, cleared with this
re-rank).*

Each item here is a visual surface contradicting something the project
states in its own words, or the one M with the largest visual return. Every S
is independent.

- [ ] `PD-02` **Make the prerenderer call the page components' own queries.**
      Static and app emit different numbers under the same label — 14 of 38
      drivers with a stored `entries` disagree with the derived count, and the
      other 824 show an em dash statically and a real figure in the app. Then
      make `smoke.mjs` assert the *static* output against the database as it
      already does the app's, which is what would have caught this on the day it
      shipped. Two later findings have the same root cause and should ship
      with it rather than as separate passes: `CD-04` (the static half prints
      the numbers and deletes the rules for reading them) and `IA-03` (the app
      has no breadcrumb, the static page has no onward band). A third,
      `PD-06`, shares the *query* rather than the render: both turn on deriving
      `entries` and `starts`, so the register's two empty columns and the
      static/app mismatch are one fix seen from two ends. —
      *product critique · M*
      **Four riders remain**, all the same defect on other faces: `VD-01`
      (the static half is a *different design*, 126 lines of its own CSS),
      `AX-17` (no static table has a caption), `CD-04` and `IA-03`. `UR-06`,
      `UR-13` and `PD-06` were riders and have landed (`6a3269d`, #64, #69).
      **Rung one landed in #77**: drivers register, driver page, records share
      their queries and column lists with the prerenderer. **Rung two landed
      in #102**: the seasons list, the season page (calendar, both standings
      tables, who entered) and the races list read `queries/seasons.js`,
      `season.js` and `races.js`; the static tables carry the app's footers;
      `smoke.mjs` asserts static against app on six more tables and for the
      season in progress asks for the heading the shared rule computes.
      **Rung three landed in #103**: the constructors, circuits and cars
      registers read `queries/constructors.js`, `circuits.js` and `cars.js`
      — the static circuits register derives its race counts from the races
      as the app does instead of reading the stored `gp_count`, and answers
      its Traced column from `f1-geometry.db` beside the database. **Rung
      four landed in #104**: the race page's classification, qualifying,
      sprint and pit-stop tables read `queries/race.js` — the static page
      gains the last three, which it never had, its classification gains the
      chassis and fastest-lap columns and the app's order, and the rail, the
      "shared" mark and the fastest-lap glyph carry the same words for a
      screen reader in both renderers. **Rung five landed in #105**: the
      constructor page's season-by-season, every-win and cars-built tables
      and the circuit page's most-wins, constructors and every-race tables
      read `queries/constructor.js` and `circuit.js` — the static pages had
      one table each, from `race_results` in year order, and gain the other
      two. Still to follow: the car and data pages.

- [ ] `AF-03` **Draw every layout the championship has raced on, from F1DB.**
      F1DB (source 10, CC BY 4.0) ships an SVG outline for each of its 160
      circuit layouts across 78 circuits — four styles, 500×500, ~1.7 KB, in
      `src/assets/circuits/`, not in the release zip — and every F1DB race
      carries `circuitLayoutId`. Aliased over ten ids, that is all 80 venues,
      all 23 rounds of 2026 including Madring, and the historic layouts OSM
      structurally cannot hold: seven Monzas, eight Silverstones. Not
      geo-referenced, not scaled, no direction — so the 25 measured traces stay
      for true scale, corner radius and walking the lap, and the rule is
      printed where a shape appears: *the outline is F1DB's, for every layout;
      the trace is OpenStreetMap's, where it exists.* Three S pieces: (1)
      `tools/f1db_fetch.py` writes the path data and the layout register to
      `harvest/` as text, the F1DB layout id lands on each race, and this
      project's finer `circuit_layouts` keeps its splits with a column naming
      the F1DB layout each draws with — the paths are CC BY, so unlike the
      traces they may live in `f1.db`; (2) the outline on every race page,
      where today the circuit is a text link (`VD-32`), and beside the trace on
      every circuit page; (3) the season calendar as a strip of outlines with
      run / next / to-come states (`PD-28`'s calendar). One credit line —
      *Circuit outlines from F1DB (CC BY 4.0), drawn by Jules Roy* — in the
      footer and on `/data/sources`. Pointed out by the maintainer,
      2026-09-13. — *yours · M, in three S*

- [ ] `VD-26` **The accent is not reserved, and the racing colour collides
      with it.** `tokens.css` says one red means *you can act on this* and is
      never a data mark; `app.css` paints a 22×2 px `--accent` bar on every
      stat tile — eight on a driver page, eight on Ferrari's. Italy's rosso
      corsa `#c8102e` against `--accent` `#c81028` measures **1.002:1**, so on
      `/constructors/ferrari` nine red marks in one screen carry three
      meanings. Remove the bar; the accent keeps links, focus and the current
      nav item. Prerequisite for `AF-04`. — *visual critique · S*

- [ ] `VD-27` **The eight racing-colour swatches are one hex for two themes.**
      Against the panel in dark: US blue 1.78:1, British racing green 2.07:1,
      bleu de France 2.67:1, Swiss red 2.74:1; in light: Belgian yellow 2.38:1,
      silver 2.64:1. Six of eight fail 3:1 in one theme or the other, and on
      `/constructors` in dark the 3×16 px band is the row's only identity
      mark. Give each entry a `{light, dark}` pair keyed the way `--seq-*`
      already is; the same shape `AF-04` will use. The reasoning in
      `racingColours.js` is sound; the rendering is the defect. — *visual
      critique · S*

- [ ] `VD-25` **The corner-radius encoding — the best idea in the product —
      is invisible.** `/circuits/atlas` in dark: adjacent bands of the
      sequential ramp measure 1.23 : 1.48 : 1.45 : 1.40 against each other and
      `--seq-1` is 2.83:1 on `--stage`; Spa is one flat blue from La Source to
      Kemmel and the five legend swatches cannot be told apart.
      `Atlas.jsx:246` fixes `strokeWidth="1.6"`, so colour is the sole channel.
      `VD-17`/`AX-07` fixed the pale end against the stage and left band-to-band
      separation untouched. Re-step the ramp so every adjacent pair clears 2:1
      in both themes, and vary stroke width by band so colour is not alone.
      Closes `AX-07`, which rides. — *visual critique · S*

- [ ] `AX-07` **The atlas ramp and one light chart series are under 3:1. 1.4.11.** `--seq-1` 1.99:1; no two bands 2:1 apart; `--series-3` 2.65:1. Same fix as `VD-17`. — *accessibility critique · S*

- [ ] `VD-28` **The stat tile is the site's signature and it does not rank.**
      Verstappen's eight — `2015–`, `246`, `71`, `132`, `48`, `37`, `4`, `P1` —
      at one size, one weight, one colour; a reader came for 71 and 4.
      `/races/2026/13` sets three of five tiles as underlined names in 22 px
      display type, the underline through the descenders; on
      `/constructors/ferrari` the seventh tile's label wraps and drops its
      figure 22 px below the row's baseline. Two ranks: one or two lead
      figures at display size, the rest at ~60%; names in `--sans`; a label
      never wraps. `PD-15` decides *which* figures lead a driver's strip; this
      is the shape. — *visual critique · S*

- [ ] `PD-19` **731 chassis pages carry a photograph and no static page carries an `<img>`.** Emit the image from `prerender.js` with `CommonsCredit`'s fail-closed rule honoured, and extend `smoke.mjs`. `UR` found the app already places it second on the page; the static half has none. — *product critique · S*

- [ ] `PD-20` **No `og:image` on any of 3,515 pages.** Every shared link renders as a grey box. Confirmed car photo where `name_matches = 1`; a generated SVG card elsewhere; `summary_large_image`. Four of six personas arrive this way (`UR`). — *product critique · S*

## Next

Worth doing, not yet urgent. **The visual work first, in the order the
review sequenced it**; then the review's other asks; then everything carried
over unchanged.

### The visual work

- [ ] `PD-17` **F1DB publishes six driver fields the harvest discards.** `placeOfBirth`, `abbreviation`, `permanentNumber`, `bestStartingGridPosition`, `totalRaceLaps`, `familyRelationships` — CC BY 4.0, already fetched in part. The last two arrive as cross-checks. — *product critique · S*
      **2026-09-13 re-rank:** **moved up.** `permanentNumber` and `abbreviation` are the car number and three-letter code `PD-28`'s grid and standings want; the harvest change is the same S it was.

- [ ] `CR-07` **The season is a magic number in nine files.** `2026` 158 times; no `CURRENT_SEASON`. S for the constant, then one file per sitting. `SD-12` is the service face. — *code review · M*
      **2026-09-13 re-rank:** **a prerequisite, moved up.** `IA-19`'s chip label *On the 2026 grid* on four registers, `IA-18`'s `/now` and `PD-28`'s *after round 13* all read the season; each must read the constant or they add to the 158. The S half (the constant) ships before them.

- [ ] `PD-28` **A season page that knows it is September.** The one ask
      that changes who the site is for. No ninth masthead item (`IA-18`): the
      season page branches on status and `/now` redirects to it. It leads
      with the lead — leader, gap, rounds run of total, and the next session
      with local and UTC time, the one fact that changes hourly; standings
      that admit they are running, with gap and wins columns; the calendar as
      `AF-03`'s strip of outlines in three states, winner where run; the
      weekend timetable from `sessions` (115 rows for 2026, no page); the grid
      from `v_current_grid` — eleven teams, two drivers, car and power unit —
      in `AF-04`'s colour; driver pages led by the season (a finish-per-round
      dot strip, the team-mate head to head) with the career below; car pages
      for this year's chassis led by the photograph; the next venue's outline,
      trace, past winners and sessions. And **title permutations** — who can
      still win, from `points_systems` and rounds remaining — pure SQL, the
      most-asked question every September, a claim the broadcaster does not
      make. Print *as of round 13* and the build date on it: the dependency is
      harvest cadence (`SD-14`), not code. Rides: `IA-18`, `IA-19`. — *product
      critique · M, in S pieces*

- [ ] `IA-18` **No stable address for the current season.** Add `/now` as a
      `Moved`-style redirect to `MAX(year)` — `App.jsx:207` has the pattern —
      guessable, shareable, the one URL a returning fan types. Not a masthead
      item. — *IA critique · S*

- [ ] `IA-19` **One concept, two labels, and two registers have neither.**
      `/drivers` offers *On the 2026 grid*; `/constructors` calls the same
      idea *Active* (`Constructors.jsx:78`); `/cars` and `/circuits` have no
      path to this year's chassis or calendar at all. One chip, one label —
      *On the 2026 grid* / *On the 2026 calendar* — on all four registers.
      Four small diffs, and the highest-value structural change on the site.
      — *IA critique · S*

- [ ] `AF-04` **A livery palette, keyed by constructor and season, in the
      front end.** `racingColours.js` is right that no livery may enter
      `f1.db` — no F1DB field, Wikidata P465 empty for every constructor
      sampled, formula1.com's values FOM copyright and uncheckable here — and
      right that it already holds a presentation palette whose map can be
      swapped. This is a second map beside the first: 2026's eleven first,
      then back to 2010 (about 180 constructor-seasons); every hex with its
      source in the file (the team's press kit, brand guideline or launch
      release — facts-only is fine because nothing enters the database);
      every entry a `{light, dark}` pair clearing 3:1 on the panel (`VD-27`'s
      shape); the colour named as the team names it — papaya, rosso corsa —
      so the interface can say what it shows. 1950–67 keeps the national
      convention, the era this record most owns; 1968–2009 is a declared gap
      in the neutral series palette until filled. Used on the standings rail
      and season chart, the grid cards, a stripe on the driver header for the
      current team, the calendar strip's winner mark. Needs `VD-26` first. The
      product critic's `PD-31` argued for declining liveries permanently; the
      maintainer overruled it for the front end and upheld it for the
      database (see *Declined*). Scope decided 2026-09-13: 2010 onwards. —
      *yours · M*

- [ ] `VD-34` **Let the entity own its page's colour.** Ferrari's wins chart
      is drawn in generic `--series-1`; Verstappen's four title years are four
      more blue dots; the 2026 leader's line does not lead the season chart.
      Charts and rails on driver, constructor and season pages take the
      constructor's colour from `AF-04`, falling back to the national colour,
      then to the series palette; title years are marked, not plotted; the
      leader's line owns the chart. The excitement is in the data, not the
      chrome — this is where it is spent. — *visual critique · S*

- [ ] `PD-30` **Draw the three lap-referenced things the licence permits.**
      (a) Grid position against finish position, retirements falling out at
      the lap they stopped, every race since 1950 — the one that gives a race
      page motion and needs nothing new; (b) stint windows from
      `pit_stops.lap_number` + `race_entries.laps_completed`, 610 of 614 races
      since 1994, with an empty state before 1994 that says so; (c) gap to
      pole from 26,756 qualifying rows with Q1/Q2/Q3 where held. All three in
      `Figure.jsx`'s convention with a table of their numbers, prerendered as
      static SVG, at the top of the race page beside `AF-03`'s outline. Not a
      replay, and `PD-29` says why. — *product critique · M*

- [ ] `VD-32` **No map on the page where a map would mean most.**
      `/races/2026/13` draws nothing though the browser has merged the
      geometry; on `/circuits/monza` the trace sits in a 640 px box on a 1440
      page with 55% of the row empty. `AF-03` puts an outline on every race
      page including the 55 untraced circuits; this is the rest — `LapFigure`
      at tile-row height on the 25 traced ones, and the circuit page's map at
      the full measure. — *visual critique · S*

- [ ] `VD-33` **602 photographs are advertised on the home page and shown on
      two.** `CommonsImage`/`CommonsCredit` are imported by `Car.jsx` and
      `Cars.jsx` only. Circuits are the highest-yield next surface — 80
      venues, the fewest name-matching problems — and answer *more imagery*
      without `PD-18`'s driver-name data work. Fail-closed as today; static
      with the credit as `PD-19`. `VD-23` (three redirects a thumbnail) rides.
      — *visual critique · S*

- [ ] `VD-23` **Each thumbnail is three redirects.** `thumbUrl()` asks
      `Special:FilePath`, which redirects — the visual critique counted three
      hops — before `upload.wikimedia.org` answers; holding the resolved URL
      (or the file's SHA-1 path) in
      `article_images` would make it one. A harvest change with a check that
      the stored URL still resolves. Split from `VD-20`. — *visual critique ·
      S*

- [ ] `AX-13` **Photograph `alt` is the file name, ".jpg" included. 1.1.1.** `Cars.jsx` already does it right. — *accessibility critique · S*
      **2026-09-13 re-rank:** **moved up**, beside `VD-33`: every new photograph surface multiplies this until the `alt` is derived from the article name everywhere.

- [ ] `VD-29` **Tables carry columns that hold no information, and lack the
      ones that vary.** Monza's 76 races: *Grand Prix* is "Italian Grand Prix"
      76 times and *Layout* an em dash 76 times, two of five columns;
      Verstappen's 246 entries: *Constructor* is "Red Bull Racing" 246 times.
      The 2026 standings are position, driver, points, with 500 px of void
      and no gap, wins or change-since-last-round. A `DataTable` rule: a
      column whose values are all equal collapses to a line above the table;
      and add the columns that vary. — *visual critique · S*

- [ ] `VD-30` **`/constructors` opens on its emptiest rows.** Alphabetical
      by default: AFM, AGS, Alfa Special, Amon, Andrea Moda; roughly sixty of
      the seventy-eight figures on the first screen are zero. Default sort by
      entries descending on every register, alphabetical one click away. —
      *visual critique · S*

- [ ] `AX-06` **White on `--accent` is 3.34:1 in dark — the Run button. 1.4.3.** Dark foreground on the fill. — *accessibility critique · S*
      **2026-09-13 re-rank:** **moved up**: a contrast defect on the one button the console has, and `VD-26`/`VD-27` are in the same file.

- [ ] `IA-08` **No filter or sort state is in any URL, anywhere.** Zero hits for
      `useSearchParams`, `URLSearchParams` or `location.search` across
      `web/src/`, so no register's filters, chips, sort column, direction or
      page can be linked or restored. Sized M and worth doing after `IA-02`
      settles the structure it would encode. — *IA critique · M*

- [ ] `IA-23` **User-selectable columns, after `IA-08`.** `DataTable.jsx:32`
      already normalises columns to objects, so a `visible` flag and a small
      popover is a contained change, as `?cols=`; each register declares a
      default set and a full set, and `prerender.js` emits the default. It
      must come after `IA-08`, or a column set nobody can link to is a third
      divergence between what a reader sees and what they can cite. `PD-33`
      argued for declining pickers in favour of the console; the maintainer
      wants them, and `IX-27` shows where they pay first. — *IA critique · M*

- [ ] `IX-27` **On a phone, 632 px of every register row is off screen.** At
      390 px the `/drivers` wrapper is 344 px against a 976 px table; Wins,
      poles and titles — the reason the page exists — are past the edge with
      only a fade to say so, and the column the list is sorted by is hidden
      (`VD-31`, folded in: pin the active sort column second at narrow
      widths). The phone half of `IA-23`: a *Columns* control with a phone
      default of three, in the query string. — *interaction critique · M*

- [ ] `IX-18` **Sticky table headers have never stuck.** `thead th { position:
      sticky }` under `.table-scroll { overflow-x: auto }`, which forces
      `overflow-y: auto` and makes the scroller the sticky container — a box
      that never scrolls vertically. Forty rows into `/drivers` the header is
      1,193 px above the viewport and a reader sees `210 10 48 12 21 0` with no
      labels. `overflow-y: clip` on `.table-scroll`. One line. Supersedes
      `AX-18`, which filed the symptom. — *interaction critique · S*

- [ ] `IX-20` **Sortable and dead headers look the same.** On `/seasons/1976`
      four of five tables do not sort and nothing marks the difference at
      rest; the race classification and the standings — the two a reader most
      wants to sort — are dead to the click after `/drivers` has taught that
      every column sorts. A dimmed sort glyph on every sortable header; make
      classification and standings sortable. — *interaction critique · S*

- [ ] `IX-26` **Nothing can be taken away.** No copy or download on any
      table or SQL result; `/data/sql` exposes Run. One *Copy as TSV* in
      `.table-foot`, which every table already renders. — *interaction
      critique · S*

- [ ] `IX-28` **The filtered empty state says two words.** `zzzz` + Brazil +
      Champions → *Nothing recorded.*, header row gone, nothing naming which
      of three filters did it, no clear-all. *No driver matches "zzzz" among
      Brazilian champions* and a Clear filters button. `CD-17`'s second
      verdict, placed. — *interaction critique · S*

- [ ] `IX-19` **The handover deletes rows under the reader.** Static
      `/drivers` is 862 rows; at ~13 s on 4 Mbps the app replaces it with 150.
      A reader scrolled to row 700 lands at the top with that driver gone and
      nothing said. Seed `DataTable`'s visible count from the prerendered
      table's `data-rows`; collapse only afterwards. — *interaction critique ·
      M*

- [ ] `IX-24` **The atlas has no address.** Selecting Monaco and true scale
      leaves the URL at `/circuits/atlas`; Back leaves the site. Nothing about
      the atlas is linkable, so no animated version of it could be shared
      either. `replaceState` to `?c=monaco&scale=1&at=1240` on every control
      change, read on mount. `PD-21` (make the wall the page) and `PD-22`
      (prerender the 25 shapes) ride. — *interaction critique · M*

- [ ] `PD-21` **`PD-08` answered: the atlas is a comparison surface, arranged as the opposite.** Three S pieces: address it (`/circuits/atlas/:id` — all 25 inbound links land on Spa today); invert the page so the true-scale wall leads, at a width where the cells can be read (`UR`: 29–97 px today); state the selection rule (Silverstone, 61 races, untraced; Donington, 1, traced). — *product critique · M*
      **2026-09-13 re-rank:** the *state the rule* piece is now two sentences, printed where a shape appears — *the outline is F1DB's, for every layout; the trace is OpenStreetMap's, where it exists* (`AF-03`). The true-scale wall stays traces-only: F1DB's outlines carry no scale, so they cannot join it.

- [ ] `PD-22` **The atlas is the only page type with no prerendered content.** Prerender the 25 shapes as static SVG; the geometry is already read by `prerender.js`. `AX-09`'s banded-runs table answers 1.1.1 at the same time. — *product critique · S*

- [ ] `IX-16` **`IA-08` escalated: Back restores the scroll and not the filter.** France filter, sort by wins, scroll, open a driver, Back — same pixel, 862 unfiltered rows. Do `/drivers` first. — *interaction critique · M*

- [ ] `PD-15` **The driver stat strip is designed for a champion and rendered for a privateer.** 625 of 862 pages show four zeros. Show Wins/Podiums/Poles/FL only where one is non-zero; fill from Best grid, Starts, Retirements, Laps, Constructors — all one `SELECT` away. One tile per sitting. — *product critique · M*

- [ ] `PD-16` **618 driver pages have no opening sentence.** `notes` on 244 of 862. Generate a lede from the entry record in both renderers from one expression; keep `notes` as the override. The largest "look nicer" available and it is SQL. — *product critique · M*

- [ ] `VD-01` **The static half is a different design.** 126 lines of `#prerendered` CSS, a second `h1` treatment, tiles versus a key/value table. Rides with `PD-02`: emit the components' shapes, not just their numbers. — *visual critique · M*

- [ ] `VD-03` **No type scale and no spacing scale in the token file.**
      Recounted 2026-09-13: nineteen literal font sizes, twenty-eight spacing
      values. Add `--size-n`/`--space-n` and convert one file per sitting —
      before the components above multiply the literals. — *visual critique ·
      M*

### The review's other asks

- [ ] `IA-20` **The search index cannot represent a question.** Six of ten
      realistic queries return nothing — *ferrari 2026*, *most wins*, *who won
      the 2026 italian grand prix* — because `rank()` requires every typed
      word in one entity's label; a cross-entity query is structurally
      unrepresentable, not badly ranked. Three rungs, each shippable alone:
      (1) widen the needle to `label || ' ' || meta` — one line per UNION
      branch, S; (2) an intent grammar over a closed vocabulary — wins, poles,
      champions, standings, grid — plus an entity, routed to a page or a
      parameterised `/data/sql?q=`, and the console's six example questions
      grown to forty and indexed into the palette, so *pole to win* returns a
      runnable answer — deterministic, testable, no model, no server, M; (3)
      generated SQL, which is a **decision** (see above): a model in the
      browser is tens of MB beside a 4.5 MB payload, and a server call means
      the question leaves the tab, ending *nothing you look at is sent
      anywhere*. If wanted, an explicit opt-in *Ask* that sends only the
      question and the schema and runs the returned SQL locally. `PD-32`
      (the cookbook) folds into rung 2; `IA-21`, `IX-22`, `IX-23` ride. Rung
      3 deferred 2026-09-13 until rungs 1 and 2 have shipped. — *IA critique ·
      M*

- [ ] `IA-21` **The no-match state is a dead end.** *Nothing in the register
      answers to that.* and nothing else, at the exact moment a reader has
      said what they want. The console with the term pre-filled, and
      `/records`. — *IA critique · S*

- [ ] `IX-22` **One wrong letter is a flat refusal.** *verstapen*,
      *schumaker*, *redbull* return nothing while *silverston* and *hakkinen*
      resolve, so the rule is unlearnable. On zero hits only, retry within
      edit distance 2 and head it *Did you mean*. — *interaction critique ·
      S*

- [ ] `IX-23` **`<entity> <year>` is an existing page and returns nothing.**
      *ferrari 1979*, *hamilton 2008* — entity pages anchored at a season row.
      Handle the pattern; do not build a parser. Rides `IA-20` rung 2. —
      *interaction critique · M*

- [ ] `PD-29` **Write the telemetry refusal where a reader meets it.** One
      sentence on `/data`, the race page and the season page: *No lap-by-lap
      timing. No source publishes it under a licence that permits passing it
      on.* An empty section reads as unfinished; a stated constraint reads as
      a position. Correct `docs/TIMING-ARCHITECTURE.md`'s OpenF1 row to CC
      BY-NC-SA 4.0, which openf1.org now declares. `CD-05` carries the three
      lengths. — *product critique · S*

- [ ] `PD-32` **The cookbook.** Twelve worked questions on `/data`, one click
      into the console. Folded into `IA-20` rung 2. — *product critique · S*

- [ ] `PD-33` **Linkability before column pickers.** `IA-08` is the real
      gap; folded into `IA-23`'s sequencing. — *product critique · S*

- [ ] `PD-35` **What an expert would add, cheapest first.** Grid penalties
      as a column on the race page — `race_entries.grid` against
      `qualifying.position`, the reason a sourced fact; tyre-compound
      allocation per weekend (Pirelli/FIA selections, facts-only; `WK-03` has
      the limits); the team-mate head to head on every driver page, derived;
      title permutations (`PD-28`); the qualifying-format history (`WK-01`).
      F1DB's practice results, fastest laps and driver of the day are `LV-03`,
      decided. And say on the circuit page that a lap record is the one fact
      this project cannot hold. — *product critique · S each*

- [ ] `IA-22` **The breadcrumb and the URL describe different hierarchies.**
      Static `/races/2026/13` carries *Home / Seasons / 2026 / Italian Grand
      Prix*; the URL says `/races/`; the app carries neither trail. `/races`
      is unreachable from a race page by any trail in either renderer. Make
      both *Home / Races / 2026 / Italian Grand Prix* and emit the onward band
      statically. `IA-03` re-measured; ships with `PD-02`. — *IA critique · S*

- [ ] `IX-21` **During the cold wait the strip names a destination the reader
      has backed out of.** Click Drivers, then Circuits, Back twice: the URL
      reads `/`, the strip reads *opening Circuits when it is ready* for 25 s,
      and `document.title` stays the homepage's while the URL says `/drivers`.
      Derive the label from `location.pathname` on each render. — *interaction
      critique · S*

- [ ] `IX-25` **A typo in SELECT is answered with a lecture about writes.**
      `SELEC 1` returns the read-only warning. Within edit distance 2 of a
      permitted keyword, *Did you mean SELECT?* — *interaction critique · S*

### Carried over — not visual, unchanged

Everything below stood in *Next* or *Someday* before the 2026-09-13 re-rank
and is unchanged except for: the fourteen stale open lines `PM-34` named,
removed; `CR-07`, `PD-17`, `AX-06` and `AX-13`, moved up into *The visual
work* as prerequisites or same-file fixes; and a dated **re-rank** note on
the items the new direction touches — `PM-08` re-sized, `PD-18`, `VD-22`,
`AX-16`, `PM-07`, `CD-14`, `PM-10`, `IA-11` here, and `PD-21` where it
already sits in *The visual work*. Every other item was read against the
direction and found not to conflict.

- [ ] `PM-12` **Loosen the specification harvest's name check.** It refuses
      "Alfa Romeo 158/159 Alfetta" for `alfa-romeo-159`. Match the chassis name
      as a token subsequence rather than a strict prefix; the constructor and
      year checks still gate it. Specified in `BUILD-NOTES.md` v2.8. —
      *project record · S*

- [ ] `PM-13` **Six curated chassis weights await a sourced season limit.** —
      *project record · S*

- [ ] `PM-14` **`claims`, back-filled from the five existing encodings.** No new
      data — it retires five ad-hoc encodings of one idea and makes corroboration
      a `GROUP BY`. `DERIVED-CONFIDENCE.md` says explicitly this is worth doing
      whether or not `PM-15` and `PM-16` ever happen. — *project record · M*

- [ ] `PM-22` **`meta.database_name` still reads "F1 Verified Facts Project
      Memory Database".** Deliberately left out of the Lap Ledger rename because
      it reaches `f1_compat.json` and someone may be displaying it. Needs its own
      version bump and its own decision. — *project record · S*

- [ ] `PM-23` **The Parquet bundle carries no plain-text notice.** Unzipping
      `f1-parquet.zip` gives 41 binary files and nothing else — no licence, no
      attribution, no version, no mention that the ODbL centrelines ship
      separately as `f1-geometry.db`. *Engaging with the reason:* the terms are
      not actually absent, because `source_registry.parquet` and `meta.parquet`
      are both in the bundle, so a machine can read the licence of every row.
      That is a real defence and it is why this is an S and not urgent. But the
      release page states all of it in prose and a direct download from
      lapledger.org states none of it, and this project's own rule elsewhere is
      that attribution fails closed rather than requiring the reader to go
      looking. A `README.txt` written by `parquet_export.py` from
      `source_registry` — so it cannot drift from the data the way the README
      did in `PD-07` — settles it. — *project record · S*

- [ ] `PM-24` **Two Cloudflare build settings are unconfirmed, and one mismatch
      was never explained.** `SKIP_DEPENDENCY_INSTALL=1` is recorded in
      `web/README.md` as required but has never been observed in a build: the
      image installs fastf1, numpy, scipy and matplotlib from
      `requirements.txt` before every deploy, roughly ninety seconds, for a file
      only `tools/fastf1_load.py` uses. Separately, the dashboard's build-command
      field read `sh tools/cloudflare-build.sh` for an unknown period while every
      build log announced the npm chain; the field has since been corrected, so
      the symptom is gone, but *why it was ignored* was never established. Both
      are answerable from one build log. — *project record · S*

- [ ] `IA-01` **`grands_prix` has 53 rows, a view, and no page anywhere.**
      `Race.jsx:17` joins the table and `Race.jsx:440` prints the name as dead
      text, because there is nowhere to link it: no route, no prerendered page,
      no sitemap entry, no search row. The circuit page is not a substitute —
      **17 of the 53 Grands Prix used more than one circuit, covering 773 of
      1,172 races (66%)**, so the French Grand Prix is spread across seven
      circuit pages and reassembled nowhere. The clearest case on the site of
      the structure following the storage model rather than the reader. Goes at
      level two, reached from `/races`, the race page's Grand Prix field and the
      circuit page — three ways in, not a ninth nav item. — *IA critique · M*

- [ ] `CD-04` **The static half of the site prints the numbers and deletes the
      rules for reading them.** Every convention lives in a `DataTable` footer
      or a `Note`; `prerender.js` has neither construct. So the search arrival,
      the no-JS reader and the first seconds of every cold visit get shared
      drives with no note, em dashes with the explanation removed, and
      `Confidence: reference` as a bare fact on 695 driver pages. Three strings,
      one of which already exists at `App.jsx:88` and was simply not copied
      across. Ship with `PD-02`. — *content critique · M*

- [ ] `IA-03` **The app has no breadcrumb; the static page has no onward band.**
      Each renderer holds half the wayfinding and neither holds the other half,
      so orientation trades sideways the moment React takes over from the
      prerendered HTML. Ship with `PD-02`. — *IA critique · S*

- [ ] `CD-03` **1,172 race pages have no standfirst.** `races.note` is NULL on
      every one of the 1,172 rows, so `lede={race.note}` is dead code and the
      largest page type opens with no sentence — while `prerender.js:480-482`
      already composes a serviceable one for the meta description and does not
      put it on the page. Render it in both, from the same expression. —
      *content critique · S*

- [ ] `CD-05` **The timing position in three lengths.** #94 landed one
      length in one place, the `NOT_HELD` sentence on `/data`, and aligned
      `known_gaps` #5 with it. Still owed: the one-line and the paragraph
      forms, and the places each goes — the README's licence section, the
      release notes and `docs/TIMING-ARCHITECTURE.md`'s opening — all saying
      what #94 says (licences on offer, not the law; race timing, since the
      qualifying table holds lap times). No research left in it. — *content
      critique · S*

- [ ] `CD-07` **`PD-11` answered: what `/data` claims.** One adversarial
      sentence that survives the reader thinking *"I already have F1DB"* —
      **The Formula One record, audited** — with the supporting block. Lands
      with `PD-11`/`IA-02`. — *content critique · S*

- [ ] `CD-08` **`PD-10` answered: the citation block, verbatim.** It belongs
      inside the "Where this comes from" section that `Race.jsx:437` and
      `Driver.jsx:334` already render, not as a new component at the foot of the
      page. Lands with `PD-10`. — *content critique · S*

- [ ] `CD-09` **The glossary defines the sport's vocabulary and not the
      product's.** 44 terms — Apex, Bargeboard, Porpoising — all correct, none
      of them the words a newcomer trips on *here*. DNQ, NC, FL and the
      confidence tiers appear in table cells with no definition anywhere on the
      site. — *content critique · M*

- [ ] `CD-15` **`./f1 gaps` prints "what the data does not yet cover", then
      three entries beginning "CLOSED".** `CD-06`'s defect on the surface the
      bulk-data audience actually touches; must filter on `PD-05`'s `state`
      column when it lands. — *content critique · S*

- [ ] `CD-16` **The README's first sentence defines the product by its own
      history.** *"An expansion of the original single-file JSON into…"* — a
      reader arriving at the repository does not know there was a single-file
      JSON and does not care. `PD-07` (#60) moved the version log out; this is
      what should replace it, in `CD-07`'s claim in repository voice. —
      *content critique · S*

- [ ] `IA-06` **Six of the most famous cars in F1 have two URLs each and are
      absent from search.** Six `cars` ids that no chassis owns — `alfa-158`,
      `brawn-bgp001`, `lotus-72`, `mercedes-w05`, `mercedes-w11` and one more —
      reachable at two paths, indexed at neither. — *IA critique · S*

- [ ] `IA-12` **The glossary is terminal.** 44 terms, linked from three places
      in `web/`, and the terms it should serve are undefined at the point they
      appear. Content design owns the wording (`CD-09`); this is the placement
      half. — *IA critique · S*

- [ ] `AF-01` **Say when a race ends and whether it happened.** Search Console
      (11 Sep 2026) reports seven non-critical *Events* issues against the
      `SportsEvent` markup every race page emits at `prerender.js:499`, and
      names five: `endDate`, `eventStatus`, `organizer`, `performer`, `offers`.
      Two are facts the database already holds and should simply be emitted.
      `endDate` is the same `date_iso` that already feeds `startDate` — a Grand
      Prix is a one-day event, and the weekend range in `dates` is the display
      value the comment there rightly refuses to parse. `eventStatus` is
      `EventScheduled` on every row, because `races.status` only distinguishes
      run from not-yet-run and neither is cancelled or postponed. `organizer`
      is also true — the FIA sanctions every championship round — but is held
      nowhere in the database, so if it goes in it is a documented constant,
      not a string typed into the prerenderer. **Decline `performer` and
      `offers`.** Nothing here sells a ticket, and an invented offer is false
      structured data, which Google treats as a policy violation rather than a
      warning; and naming the drivers as `performer` is a reading of the schema
      no reader of a 1950 results page would recognise. Google's Event rich
      result exists for upcoming ticketed events, so of 1,172 pages only the
      ten scheduled 2026 rounds can ever earn one, and the warnings do not
      affect ranking — which is why this is S and *Next*, not *Now*. Two things
      to check while in there: Las Vegas 2026 carries `dates` "19–21 Nov" but
      `date_iso` 2026-11-22, so the ISO date sits outside the display range on
      the one page a ticket-holder would search; and `smoke.mjs:866` asserts
      JSON-LD on a driver page only, so a race page's markup has no test. —
      *Search Console report · S*

### Filed 2026-09-12 — live data, asked for and not yet decided

- [ ] `LV-03` **Session classifications after the fact.** FP1–FP3, sprint
      shootout and qualifying orders with best times as published in the
      race report and reproduced on Wikipedia (facts-only), loaded by the
      daily refresh the way race results are, so a Friday session is on the
      site by Saturday morning. Not lap-by-lap timing — that stays FOM's.
      Decided 2026-09-12 from `LV-01`. — *request · M*

Asked for on 2026-09-12. The page is prose; its structured content was
compared table by table against the schema. Almost all of it is already here
and better: `points_systems` (ten systems, sprint scoring separately),
`tyre_suppliers`, `engine_eras`, `regulation_changes` (58), `regulation_limits`,
`safety_milestones` (26, to 2026), `governance` (18, Liberty Media and both
Concorde milestones), `technical_innovations`, `sprint_results` (29 sprints),
`seasons`. Champions, titles by driver and team, wins by season are derived.
What the page states that the database cannot yet is below. Every figure
needs an FIA document before it needs a row; Wikipedia is the pointer, not
the source. `WK-` is this survey; nothing else uses the prefix.

- [ ] `WK-01` **The qualifying format has no history here.** One row in
      `regulation_changes` (2003, single-lap) stands for seventy-six years of
      formats: aggregate and two-session grids to 1995, the one-hour twelve-lap
      session 1996–2002, single-lap 2003–2005, knockout Q1/Q2/Q3 from 2006
      with its session lengths changing, the 2016 elimination experiment
      reversed after two rounds, the 107% rule 1996–2002 and again from 2011,
      the sprint shootout from 2023. A `qualifying_formats` table
      (`from_year`, `to_year`, `format`, `sessions`, `rule_107`, `note`,
      `source`) shaped like `points_systems`. Source: the FIA Sporting
      Regulations for each season — fia.com publishes 2009 onwards; earlier
      formats from FIA yearbooks or Formula 1's own history pages, and where
      no primary document is reachable the span goes to `known_gaps`, not to
      a guess. — *Wikipedia survey · M*

- [ ] `WK-03` **The weekend's limits are not in `regulation_limits`.** Tyre
      sets per weekend (13 dry, 4 intermediate, 3 wet; 12 dry on a sprint
      weekend), the classification threshold (90% of the winner's distance),
      and the 107% rule are sporting-regulation limits with years, the same
      shape as the three technical fields the table already holds. Source:
      the FIA Sporting Regulations, current issue first, then the year each
      changed. **2025 landed in #76**: five `regulation_limits` rows from the
      2025 issue (tyre sets dry/intermediate/wet per Competition, the 90%
      classification rule, the 107% rule), each citing Article 30.2(a), 61.2/62.2
      or 39.4(b)(i); the review read the document and corrected two notes.
      The year each changed is what remains. —
      *Wikipedia survey · S*

- [ ] `WK-06` **Read the records list the same way.** *List of Formula One
      World Championship records* is the page with the tables this one lacks.
      Survey it against `records` — derived since `PD-03` landed in #68, 29
      rows each with its rule in `detail` — and the leaderboards; anything it
      holds that the database can derive is a new row in `derive_records()`,
      anything it holds that the database cannot joins `known_gaps` #12. —
      *Wikipedia survey · S*

### Filed 2026-09-13 — the lint gate

The `lint` job in `ci.yml` landed with Ruff clean and Biome passing on
warnings. Eight Biome rules are demoted from error to warning in
`web/biome.jsonc`, each with its reason; this is the item that puts them
back.

- [ ] `CR-25` **Clear the 25 Biome findings demoted to warnings, rule by
      rule.** Nine `useExhaustiveDependencies` (`App.jsx`, `DataTable.jsx`,
      `Page.jsx` ×2, `Sql.jsx`, `useQuery.js` ×4 — read each before adding a
      dependency; a query hook that re-runs on every render is worse than
      the warning), one `useHookAtTopLevel` (`Sql.jsx`'s `useExample` is not
      a hook; rename it), four `noShadowRestrictedNames` (`constructor` as a
      local in `Constructor.jsx`, `Cars.jsx`, `prerender.js`), two
      `noArrayIndexKey`, two `useIterableCallbackReturn` in `smoke.mjs`,
      and six a11y findings — `noStaticElementInteractions` on the chart
      marks and search results, a div listbox in `Filters.jsx`,
      `aria-selected` on the wrong role in `Circuit.jsx` — which overlap the
      `AX-` items and should be cleared with them. A rule is done when its
      sites are fixed and its line is deleted from `biome.jsonc`, so it
      gates again. — *lint gate · M*

### Filed 2026-09-11 — the eight reviews

Compact by design: the reasoning and the evidence are in `docs/critiques/2026-09-11-*.md` under the same ID. Items already in *Now* are not repeated.

- [ ] `AF-02` **Keep the audit claim honest with a private repository.** Three
      S pieces. (1) Publish the checks' *results*, not the code: a served
      `checks.txt` or `/reference/checks` listing each `verify.py` check by its
      sentence-length name and its PASS/WARN on the deployed build — the names
      already read as claims. (2) Serve `schema.sql`, `ATTRIBUTION.md`,
      `LICENSE-DATA` and `SHA256SUMS` from lapledger.org, since the release page
      is unreachable and the artefacts are published from the site; the digest
      still lets a reader confirm the file they hold is the one published, even
      without a rebuild. (3) Reword: drop "anyone can rebuild and compare" from
      the release body and README; say on `/data` that the data is CC BY-SA, the
      build is not published, and here is what can be checked and how. `SD-01`'s
      two follow-ons fold in here. — *yours · S each*

**Code review**

- [ ] `CR-03` **Nothing tests the checks.** 184 assertion sites in `verify.py`, zero tests that any fires on bad data; `tests/` covers six pure functions. `tests/test_verify.py`: build once to a temp path, one mutation per test, assert the *named* check fails. Six tests cover the licence gate. — *code review · M*

**Product critique, second run**

- [ ] `PD-23` **Elevation as a fact, not a rendering.** Add `elevation_change_m` to `circuits` from the Wikipedia article each already cites, for the ~20 venues that state one. The Lap Ledger-shaped answer to the 3D instinct — see *Declined*. — *product critique · S*

- [ ] `PD-25` **The disagreements claim should be the live figures, not a typed sentence.** It read "45 found, 44 resolved, one open" when the table held 54 rows, 10 of them open — nine the 2026 points rows the next refresh moves, one the 1970 fastest lap — and, after #89, 56 rows with seven explained: five an external figure older than the race, two a career span each side reads rightly. Take `CD-07`'s claim from `discrepancies` at build time, by status. The second `PD-25`, the `/records` holder links, is `PD-26` now. — *product critique · S*

- [ ] `PD-27` **The champions, decade and constructor leaderboards on
      `/records` are names, not links.** `v_title_count`, `v_wins_by_decade`
      and `v_wins_by_constructor` carry `full_name`/`name` and no id; add the
      id to each view (a schema change, so a rebuild) and link the name the
      way the wins and poles tables do since #96. Split from `PD-26`. —
      *review of #96 · S*

**Data architecture**

- [ ] `DA-01` **`standings` has no key and `as_of` carries four meanings.** Rungs one and two ship with `CR-02`. Rung three: a `basis` column (`running`/`final`) and `after_round` filled on every row. Rung four is a decision: retire `as_of`. **Rungs one and two landed in #39** — the view and the expression index — with checks on both halves of the fold. Two things the review found for the rungs still open: the fill takes `MIN(id)` from the other source, so if a multi-source season ever holds a two-entry source (2018 Force India's shape, in 2026's situation) one entry would vanish — unreachable today, and the row-count check would refuse it; and on a points tie the view keeps formula1.com, so 2026's `as_of` column mixes `current` with the dated snapshot. — *data architecture critique · M, then a decision*

- [ ] `DA-02` **Constructor lineage has no time dimension.** 283 entries land in chains whose timelines exclude them — Renault's 1977–85 turbo wins on Enstone. `constructor_id` on `constructor_lineage` (54 of 66 match by name), a `verify.py` interval check that fails today, then deprecate `constructors.lineage_chain`. — *data architecture critique · M*

- [ ] `DA-03` **"May I publish this row?" is not a query.** No `source_id` on any fact table; resolution is Python regexes. Add `source_id` to the 22 tables with `source`, then `v_row_licence`. `PM-14`'s first column, worth shipping alone. — *data architecture critique · M, S first*

- [ ] `DA-04` **Surrogate ids moved on 17% of `race_entries` between v2.20 and v2.21, and nothing declares which ids are stable.** A decision: publish the policy (natural keys stable, surrogates not) — S — or order inserts deterministically and check against the previous release — M. `known_gaps` needs a stable `key` either way. — *data architecture critique · decision*

- [ ] `DA-05` **The `reference` tier's published definition is wrong for 96% of its rows.** Says Wikipedia; 91,407 of 94,957 are F1DB. 0.16 bits of information in the column. Rewrite the definition; check named sources against cited ones. The primitive question is `PM-15`/`PM-16`, in that order after `DA-03`. — *data architecture critique · S*

- [ ] `DA-06` **Two-thirds of the schema's prose does not ship.** SQLite keeps the text from `CREATE`; 298 of 448 comment lines — including this week's `WHAT 'POLE' MEANS HERE` — are above it and lost. Move each block inside the parentheses. Confirm byte-stability after. — *data architecture critique · S*

- [ ] `DA-08` **Nothing scores zero, except in the one table where everything does.** 8,107 classified finishers with NULL `points`, zero rows with `points = 0`; `standings` has 3,489 zeros. A data decision: write `0` where the era's system paid nothing. `CD-01`'s defect one column over. — *data architecture critique · S, decision first*

- [ ] `DA-09` **`discrepancies` is the least-modelled table and the one the project originates.** Four subject formats, three field vocabularies, free-text status, the string `'NULL'` on 23 rows; 152 chassis published-vs-derived differences recorded nowhere. `(tbl, row_key, field)` and a constrained `status` — `PM-14` rehearsed on 45 rows. — *data architecture critique · S*

- [ ] `DA-10` **`standings.entity_id` is a polymorphic key over two colliding namespaces.** Four ids exist in both `drivers` and `constructors`; the naive join returns 517 wrong rows; `entity` disagrees with `full_name` on five. Split into `driver_id`/`constructor_id` with a CHECK. Rides with `DA-01`. — *data architecture critique · S*

- [ ] `DA-11` **`standings.engine_id` is F1DB's namespace under this project's column name.** 10% resolve against `engine_manufacturers` by coincidence. Rename to `f1db_engine_manufacturer_id` or add the curated id beside it. — *data architecture critique · S*

- [ ] `DA-13` **One CHECK constraint in forty-six tables, and the vocabularies have drifted.** `anticlockwise` beside `anti-clockwise`; 18 `personnel.role` values for four documented; a licence guard on `article_images.repository` in prose only. Eight CHECKs and one data fix. **Eight of the vocabularies landed as `CHECK` constraints in #47** — `authority`, `drivers.status`, `table_type`, `circuit_type`, `direction`, `article_images.repository`, `races.status`, `regulation_changes.category` — and Jacarepagua's `anticlockwise` is fixed. Left open: `aspiration` (four tables, two vocabularies), `personnel.role` and `team_radio.speaker` (multi-valued in the data), and the lookup-table question for `authority` and `circuit_type`. — *data architecture critique · S*

- [ ] `DA-14` **The views reach 29% of the rows and ship in one of three formats.** No view over `standings`, `qualifying`, `sprint_results`, `pit_stops` or provenance; Parquet and JSON carry no views. `v_standings_final`, `v_race_classification`, `views.sql` in the zip, a which-download table on `/data`. — *data architecture critique · M*

- [ ] `DA-15` **`dates` is a display column for 2% of rows and a duplicate for 98%.** Replace with `date_from`/`date_to`; makes `AF-01`'s Las Vegas mismatch checkable. — *data architecture critique · S*

- [ ] `DA-16` **Fourteen columns are NULL in every row, and `known_gaps.races_affected` is 0 on 10 of 11.** Drop or document the structural empties; mark derived columns in `drivers`; fill or delete `races_affected`. `PD-06` and `CD-03` ride. — *data architecture critique · S*

- [ ] `DA-17` **A season's points live in two tables and nothing says so.** 40 driver-seasons disagree until `sprint_results` is added; Verstappen 2023 by 21. One view or one inline comment. — *data architecture critique · S*

- [ ] `DA-18` **`points_systems` holds two grains under one interval.** Sprint rows distinguished by a `SPRINT:` prefix; `'None'` the string beside SQL NULL. A `session` column. — *data architecture critique · S*

- [ ] `DA-20` **Seven spellings of a validity interval.** Fill the ten or fix the comment. The seven spellings of a validity interval are the M and optional. **The defect half landed in #51**: the ten inactive constructors with a NULL `last_entry` take the last season they have a race entry in, and a check holds NULL to the active flag. The seven-spellings convergence — `from_year`/`to_year`, `first_year`/`last_year`, `first_entry`/`last_entry`, `first_gp`/`last_gp`, `first_season`/`last_season`, `first_held`/`last_held`, `active_from`/`active_to` — is what remains, an M. One class the fill and the check both exempt: an inactive constructor with no race entry at all (today only `rob-walker`, which is authored); an entrant-only constructor added later would carry NULL and read as still competing. — *data architecture critique · S*

**Service design**

- [ ] `SD-01` **The data is published; everything that explains it is not.** The service face of `PD-14`. Its two S follow-ons — serve the licence files from the site; set `homepageUrl` and topics — stand whichever way the decision goes. — *service critique · S*

- [ ] `SD-04` **There is no inbound channel.** No contact, no report link, zero issues ever. One footer line; then the 18 pages showing an open disagreement get the link specifically. — *service critique · S*

- [ ] `SD-07` **`meta.version` does not identify the data.** From the first refresh, `2.21` names three different databases. Bump the patch on refresh, or declare digest + `built` the identity and say so in the citation block. — *service critique · decision, S*

- [ ] `SD-08` **The documented channel is stale and the fresh one is undocumented.** Folded into `PD-11`. — *service critique · S*

- [ ] `SD-10` **The only public mention of the Parquet bundle is a `Disallow:` line.** Rides with `PD-11`; one comment line in `robots.txt` today. — *service critique · S*

- [ ] `SD-11` **No `schema.org/Dataset` markup.** Every field is held. On `/data`. The one discovery surface built for the bulk audience. — *service critique · S*

- [ ] `SD-12` **"1950–2026" is typed 29 times across four channels.** Derive one string at build time into `meta.coverage_seasons`; read it in both renderers. Removes 12 of 29; the rest is `SD-15`'s runbook. The build half landed with `SD-02`: `meta.coverage_seasons` is read off the season register. — *service critique · M*

- [ ] `SD-13` **The advisory review check has been red through four merges.** Known cause: the other account is out of tokens. `continue-on-error: true` so the plumbing is not the signal. — *service critique · S*

- [ ] `SD-14` **GitHub will disable the schedule in the winter break.** 60 days idle; the break is ~90. Season-start runbook, item one. — *service critique · S*

- [ ] `SD-15` **No public surface says who runs this, how often, or what happens if he stops.** Four paragraphs; the fourth has an unusually good answer (pure function of public sources, `SHA256SUMS`). `PD-13`'s reader-facing half; `UR-05` is the same gap from use. — *service critique · S*

- [ ] `SD-16` **The licence statement does not follow the file.** `LICENSE-DATA` omits the Parquet zip; `robots.txt` leaves the one ODbL file crawlable; `meta.apply` names an unreachable tool. Folds into `PM-23`. — *service critique · S*

- [ ] `SD-17` **`docs/GITHUB-SETUP.md` documents a repository that no longer exists.** Delete, or reduce to the description and topics `SD-01` needs; add a six-line `docs/README.md`. — *service critique · S*

**Accessibility** — each marked WCAG failure (criterion) or usability.

- [ ] `AX-02` **The search palette is not modal and not a listbox. 4.1.2, 2.4.3.** Shift+Tab leaves it despite `aria-modal`; no `activedescendant`; Escape drops focus to `<body>`. Three S pieces. — *accessibility critique · M*

- [ ] `AX-09` **The atlas is the one graphic with no table of its numbers. 1.1.1.** A banded-runs table from `cornerRadius`/`stitch`; answers `PD-22` too. — *accessibility critique · M*

- [ ] `AX-10` **Three routes scroll the body sideways at 320 px. 1.4.10.** Atlas 107 px, Spa's layouts table 41 px, SQL example 24 px. — *accessibility critique · S*

- [ ] `AX-12` **The FL column is a bullet with no alternative; the rail is an empty cell named "Result" on every row. 1.1.1.** `sr-only` text and an `<abbr>`; `aria-hidden` on the rail. — *accessibility critique · S*

- [ ] `AX-15` **`/` is a global single-key shortcut with no off switch. 2.1.4.** Drop it for ⌘/Ctrl+K, or add a toggle. — *accessibility critique · S*

- [ ] `AX-16` **A dropped end label leaves one line identified by colour alone. 1.4.1.** Stroke-dash per series, echoed in the legend. — *accessibility critique · S*
      **2026-09-13 re-rank:** `VD-34` colours chart series by constructor and must keep the per-series dash and the legend echo — colour becomes more meaningful, not the only channel.

- [ ] `AX-17` **Five registers and the SQL console render their table with no caption; the static half has none anywhere.** A `caption` prop at six call sites and in `prerender.js`. — *accessibility critique · S*

- [ ] `AX-18` **The sticky column headers do not stick.** `.table-scroll` never scrolls vertically. Make it work or delete the rule. — *accessibility critique · S*
      **Superseded by `IX-18`**, which found the cause (2026-09-13); lands with it.

- [ ] `AX-19` **The scrubber announces "5" and has a 3 px pointer target.** `aria-valuetext`; 24 px hit area; `aria-disabled` instead of `disabled`. 2.5.8 passes. — *accessibility critique · S*

- [ ] `AX-20` **No skip link; eleven tab stops before content on every page.** 2.4.1 passes via landmarks. Fifteen minutes. — *accessibility critique · S*

- [ ] `AX-21` **No table has a row header.** A `rowHeader` flag on `DataTable`'s column spec. — *accessibility critique · S*

- [ ] `AX-22` **Each car card is two adjacent links to one page.** `tabIndex={-1} aria-hidden` on the image link. — *accessibility critique · S*

**User research walkthrough** — simulated, and says so.

- [ ] `UR-05` **Nothing on 3,515 pages says who publishes this or how to tell them they are wrong.** No About, no contact, no corrections route; a Wikipedia editor cannot satisfy WP:RS. One page; `SD-15` is the same gap. — *user research · S*

- [ ] `UR-07` **The obvious standings query returns 333 rows, and the console hides the comment that prevents it.** Show `sqlite_master` SQL in the schema browser; add a worked example for the current championship. `CR-02`'s reader face. — *user research · S*

## Someday, or maybe never

Real, but not costed, or waiting on a decision.

- [ ] `PM-06` **Read the 118 classification disagreements.** F1DB leaves a
      disqualified driver's position vacant; Jolpica promotes everyone below.
      Neither is wrong. `known_gaps` #2 says explicitly this is a person's work.
      — *project record · M*

- [ ] `PM-07` **The 337 photographs whose file name does not name the car.**
      `v_images_to_check` ranks them worst-first. The ATS D5 article leads with a
      photograph of officials and police, so the failure is real. The only part
      of the database with no cross-check available at all. — *project record · L*
      **2026-09-13 re-rank:** `VD-33` puts photographs on circuit pages; the same name-match rule (`name_matches`, `v_images_to_check`) applies there before any circuit image is shown, fail-closed.

- [ ] `PM-08` **Circuit configuration timelines for the remaining ten venues** —
      Kyalami, Zandvoort, Suzuka, Imola, Jerez, Estoril, Paul Ricard, Zolder,
      Brands Hatch, Buenos Aires. `verify.py` already enforces completeness and
      non-overlap once rows exist, so the guard rail is built. —
      *project record · L*
      **2026-09-13 re-rank:** **re-sized L → S, after `AF-03`.** F1DB's layout register carries a layout for every one of the 78 circuits and every F1DB race names its `circuitLayoutId`, so the ten timelines are a derivation from the harvest, not a hand-authored L; `verify.py`'s completeness and non-overlap checks already gate the rows. Authoring stays only where this project's split is finer than F1DB's, as Monza's nine to seven.

- [ ] `PM-26` **Three centrelines do not close into a loop.** Monaco has 4
      loose ends, Montjuïc 2, Las Vegas 1 — genuine 5.4–63.4 m holes in the OSM
      trace, so this is upstream data repair rather than a check to satisfy.
      Split out of `PM-20`, which was sized S on the strength of its two small
      siblings and could not carry this. Sits beside `PM-08`: both are geometry
      work the existing guard rails already constrain once rows exist. The
      `verify.py` warnings expected today, for the record: this one; the open
      `discrepancies` row (1970 r1 fastest lap, a genuine source
      disagreement); the Nürburgring Südschleife with no race; the unrun 2026
      r17 sprint; the 2026 drivers'/constructors' points disagreement and the
      2026 r13 pole awaiting the harvest, both of which the next refresh
      moves. — *project record · M*

- [ ] `PM-09` **Per-round chassis harvest.** Closes `known_gaps` #3 (287 races
      with no known winning chassis) and #4 (car pole counts) in one pass. Only
      safe with the entry-list cross-check that now exists. — *project record · L*

- [ ] `PM-10` **Historical season entry lists.** `season_entries` is 23 rows,
      2026 only. — *project record · M*
      **2026-09-13 re-rank:** a past season rendered in `PD-28`'s shape, and `AF-04`'s per-season colours on it, both want a season's grid; `season_entrants` has the constructor–chassis–engine link back to 1950 already, so the gap is drivers per entrant, not the register.

- [ ] `PM-11` **Constructor on pole and fastest-lap entries,** which turns car
      pole counts from lower bounds into exact figures. — *project record · M*

- [ ] `PM-15` **`checks`, with `kind` and `constrains`.** The largest piece of the
      confidence model and the most mechanical: each check declares whether it
      compares against an independent source and which rows it covered. What
      stops `qualifying` counting as cross-checked on a re-derivation covering
      446 of 1,161 races. — *project record · L*

- [ ] `PM-16` **Derive confidence in `build.py`,** with `confidence_basis` and a
      check that no stored tier differs from the derived one. The rule currently
      reproduces 96.5% of stored tiers. — *project record · M*

- [ ] `PM-17` **The prose pass.** 552 short fields carrying the CC BY-SA
      obligation that comes from Wikipedia, not FOM. Each needs marking original,
      paraphrased, or close to source; only the third needs rewriting. This is
      about what the licence statement must say, not whether the data may ship —
      it may. Named *still open* in `COMMERCIAL-READINESS.md`. —
      *project record · L*

- [ ] `PM-18` **Trademark, if money ever appears.** "Formula 1", "F1" and "Grand
      Prix" are Formula One Licensing BV's. A solicitor's question, not a build
      check, and not a task until there is a commercial form to ask about. —
      *project record · ?*

- [ ] `PM-19` **Revisit the six radio quotations** only if this is ever
      commercialised in a form that reproduces them prominently. Weighed and kept
      on the record; a marketing surface is not a database row. —
      *project record · ?*

- [ ] `PD-08` **Decide what the atlas is for.** **Superseded by `PD-21`**,
      which decides it: a comparison surface, and only that. Three critics and
      the walkthrough agreed from structure and from use; the one number that
      would end the residual argument (does anyone open it) is `PD-Ø`'s. —
      *product critique · answered*

- [ ] `IA-09` **The eyebrow above every `h1` means four different things.** One
      slot in one position on every page, carrying four unrelated kinds of
      value. — *IA critique · S*

- [ ] `IA-10` **One label for four destinations.** `back={{ label: 'The
      register' }}` on drivers, constructors, circuits and cars — four
      destinations, one string, none of them naming where it goes; and "Car" has
      three referents. — *IA critique · S*

- [ ] `IA-11` **The two longest registers are the two with no time axis.** —
      *IA critique · S*
      **2026-09-13 re-rank:** `IA-19`'s chip and `VD-30`'s default sort are the cheap half; a real time axis on `/drivers` and `/constructors` remains.

- [ ] `IA-13` **`/reference/eras` renders nine tables under a two-word label.**
      Eras, engine formulae, scoring systems, regulation changes and limits,
      technical innovations and more. Falls out of `IA-02` if that is done
      properly. — *IA critique · S*

- [ ] `CD-11` **Meta descriptions at scale read as schema output.** Generated at
      `prerender.js:645`: *"Adolf Brudes, Germany, Formula One 1952-1952. 0
      wins, 0 poles."* — and "0 wins, 0 poles" on 618 pages, where the site's own
      convention is that a blank is not a zero. — *content critique · S*

- [ ] `CD-12` **One concept, several words.** Out/Status is the instance where
      the two renderers actually disagree; the rest is consistency. —
      *content critique · M*

- [ ] `CD-14` **The homepage explains four conventions and there are seven.**
      `Home.jsx:204-238` covers the em dash, disagreements, the ladder and the
      gaps, and omits the three most often read as bugs: a repeated finishing
      position, a pre-1991 margin, and a stored figure shown beside a derived
      one. Not three more panels — six is a wall — but a change of framing so
      the section is a door. — *content critique · S*
      **2026-09-13 re-rank:** the home page changes shape when `PD-28` lands — the season leads and *Where to start* stops repeating the masthead. Do this reframing in the same change.

- [ ] `CD-17` **Error and empty states: an inventory.** Written out in the
      critique with a verdict each. Two worth acting on: the boot-failure copy
      addresses the wrong audience, and `DataTable`'s default *"Nothing
      recorded."* is a strong claim to make by default on a site where a blank
      means *not established*. — *content critique · S each*

- [ ] `PD-Ø` **Measure something.** Re-raised 2026-09-11 at higher severity,
      with two free partial answers: Cloudflare's own request counts for
      lapledger.org and `/f1.db` (no tracker), and — once `PD-14` is settled —
      GitHub's per-asset release download counts, which F1DB's most recent
      release shows at ~1,800 across formats in five days. The user-research
      walkthrough ranks this first among the things only real research can
      settle, because every other ranking here assumes an arrival pattern
      nobody has observed. One of three: read Cloudflare monthly; make the
      repository public and read the download counts; or decide measurement is
      not wanted and write that here. — *product critique, user research · ?*

### Filed 2026-09-11

- [ ] `CR-12` **The stage pipeline is the right shape and a mechanical split of it.** Truncated names, an empty `_stage_31`, a stage doing nine things, file order disagreeing with run order. Rename by what each does; a final `_stage_99_finish`. — *code review · M*

- [ ] `CR-15` **A fact is a position in a 36-field tuple.** 831 rows across seven files; swapping two plausible numbers is invisible. `NamedTuple` per table, one regex — or a decision not to. — *code review · M or decision*

- [ ] `CR-17` **70% of the 8.6 s build is one stage.** `executemany` with a pre-fetched constructor set would halve it. Nine seconds is fine; noted so nobody optimises the other 29. — *code review · S*

- [ ] `CR-19` **`# noqa` and `eslint-disable` with no linter; Python 3.9 in the matrix.** Add ruff to CI or delete the markers; say why 3.9 stays. — *code review · S*

- [ ] `CR-20` **The history the project leans on starts on 2026-09-04.** Everything before v2.6 is `BUILD-NOTES.md` and comments, which makes `PM-02` weightier than an S. `PM-02` landed in #60 as far as v2.16–v2.22 go; what this asks about is the record *before* the git history starts, and that stays open. — *code review · ?*

- [ ] `PD-18` **Driver photographs: available for ~65%, fourth in the queue.** Sampled n=160: 55% pre-1970 to 98% modern, all on Commons. An *identification* portrait beside the `h1`, never a hero; the template must work without one (302 pages). Decide after `PD-16` and `PD-19` have shipped. `VD-22` sizes the data side L (a `drivers.article` equivalent, a name-match rule for people); `UR` found no persona blocked by its absence. — *product critique · decision*
      **2026-09-13 re-rank:** `PD-28`'s season page adds no portrait and keeps to the *Declined* position on hero portraits. If the decision is ever yes, the 23 drivers on the 2026 grid are the pilot: 98% have a Commons portrait and one season page shows them all.

- [ ] `VD-22` **What the formula1.com ask should buy.** `PD-18`'s visual half: 96–120 px, tile rhythm, `CommonsCredit`. Circuits would serve a reader more than drivers if only one image programme is ever done. — *visual critique · M*
      **2026-09-13 re-rank:** the circuits half is `VD-33`, in *Next*; the driver half stays with `PD-18`'s decision.

---

## Landed

- [x] `PM-01` **Serve the Parquet bundle from lapledger.org.** `/f1-parquet.zip`
      returned 404: the build step lived in a script Cloudflare never ran, and
      the interpreter with `sqlite3` had no `pip`. Moved into `npm run build`,
      which demonstrably runs, and the deploy script deleted rather than fixed —
      a build step whose execution cannot be established is worth less than no
      build step. CI holds the rebuild gate instead. —
      *project record · [#25](https://github.com/Alex-Farley/formula-1-data/pull/25)*

- [x] `PD-01` **Write a page for every chassis the app links.** 1,130 routes
      worked in the app and 404'd to anyone who followed a shared link;
      `prerender.js` iterated `cars` (29) where `Cars.jsx` links `chassis`
      (1,153). Fixed as the union of both, because six ids name a car no single
      chassis owns. 2,385 pages → 3,515. The smoke test caught its own stale
      expectation mid-change. — *product critique · `12629d8`*

- [x] `PD-04` **Attach recorded disagreements to the facts they are about.**
      `discrepancies` is one of the few tables this project originates and lived
      only on `/reference/quality`, aggregated. Now beside the fact on the 16
      race pages and 2 driver pages an open disagreement names — in the app and
      in the prerendered HTML, so both halves say the same thing. A `verify.py`
      check refuses a subject that joins to nothing, because the join fails
      silently by design. — *product critique · `7d1f444`*

- [x] `CD-01` **A classified finisher reads *Finished*, not an em dash.** 15,714
      of 27,482 `race_entries` rows carry a null `status` and a finish
      position; every one rendered as the em dash meaning "not established",
      under a footer asserting the opposite in as many words. All twenty
      finishers of the 2024 Bahrain Grand Prix read that way. The finding named
      two render sites; there were five — the sprint table, car pages and the
      prerenderer had it too. One rule in `format.js`, imported by
      `prerender.js` rather than restated, because a copy in the static half is
      the `circuit_geometry` failure again. The footer was false and is now
      true. — *content critique · `cb5364b`*

- [x] `IA-15` **The download instruction names both database files.** The one
      sentence on 3,515 pages that says the artefact exists named `f1.db` alone
      and did not link it, against a binding `CLAUDE.md` rule. It now names
      both, links both, and says why they are two: a collective database keeps
      the share-alike from reaching across, and merging them would pull 117,000
      unrelated rows under it. Stays on the SQL console — `IA-15` wants it on
      `/data`, which is `IA-02` and does not exist yet. It reached the
      static page only; the app's copy, and the sentence that the file
      documents itself, landed with `SD-09` in #52. — *IA critique ·
      `8c26ccf`*

- [x] `IA-04` **The document is renamed when the reader navigates.** No
      `document.title` existed anywhere in `web/src/`, so after any in-app
      navigation the tab, the bookmark, the history entry and the screen
      reader's announcement all still named the page the reader landed on. It
      lives in `Page`, which every page already hands the string it uses for
      the h1, so the document name and the visible name cannot drift. A page
      with no name gets the site alone, never `undefined — Lap Ledger`. `SITE`
      and `titled()` moved to `src/lib/site.js` so the two halves cannot name a
      page differently. `smoke.mjs` asserted a title on cold load only — the
      one case the prerenderer always got right, which is why this shipped — and
      now navigates in-app too, confirmed to fail with the fix disabled. —
      *IA critique · `9f93566`*

- [x] `PM-25` **The four fastest-lap rows were two shared fastest laps rendered
      as one name.** The question was what `stored_value` and `derived_value`
      meant per row, and answering it turned four rows into two facts. The
      1960 Belgian Grand Prix article credits Brabham, Ireland and Phil Hill
      jointly at 3:51.9, which is Hill's sixth; the 1969 Canadian Grand Prix
      article credits Brabham with the 1:18.1 both harvests credit to Ickx,
      which is Brabham's twelfth, and Ickx keeps his 14. `SHARED_FASTEST_LAPS`
      in `data/harvest.py` restores both and refuses to apply if the harvest
      row ever changes. The 1970 South African row stays with Brabham alone:
      the article footnotes that some sources credit Surtees, but his
      reference total of 10 excludes it and was corrected to 10 once already
      on that evidence — but the article records that sources differ, so
      that row stays **open** with the reasoning attached rather than being
      closed on the strength of another figure. The two shares are resolved
      rows on the record; Ireland's 1 and Ickx's 14 are now held as reference
      totals so all three restored names sit under the external cross-check;
      and the prerenderer lists every setter of a shared lap, as the app did.
      — *project record · `621c49a`*

- [x] `PM-05` **Pole is its own flag.** `grid = 1` carried two meanings — the
      car that started from the front and the driver credited with pole — and
      they differ in three completed races: 1996 r9 and 2021 r5, where the
      pole-sitter never started, and 2022 r21, where the sprint winner started
      first and pole stayed with the fastest qualifier, which the old rule
      recorded as a row with grid 1 and grid text 8. `race_entries.pole` is fed
      by the season record, `grid` is F1DB's, and the fastest qualifier stays
      in `qualifying`. The thirteen pole-versus-fastest-qualifier rows are gone
      from `discrepancies`, because neither source was wrong about what it
      describes; `verify.py` pins all three counts instead, and
      `discrepancies` goes from eighteen open rows to one. A pole the build
      credits from F1DB's grid 1 while the harvest catches up is now
      distinguishable by its source and refused outside the current season.
      `VERSION` is 2.21, because a new column and six changed views should
      not ship under the released schema's number. The
      front-end review caught the car page selecting its columns by name and
      so rendering every car's poles as zero; the smoke test now asserts the
      MP4/4's fifteen and was confirmed to fail without the fix. —
      *project record · `621c49a`*

- [x] `CD-13` **The race page no longer states a cause.** "Started P4, after a
      grid penalty" is now "started P4"; where a sprint set the grid, which
      `races.sprint` does hold, it still says so. Both renderers, one wording.
      Rode with `PM-05`. — *content critique · `621c49a`*

- [x] `UR-01` **The 2025 and 2026 championship positions render.** 65
      end-of-season rows carry `position` and no `position_text`; the tables
      fall back to `position`, `fold()` carries both across sources, and the
      driver chart's own table does the same — the review caught that one.
      Smoke: the 2025 champion is P1. — *user research · `f632fd4`*

- [x] `UR-02` **A winless season reads 0, not an em dash.** `COALESCE` in
      both `BY_SEASON` queries; Best and Championship stay dashed because
      those are genuinely not established. Smoke: a winless season reads 0.
      — *user research · `f632fd4`*

- [x] `UR-10` **The poles caption states the pole rule.** One string. —
      *user research · `f632fd4`*

- [x] `UR-11` **Bahrain at Sepang is explained on the page.** The authored
      field is the race's note and its lede. Smoke asserts it. —
      *user research · `f632fd4`*

- [x] `UR-08` **The SQL console shows 1950, not 1,950.** `raw` on
      `DataTable`. — *user research · `f632fd4`*

- [x] `IX-12` **The footer sentence naming a button below it is gone.** —
      *interaction critique · `f632fd4`*

- [x] `AX-03` **The heading takes focus on in-app navigation.** `tabIndex={-1}`
      in `Page`, on `pathname` change after the first render. —
      *accessibility critique · `f632fd4`*

- [x] `AX-04` **Result counts are announced.** `role="status"` on the SQL
      console's count and on the registers' — the latter after typing
      settles, because a live region per keystroke is worse than none. —
      *accessibility critique · `f632fd4`*

- [x] `AX-05` **`--ink-faint` clears 4.5:1 on all four light surfaces**
      (5.30 / 4.81 / 4.56 / 4.98), and the token comment says which surface
      each figure was measured on. — *accessibility critique · `f632fd4`*

- [x] `AX-08` **`scroll-padding-top` under the sticky masthead.** —
      *accessibility critique · `f632fd4`*

- [x] `VD-04` **A true zero renders faint in the registers**, so careers
      surface. — *visual critique · `f632fd4`*

- [x] `VD-05` **The constructor wins chart plots every season on whole-number
      ticks.** A drought is a gap; the subtitle that excused it is gone. —
      *visual critique · `f632fd4`*

- [x] `VD-06` **The dot plot labels P1.** — *visual critique · `f632fd4`*

- [x] `VD-09` **Title years read "2008, 2014–15, 2017–20"** from one shared
      rule in both renderers, and no longer break mid-number. Unit-tested;
      the review caught two-year runs not collapsing. —
      *visual critique · `f632fd4`*

- [x] `IX-01` **The boot state is a strip pinned to the foot of the viewport**
      while the static page is showing, named and bounded, with one live
      region and one `h1`. Measured at 4 Mbps: on screen at 2 s. Closes the
      same finding's other faces, `VD-02`, `UR-04` and `AX-01`. —
      *interaction critique · `6a3269d`*

- [x] `VD-02` **With `IX-01`.** — *visual critique · `6a3269d`*

- [x] `UR-04` **With `IX-01`.** — *user research · `6a3269d`*

- [x] `AX-01` **With `IX-01`**: progressbar named by the phase sentence,
      `aria-valuemin/max/valuetext`, phase words in one `role="status"`, and
      focus moved to the heading at handover. — *accessibility critique · `6a3269d`*

- [x] `IX-02` **A click during the download is a route change, not a
      restart.** Same-origin clicks on the static page go to `pushState`;
      the strip says what is pending; the router picks the route up at
      ready. Measured: one `f1.db.gz` request, ready at 12.6 s on the clicked
      route, where it was two requests and 14.9 s. Closes `UR-03`. —
      *interaction critique · `6a3269d`*

- [x] `UR-03` **With `IX-02`.** — *user research · `6a3269d`*

- [x] `IX-03` **Scroll position survives the handover and the heading takes
      focus.** — *interaction critique · `6a3269d`*

- [x] `IX-13` **A failed boot offers Try again.** `retryOpen()` drops the
      cached promise and the dead worker. — *interaction critique · `6a3269d`*

- [x] `IX-14` **"Works offline" now says what is true**: an open tab keeps
      working without a network. — *interaction critique · `6a3269d`*

- [x] `UR-06` **The static footer carries the version and build date** from
      `meta`, so a search arrival's figures are dated. Smoke asserts it. —
      *user research · `6a3269d`*

- [x] `CR-02` **`f1_compat.json`'s 2026 snapshot is 23 rows, not 333.** Root
      cause fixed as `DA-01`'s first two rungs: `v_standings_final` (one row
      per entity per season, same columns as the table) and
      `ux_standings_identity` (the table's inert `UNIQUE` made real, with
      `position_text` in the key). Both compat queries, the full export, the
      CLI and the three pages read the view; the exporter refuses a snapshot
      listing an entity twice; `lib/standings.js` is gone. Two fresh reviews
      each failed once — count-only tests, and no check on the half of the
      fold that keeps entries — and both gaps are closed by value-level and
      row-level checks that were confirmed to fail on a broken copy. The
      second review also found the view's "larger total is newer" premise
      false for nine 2026 entities where the sources disagree at the same
      round; the build now files each as an open `discrepancies` row shown
      on the driver's or constructor's page, and a check refuses an unfiled
      one. Costs 1.5 MB in `f1.db`, 373 KB gzipped. — *code review · #39*

- [x] `CR-11` **Every view is selected from in `verify.py`.** A view over a
      missing column now fails a check, not a reader's query. —
      *code review · #39*

- [x] `CR-18` **Both unfailable assertions can fail.** The views loop is
      real; the multi-engine warning is a check that the view keeps as many
      multi-engine constructor-seasons as the table. — *code review · #39*

- [x] `SD-02` **A season the calendar does not hold is refused, not skipped.**
      One `race_for()` on the build object replaces six silent `continue`s
      in the F1DB loaders: a round inside a known season with no race yet is
      skipped and counted (the summary line now says how many), a year the
      season register lacks stops the build and names the fix. The
      standings loader, keyed by year, refuses the same way. A copy with one
      synthetic 2027 result refuses to build. `meta.coverage_seasons` is
      derived from `seasons` rather than typed. — *service critique · #40*

- [x] `CR-05` **A failed build leaves the committed databases untouched.**
      `build.py` writes `f1.db.tmp` and `f1-geometry.db.tmp` and moves each
      into place only after every stage ran and the header is pinned.
      Observed the day it was fixed: #40's first commit carried a 581 KB
      fragment. On a copy a refused build exits 1 with `f1.db` byte-identical.
      — *code review · #41*

- [x] `CR-01` **Every bulk table has a floor.** Eight tables and two bulk
      columns are checked against their count at v2.22 in `verify.py`; a
      database built with `f1db_pit_stops.txt` or `fastest_laps.txt`
      deleted, which passed every gate on `main`, now fails (the standings
      floor from #39 already caught that one). Fastest laps are checked per
      race rather than by count. Raise a floor when a harvest legitimately
      adds rows, never lower it. `car_specs.txt` and `article_images.txt`
      fill columns rather than tables and remain unfloored: `CR-21`. —
      *code review · #42*

- [x] `CR-04` **`./f1` opens the database read-only.** `./f1 sql "CREATE
      TABLE …"` used to persist into the committed file. — *code review · #42*

- [x] `DA-12` **`race_entries.source` names who established the finishing
      position.** The pole harvest ran first and created a bare row citing
      the season article; F1DB's upsert then filled every other column and
      left the citation, so 1,136 pole rows cited Wikipedia for F1DB's whole
      classification. The upsert now takes F1DB's source with the position
      where the row had none, and a season-harvest winner keeps its own. The
      pole and fastest-lap credits' provenance — `harvest/poles.txt`, whatever
      `source` says — is declared on the columns in `schema.sql`; a check
      refuses a non-winner carrying F1DB's laps under another source; the
      inferred-pole check now reads the harvest's coverage rather than the
      source column. The proper fix is still `PM-14`. — *data architecture
      critique · #43*

- [x] `SD-03` **The refresh polls daily.** F1DB publishes within a day or two
      of a race; a weekly poll that missed by four hours left a run race
      shown as unrun for eight days. The job's diff step short-circuits a day
      with nothing new. — *service critique · #44*

- [x] `SD-05` **The refresh builds and tests the site before it commits.** Its
      push is made with `GITHUB_TOKEN`, which starts no workflows, so `ci.yml`
      never ran on the weekly harvest commit while Cloudflare deployed it.
      The web build and the smoke test — which reads its expectations out of
      the refreshed database — now run in the refresh itself, before the
      commit. — *service critique · #44*

- [x] `CR-08` **`meta.coverage_note` is derived from the counts.** The typed
      sentence told a bulk-data consumer the database held no qualifying
      beside 26,997 qualifying rows, and "pole 1950-2024" beside poles to
      2026, in `f1.db`, both exports and the Parquet bundle. Every figure in
      it is now read off the table it describes, and `verify.py` rebuilds the
      same string and compares it whole. `PD-24` is the same finding on the same surface
      and closes with it. — *code review, product critique · #45*

- [x] `PD-24` **With `CR-08`**: the same stale prose on the same surface. —
      *product critique · #45*

- [x] `DA-07` **`known_gaps` #5 no longer calls `pit_stops` empty.** It holds
      22,481 F1DB stops (lap and order, no durations) and `team_radio` six
      quoted exchanges; the gap now says so, the `pit_stops` schema comment
      says both duration columns are NULL in the distributed database and
      why, and a check refuses a table the gap calls empty that is not. —
      *data architecture critique · #45*

- [x] `CR-10` **The compat export's headline facts are derived.** "Lando
      Norris — 2025", "Nino Farina (1950)" and "7 each" were string literals
      in code that CI compared only against itself; they now come off
      `seasons` and `drivers`, so the day the 2026 title is decided the file
      says so. The duplicate `grands_prix`/`grands_prix_register` key is left:
      a v1 consumer may read either. — *code review · #46*

- [x] `CR-06` **The pole and venue harvests are pinned to the calendar.**
      `applied != 1161` in two places had to be bumped by hand after every
      Grand Prix or the build refused, and caught a truncated file only by
      being the right number. One function now asserts the rule it stood in
      for: one row for every completed race up to the harvest's last, none
      twice. A race after the last row is the week the harvest has not caught
      up yet, which the F1DB vacancy fills cover and `verify.py` counts. —
      *code review · #48*

- [x] `CR-09` **No document states a check count.** It was stated seven
      ways and none was right; `verify.py` prints the live figure and nothing
      else claims one. The two figures in `BUILD-NOTES.md` are release history
      and stay. — *code review · #49*

- [x] `CR-16` **The Node requirement is declared.** `prerender.js`,
      `smoke.mjs` and `prepare-assets.js` import `node:sqlite` unflagged,
      which is Node 22.13; `engines` in `web/package.json` says so before the
      second build step does. `web/.nvmrc` joins the root `.node-version`
      Cloudflare reads — two files because two tools read them. —
      *code review · #49*

- [x] `CR-13` **The Parquet step installs nothing on a laptop, and CI reads
      its result.** `pip install` runs only where `CI`, `CF_PAGES`,
      `WORKERS_CI` or `LAPLEDGER_PARQUET` is set; elsewhere the step reports
      that pyarrow is absent and how to allow the install. `ci.yml` prints
      `build-status.txt` and fails if the bundle did not build. —
      *code review · #50*

- [x] `SD-06` **`/build-status.txt` is a heartbeat.** Deploy commit, database
      version and build date, the round the data is complete through, and
      the F1DB version the harvest came from — on success and on failure —
      so a deploy that has been failing for a month is one fetch from a
      diagnosis. — *service critique · #50*

- [x] `SD-09` **The download paragraph says the file documents itself.** Three
      clauses — `sqlite_master` for the commented schema, `meta` for version,
      build date and what is held, `source_registry` for the licence of every
      row — shared with the static page through `lib/site.js`. Found in
      passing: the app's SQL page never carried `IA-15`'s download paragraph
      at all; it does now, and a smoke check holds both renderers to it. —
      *service critique · #52*

- [x] `CR-14` **`make ci` does what `ci.yml`'s Python job does**, in its
      order, including the redistribution gate on the committed database and
      the artefact comparison that neither `check` nor `all` ran. `CLAUDE.md`
      points at it. — *code review · #53*

- [x] `IX-05` **Search ranks equal matches by prominence.** The index carries
      wins (or races, for a circuit); "hamilton" offers Sir Lewis before
      Duncan, "schumacher" Michael before Ralf. The rule lives in
      `lib/search.js`, unit-tested; a smoke check holds the palette to it. —
      *interaction critique · #54*

- [x] `IX-06` **Search folds diacritics both ways.** "raikkonen" finds
      Räikkönen and "Räikkönen" finds Raikkonen, whichever spelling the
      register holds. — *interaction critique · #54*

- [x] `IX-07` **Search takes the words in any order.** "monaco 1996" finds
      the 1996 Monaco Grand Prix; every word typed must appear, and the rank
      is the best-placed one. — *interaction critique · #54*

- [x] `IA-05` **A car is found by the name anyone types.** The index carries
      `chassis.full_name` — "Ferrari 312/67" — not the bare model number. —
      *IA critique · #54*

- [x] `UR-09` **The records caveat sits above the figures it caveats**, not
      1,900 px below them. This was the sentence that already existed, moved;
      `PD-03`'s derivation (#68) then replaced it with the sentence that no
      longer needs to caveat anything. — *user research · #55*

- [x] `VD-10` **A badge that never varies is said once.** `/records`' thirty
      identical `medium` badges and `/reference/eras`' ten are one sentence
      each; the column and the per-row badge return only where tiers differ.
      — *visual critique · #55*

- [x] `VD-13` **`/records` no longer right-aligns phrases as if they were
      figures.** Left-aligned; the split into a number and a qualifier came
      with `PD-03` (#68) as `value_num` and `unit` beside the display
      `value`. — *visual critique · #55*

- [x] `IX-08` **The atlas marker travels the racing direction.** The stitched
      ring is reversed where its signed area disagrees with
      `circuits.direction`; Baku and Long Beach walked backwards against the
      direction stated beside them. The origin stays arbitrary, so the
      readout says "along the trace" rather than implying a lap position. —
      *interaction critique · #56*

- [x] `IX-09` **The scrubber says what is under the marker** — the corner
      band and its radius — so it teaches the colour key instead of counting
      up a distance the drawing already shows. — *interaction critique · #56*

- [x] `CD-10` **The confidence pill goes to the ladder.** A link to
      `/reference/quality` with the tier in its title, in the app and in the
      static facts lists, so "medium" is a word with a definition one click
      away rather than a bare word. — *content critique · #57*

- [x] `AX-11` **Section headings have a space before their count**, in the
      accessible name and not only in the CSS: "Classification 20 entries",
      not "Classification20 entries". The Spa layout headings and the error
      box are the same defect on other components and stay open under
      `AX-11`'s reasoning. — *accessibility critique · #57*

- [x] `AX-14` **Chip filter groups have a name.** `role="group"` and a label
      saying what the chips filter, at all nine call sites. —
      *accessibility critique · #57*

- [x] `IX-04` **A runaway console query can be cancelled.** sql.js has no
      interrupt, so Cancel terminates the worker, reopens the database (from
      IndexedDB on a return visit) and re-sends every page query that was
      waiting; console statements are never re-sent, and the console runs one
      at a time — the first cut replayed the runaway itself, and the review
      caught it. Leaving the page stops its statement. The smoke suite runs a
      three-way self-join, refuses a second Run, cancels, and checks the
      console and a register both work afterwards, then leaves the console
      mid-runaway and checks the register fills. The re-send of a waiting
      page query is covered by reading, not by the suite: nothing on the
      console page queries while a statement runs. No timeout: a slow honest
      query is the reader's to wait for or stop. — *interaction critique · #58*

- [x] `VD-07` **The rail's middle bands separate by lightness.**
      `--rail-classified` darkened in light and lightened in dark; points
      against classified is 2.1:1 in both themes, measured in the script
      that made the change. — *visual critique · #61*

- [x] `VD-08` **The racing-colour sentence is prose**: `--sans`, 13 px, under
      the swatch, within the measure. — *visual critique · #61*

- [x] `VD-11` **The confidence ladder has rungs.** High is a 2 px border,
      reference 1 px, medium dashed; the ends keep their colour. — *visual
      critique · #61*

- [x] `VD-15` **Column headers are 10.5 px.** — *visual critique · #61*

- [x] `VD-16` **Prose cells keep to 60ch.** — *visual critique · #61*

- [x] `VD-17` **The pale end of the ramp clears 3:1 on the stage** (3.2:1 in
      light; the ramp re-spaced so each step stays at least 1.3:1 from the
      next). The continuous legend bar is not done; `AX-07`'s contrast half
      is. — *visual critique · #61*

- [x] `VD-18` **The fastest-lap mark is the accent**, the one cell where
      "this was fastest" is literally what it marks. `AX-12` still owns the
      markup half. — *visual critique · #61*

- [x] `VD-19` **The console's textarea fits the query it was given.** —
      *visual critique · #61*

- [x] `VD-21` **`web/README.md` describes the mark that ships**: four by four,
      one accent cell. — *visual critique · #61*

- [x] `WK-02` **The cost cap is a schedule.** Seven `regulation_limits`
      rows — the headline figure for 2021, 2022, 2023–2025 and 2026, and the
      per-Competition adjustment for each — every one read from the FIA
      Financial Regulations issue for that year and citing it; a 2026
      `regulation_changes` row for the US$215m figure. `verify.py` refuses
      overlapping spans of one limit and a missing cap year. — *Wikipedia
      survey · #59*

- [x] `VD-12` **The circuit page draws its lap with the atlas's renderer.**
      One component, `LapFigure`, called by the atlas and by `/circuits/:id`:
      corner-radius bands, the direction of travel as an arrow, the marker
      where a caller walks the lap. `TrackMap` and its second stitcher are
      gone. No start marker — neither database holds that coordinate, and
      where the trace closes the caption says the arrow is the direction, not
      the start; where it does not close (Monaco, Las Vegas, Montjuïc) there
      is no arrow and no claim of one — the first cut said it anyway, and the
      review caught it. 3D stays
      declined; an elevation strip waits on `PD-23`. — *visual critique · #62*

- [x] `PD-07` **The README states what the database holds.** Every figure it
      gives about the current database is a `<!-- fig:name -->` span that
      `tools/readme_figures.py` computes from `f1.db` (and `f1-geometry.db`
      for the centrelines) with one expression per name; `make all` rewrites
      them, and a `verify.py` section recomputes each and fails the build
      where the text disagrees. 39 tables / 34 views / ~8,400 rows became
      46 / 39 / 119,265; "qualifying, not held at all" became 26,997 rows;
      "standings cover 2025–26 only", "sprint results not held", "podiums
      hand-entered" and "every Monday" were false and are fixed. Prose that
      could not be derived — check counts, refusal tallies that live in harvest
      logs, the way-end distances — was deleted rather than left to drift. The
      version log moved to `docs/BUILD-NOTES.md`; `PM-04` stays open with the
      proposed text on it. — *product critique · #60*

- [x] `PM-02` **`BUILD-NOTES.md` runs to v2.22.** v2.16–v2.22 folded in from
      the README's log, newest first, dated from the tags and the version-bump
      commits, nothing dropped; the two facts the README's header carried that
      the v2.1 and v2.3 entries did not are in them now. — *project record · #60*

- [x] `PM-03` **"Next, in order" is gone.** `BUILD-NOTES.md` now says
      `docs/BACKLOG.md` is the only queue, and why a second list that can go
      stale is worse than none. — *project record · #60*

- [x] `VD-14` **A table wider than its box says so.** A fade at the right
      edge while there is more table to the right, set by `DataTable` from
      the scroll position, and the scroll region takes a tab stop only then.
      Smoke checks the driver register at 375 px. — *visual critique · #63*

- [x] `IA-14` / `IX-15` **The masthead wraps on a phone.** Two rows rather
      than a strip with a hidden scrollbar; smoke checks every item is on
      screen at 375 px. — *IA and interaction critiques · #63*

- [x] `VD-20` **A loading photograph, a failed one and an arrived one look
      different.** `CommonsImage` tracks the three states: the sunk box
      breathes while the thumbnail is on its way (still under
      `prefers-reduced-motion`), and a failed load collapses to a sentence
      with the link to the file page. The other half — the three redirects
      per thumbnail, and whether to hold the resolved `upload.wikimedia.org`
      URL in the harvest — is a data change and stays open as `VD-23`. —
      *visual critique · #63*

- [x] `UR-13` **A season still running opens with who leads, by how much,
      after how many rounds** — in the app's stats and the static facts list,
      and in the page description a search engine shows. Found on the way:
      the static standings table read the raw `standings` table and listed
      every 2026 driver twice (formula1.com and F1DB rows after the same
      round); it now reads `v_standings_final`, as the app does — for every
      season, not only a running one: the review of #64 found 2025's static
      table gained its team column, which the raw snapshot left blank. — *user
      research · #64*

- [x] `IA-07` **The SQL console has a permalink.** `?q=` carries the
      query: written on every run, read and run on arrival, so a query can
      be shared, bookmarked or cited. — *IA critique · #65*

- [x] `IX-11` **An example no longer destroys the reader's query.** Not
      through `execCommand('insertText')` — a controlled textarea and the
      browser's undo stack do not agree — but by keeping what was replaced
      and offering it back in one click. — *interaction critique · #65*

- [x] `CR-21` **The two column-filling harvests have a floor.** `verify.py`
      requires `chassis.weight_kg` and `chassis.wheelbase_mm` to be filled at
      least as often as at v2.22 and `article_images` to hold at least its
      602 rows, so deleting `car_specs.txt` or `article_images.txt` no longer
      builds clean. — *code review of #42 · #66*

- [x] `LV-01` **Live session data — decided.** The weekend timetable and
      after-the-fact session classifications go ahead as `LV-02` and `LV-03`;
      a live feed is declined unless a licence is obtained, because session
      timing is FOM's data. — *request · decided 2026-09-12*

- [x] `PM-04` **The GitHub repository description** now states what the
      database is and where to browse it. — *product management · applied
      2026-09-12*

- [x] `PD-03` **`/records` is derived, not published.** The thirty authored
      rows — at `medium`, twenty-four spellings of `as_of`, nothing in
      `verify.py` reading them, Hamilton on 105 wins beside a `drivers.wins`
      of 106 — are gone. `build.py` derives 29 records in `derive_records()`,
      each one query over the tables the leaderboards read, with its rule,
      exclusions and runners-up in `detail`, every holder of a tie, and
      `as_of` read off the last completed race. Five the old table carried
      cannot be derived and are declared in `known_gaps` #12 rather than
      typed: youngest and oldest champion (the clinching round), closest
      finish and longest race (no race times), the only woman to score
      points (no gender attribute). Three derived figures differ from the
      authored rows they replace (`data/technical.py` before #68): Arrows'
      382 merged the Footwork years, and counting under one constructor name
      as `constructors.wins` does gives Sauber 547; McLaren's 15 of 16 in 1988
      is beaten outright by Red Bull's 21 of 22 in 2023; and 833 was
      qualified "under the current points system", a qualifier the derivation
      does not apply, so 860 (2023) stands. `verify.py` recomputes nine of
      them by a different route. — *product critique · #68*

- [x] `DA-19` **`records` can be joined, compared and checked.** `key`,
      `holder_table` + `holder_id` (NULL exactly when shared), `value_num` +
      `unit` beside the display `value`, one ISO `as_of` that `verify.py`
      holds to the coverage. — *data architecture critique · #68*

- [x] `IA-02` **`Reference` leaves the masthead; `Data` takes the slot.** The
      masthead stays at eight: Seasons · Races · Drivers · Constructors ·
      Circuits · Cars · Records · Data. `/data` is the database's own front
      door; `quality`, `sources` and `sql` sit under it at `/data/quality`,
      `/data/sources` and `/data/sql`, summarised on the front door and kept
      as the pages they were — merging two long pages was a rewrite, and this
      was a move. `eras` and `glossary` keep `/reference/eras` and
      `/reference/glossary`, lose the slot, and are reached from the pages
      about the sport: Seasons, Cars and Circuits already led to the eras;
      Races now leads to the glossary and the home page to the eras; the two
      carry an "About the sport" nav of their own. The four old addresses
      answer in the app with a `<Navigate replace>` that carries the search —
      `/reference/sql?q=…` is #65's permalink and still runs — and in the
      static output with a redirecting page each (meta refresh, canonical to
      the new address, `noindex`, the query carried by script), written
      outside the sitemap. The smoke test asserts the eight, the version on
      `/data`, both redirects with the query intact, and the sitemap naming
      the new addresses only. — *IA critique · #67*

- [x] `PD-11` **Give the bulk data a front door, and a claim.** `/data`, in
      the app and prerendered: the version and build date from `meta`, the
      two database files with sizes and the manifest's digests, the Parquet
      bundle — linked from a page for the first time — the two JSON exports
      named as release assets rather than linked, since nothing serves them,
      the confidence ladder, the counts of disagreements, open disagreements,
      gaps and sources read live, the three licence classes with their
      counts, the four empty tables stated as a licence decision, and the SQL
      console. The claim is `PD-14`'s wording — *cross-checked against
      independent sources, with every disagreement and every gap published in
      the data* — in one string in `site.js` shared by `Data.jsx` and
      `prerender.js`, so the app and the crawlable page cannot say different
      things. The static page carries `schema.org/Dataset` markup with a
      `DataDownload` per served file. `CD-07`'s adversarial sentence is still
      open; the sizes and digests come from `db-manifest.json`, not yet the
      release body's which-copy-wins sentence or the publisher block
      (`UR-05`/`SD-15`). — *product critique · #67*

- [x] `PD-09` **Rework `/reference`.** Landed as `IA-02` and `PD-11`, which
      made the naming decision this was waiting on: the database drawer is
      `/data` in the masthead, the sport drawer kept its addresses, and the
      redirects were the work. — *product critique · #67*

- [x] `CD-02` **111 driver ledes open with how the row got into the database.**
      `drivers.notes` was doing two jobs — the page lede and meta description,
      and the record of how a harvest put the row there. Split: the provenance
      sentence moves to a new `drivers.provenance` column, shown in the driver
      page's "On the record" fields in the app and the prerendered HTML alike,
      and kept out of the meta description; `notes` keeps only what the string
      already said about the driver, so the 62 podium-harvest rows now have no
      lede and their description falls back to the stored wins and poles (a derived summary is `CD-20`). `verify.py`
      refuses a note that opens with "Added " or mentions a harvest.
      — *content critique · #70*

- [x] `UR-12` **Amon's page gives three answers to "how many races".** The prose
      no longer states a figure the strip derives: "96 starts" and "eleven
      podiums" leave Amon's note, and the same rule takes the typed starts,
      races and podiums out of twelve more — Heidfeld's 183, de Cesaris's 208,
      Barrichello's 322 among them. Amon's 96 cited no source, so it leaves
      rather than becoming a `discrepancies` row. `verify.py` refuses a bare
      integer before starts, races, wins, poles, podiums or points in any
      driver note. — *user research · #70*

- [x] `PD-06` **The drivers register's first screen answers a question.**
      Most wins first, in the app and the static page; `Entries` and
      `Starts` — published figures held for 38 and 31 of 862 drivers, so two
      columns of em dashes — are gone from the register and stay on the
      driver's page labelled as stored; `Races` is counted from the race
      records. Also pins the front-end reviewer agent to Opus, as every other
      reviewer already was. — *product critique · #69*

- [x] `PD-05` **`known_gaps` carries a state, and the site counts only the
      open ones.** `state` is `open`, `closed` or `position`, and `reader` is
      the one-paragraph version a reader is shown; the description and
      resolution the rows always carried are the maintainer's note, kept
      whole behind a disclosure. `/data/quality` and its prerendered page
      show three groups — Open, Positions, Closed — and a closed gap is
      recorded as closed, never deleted. The homepage, `/data` and the
      README figure all count `v_open_gaps`; `verify.py` holds the view to
      the table, requires a reader sentence on every row and a version or PR
      in every closed row's resolution. — *product critique · #72*

- [x] `CD-06` **The count is seven, not six, and the twelve rows are placed.**
      #1 and #2 closed (the fastest-lap harvest, the full classification),
      #5, #8 and #10 positions (no redistributable lap timing, a race in
      which no lap was set, no historic centrelines), and #3, #4, #6, #7, #9,
      #11 and #12 open — #12 arrived with `PD-03` in #68, after the critique
      counted. The critique's six reader sentences are used where they still
      fit the row; the others are written from the row's own text. The 2021
      Belgium note stays in the register as a position rather than moving to
      the race page. — *content critique · #72*

- [x] `PD-10` **A citation block on every page.** One sentence — the
      database version and build date and the page's permanent address —
      from one function in `site.js`, rendered by `Page` in the app and by
      `chrome()` in the static page, so a crawler sees it. The page is named
      by its address, not its title: the two renderers title routes
      differently, and the review caught the drift. Pages that do not exist
      (the not-found route and the six "No such …"/"No season" shells) offer none. The
      reader's own access date is left to the reader; the build date is what
      fixes the figures. — *product critique · #71*

- [x] `CD-20` **81 driver pages describe themselves in fifty characters.**
      Every driver's meta description is now one sentence counted from the
      race records — the entries, first and last year, constructors, wins,
      podiums, poles and best finish the strip derives — and never a column
      the page labels "(published)": "Entered 88 championship Grands Prix
      across 1979–1986 for Arrows, Brabham and 3 other constructors; best
      finish fourth." A career with no classified finish says so. The lede
      follows where a whole sentence of it fits; where it would be cut
      mid-thought the derived sentence stands alone, so all 862 end at a
      sentence and none reads "0 wins". The smoke suite checks the first
      lede-less driver's description against the entry count in `f1.db`.
      — *review of #70 · #75*

- [x] `CD-18` **"Races" on the register, "Entries (stored)" on the page.**
      One word, "Entries", for the count of `race_entries` rows — a row is an
      entry, not a start — on the register (app and static, column and
      footer), in the strip and season table on the driver's page, and in
      the static page's facts and seasons table. The published figures are
      labelled for what they are, "Entries (published)" and "Starts
      (published)", in the app and the static HTML alike; the static facts
      gain the derived Entries the app's strip already showed.
      — *review of #69 · #75*

- [x] `WK-05` **The season's grid is counted.** `v_season_grid` — drivers
      entered (from the race entries; a DNQ is an entry, and no source says
      who started), constructors by their F1DB key so the Indianapolis
      builders of 1950–1960 count, engine makers, races run — one row per
      season, pinned by `verify.py` to direct counts for four seasons; a line
      on every season page and a fact on the static one. The first cut
      counted the curated constructor key (1950 read eight, not
      twenty-three), said "started", and bounded the view by identities; the
      review caught all three. — *Wikipedia survey · #73*

- [x] `CD-19` **Driver ledes no longer spell a figure the strip derives.**
      `verify.py`'s check reads spelled cardinals (one to twenty, thirty to
      hundred, compounds), digit and spelled ordinals above "first" ("300th
      start", "eighth start"), and "Grand Prix" between the number and the
      noun, before starts, races, entries, wins, poles, podiums, points,
      fastest laps or titles; a year before "title" and a margin ("by two
      points") are not figures. It caught sixteen notes, and stripping the
      figure exposed five that the race records contradict — Hulkenberg's
      pole came on his eighteenth start, Bottas was runner-up twice not four
      times, Ricciardo never won for Renault, Stroll's pole was Istanbul 2020
      not Monza 2017, Rindt had three races left not four — and one false
      record: 2025's top three were 13 points apart against 2007's one, so
      "the closest top three ever" leaves Piastri's note and, though no
      regex reached it, Norris's. Each note keeps what its string already
      said; "Ten podiums." simply goes. — *review of #70 · #74*

- [x] `CR-22` **The static `/records` page is not the app's `/records`.**
      Narrowed by #68: both renderers open with the same one-sentence claim
      and the static table carries the derivation column. What remained was
      the tier: the app said once that every row is `reference`, the static
      page said nothing about it. The static page now says it in the app's
      sentence, from the app's query, in `web/src/queries/records.js`. —
      *review · #77*

- [x] `CR-23` **The static `/records` table has a `Category` column the app
      never shows.** Predates #68; the review of #68 measured it. The static
      table is now drawn from the app's column list, so it cannot carry a
      column the app does not. — *review · #77*

- [x] `CR-24` **The static drivers register is not the app's.** Eight
      columns against nine, Poles before Podiums against Podiums before
      Poles, no Fastest laps. Same defect as `CR-22`/`CR-23`. The register is
      now the app's query and column list, from `web/src/queries/drivers.js`;
      the driver page's strip and its season table follow the same way.
      Found by the review of #69. — *review · #77*

- [x] `WK-04` **The new-team entry fee is a press figure, and the database
      says so.** A `known_gaps` row: the anti-dilution fund is a term of a
      private contract, the US$200m and US$450m figures are reported, not
      published, and no `governance` row carries them. Closes if the FIA or
      Formula One publishes the figure. — *Wikipedia survey · #78*

- [x] `PM-20` **The two data warnings are read, and neither was data to
      sit.** The two qualifying rows without a race entry are the HRTs that
      failed the 107 per cent rule at Melbourne in 2011: F1DB's qualifying
      holds them, its classification omits them (its 2012 classification
      records the same case as DNQ). Not added by hand — the classification
      is loaded whole from a harvest file the fetch rewrites, and there is no
      curated path for a classification entry — but declared: an open
      `known_gaps` row, and the warning is now a check pinned to the pair by
      identity, whose detail says which way it failed. The three chassis
      entered after their car's works career are real privateer entries (de
      Tomaso 1957, Dochnal and Blokdyk 1963, Courage and Irwin 1967), which
      the warning's own comment already said; that check is pinned to the
      three by identity too. — *project record · #80*

- [x] `CD-21` **The lede check allows an adjective before the noun.** Up to
      two lower-case words may sit between the number and the noun ("three
      straight wins"); a capitalised word names a subset the page never
      totals ("Six Monaco wins", verified 6, and Hill's 5) and stays; "GP"
      qualifies the noun like "Grand Prix". Re-run, it found five: Ascari's,
      Vettel's and Schumacher's streaks were right and are now dated rather
      than counted, Surtees's seven motorcycle titles are counted as times
      rather than titles, and Montoya's "fourth GP start" was wrong — the pass on
      Schumacher at Interlagos 2001 was his third. — *review of #74 · #79*

- [x] `PM-27` **The fetch tool reads F1DB's licence before it writes a
      row.** `licence_check()` in `tools/f1db_fetch.py` requires the deed in
      the checkout to be titled Attribution 4.0 International and to name no
      NonCommercial, ShareAlike or NoDerivatives element, and exits
      otherwise — so `refresh.yml` fails at the fetch and commits nothing,
      and reclassifying the source in `SOURCE_LICENCE` becomes a decision
      someone makes rather than a header a constant stamped; the message
      asks for the file to be read, since the check cannot tell a relicence
      from a reformatted deed. Eight unit tests, offline; the live deed
      passes. — *project record · #83*

- [x] `PD-13` **The upstream dependency is written down.** `docs/UPSTREAM.md`:
      what F1DB supplies (115,161 of 119,280 rows at v2.23, table by table),
      how it arrives (a committed snapshot, refreshed daily by `refresh.yml`
      and committed only on a full pass), the four cross-checks that refuse a
      bad load, what happens if it stops (staleness, not breakage; the
      replacements in cost order, with formula1.com kept at the check scale
      its facts-only classification covers) and if it relicenses (the grant
      is irrevocable, section 2(a)(1); the one unsafe path is `PM-27`).
      Linked from the README's Staying current section. The review of #82
      caught the first draft overstating the project's independence from
      F1DB in three places and mis-citing a gap and a licence section; the
      README's "known_gaps #1" for the Jolpica decision was the same
      mis-cite and is #2 now. — *product critique · #82*

- [x] `CD-22` **Where the register's seasons are not the race records', the
      page says which is which.** The Seasons note on the driver strip, in
      both renderers, reads "1969–1973 in the race records, 1970–1973
      published" where the spans differ; two drivers do (Cevert's 1969
      German Grand Prix in a Formula 2 car, Rossi's practice-only 2014), each
      side right about something, and `verify.py` pins the pair. An open
      span — a driver still driving — makes no claim about its last year,
      which the first cut missed and the review caught on 23 current
      drivers. — *review of #75 · #81*

- [x] `IX-17` **The grid filter keeps the grid, and derives it.** It tested
      `last_season` against 2026, a year the register's open span never
      holds, and matched nobody. The shared `DRIVERS` query now derives
      `on_grid` — an entry in the latest completed season — and the season
      itself, so the chip names the year from the data; `verify.py` fails an
      active driver with no entry and reports a mid-season replacement (the
      review of #84 found Doohan in 2025 would have failed a two-way pin);
      the smoke test pins the exact count and that it is above zero. In
      pre-season, when the calendar holds a year with nothing completed, the
      register check is only reported — the second review found a
      name-based exemption covered a debutant and not a returning signing. —
      *review of #81 · #84*

- [x] `CD-23` **The lede check is one tested pattern.** `tools/lede_figures.py`
      holds it, with its reasons; `tests/test_lede_figures.py` makes both
      interpreters prove 18 catches and 12 leave-alones. Career qualifiers
      (`F1`, `Formula One`, `World`, `World Championship`, `Championship`,
      `Drivers'`, `career`) no longer hide a total; "of", "his", "the" and
      kin no longer bridge the gap; "Six Formula One wins" is reported whole
      and "Formula One wins" alone is not a figure; eleventh to nineteenth
      join the ordinals, which had skipped them — the comment's own
      Hülkenberg example never matched — and so does twenty-first and kin,
      which the review of #85 found the same way. No note needed rewriting;
      three stale open lines are gone from the queue, each a duplicate of
      a landed entry — `CD-21` (#79), `CR-23` and `CR-24` (both #77) — the
      first two by a block edit the review of #85 caught as unrecorded. — *review
      of #79 · #85*

- [x] `CD-24` **Subset figures in a driver note are counted.**
      `subset_figures()` in `tools/lede_figures.py` finds the "<N> <Place>
      wins/victories/poles/podiums" form — and only that form; "six wins at
      Monaco" is not read; `verify.py` counts each from `race_entries`, the
      table the strip derives from, where the place is a Grand Prix (Senna
      6, Hill 5, Trintignant 2 at Monaco) and requires the rest to be
      declared — Ickx's six Le Mans wins are, and an undeclared place fails.
      — *review of #79 · #88*

- [x] `PM-29` **The build reads the season in progress from the entry
      lists.** `b.current_season` is the latest year anybody entered; the
      admitted drivers' `status` and the admitted constructors' `active`
      flag compare against it instead of a typed 2026 that would have kept a
      2026-only driver active after the rollover; the curated registers'
      typed statuses are untouched. The build stops if the entry lists ever
      reach a season the classification has not, which is the assumption
      the derivation rests on. Byte-identical database today. — *review of
      #84 · #86*

- [x] `PM-28` **Nine gap citations name the gap they mean.** Three code
      comments that meant the Jolpica licence decision now say `known_gaps`
      #2 and four that meant the abandoned chassis-per-race harvest say #3
      (one of them in `schema.sql`); the `article_images` provenance note
      and the `table_provenance` schema comment said #10, the centrelines,
      for #11, whether a photograph shows the car — and those two ship in
      `f1.db`, so this is a rebuild, not a comment edit. The review of #87
      found the three the `.py`-only grep missed. — *review of #82 · #87*

- [x] `CD-25` **The reason two spans differ sits beside the fact.**
      `EXPLAINED_SPANS` in `data/harvest.py` puts a `discrepancies` row for
      Cevert (a Formula 2 class at the 1969 German Grand Prix) and Rossi
      (two 2014 entries, no start), status "explained - each side is right about
      something"; both renderers show it through the disagreement aside,
      introduced as two readings rather than a disagreement to settle, and
      `verify.py` derives the pair it pins from those rows, so the pin and
      the explanation cannot drift apart. The review of #89 caught the first
      Rossi wording claiming a practice-only 2014 when F1DB's entry lists
      name him as entered for two rounds; the row now says what the data
      says. The symmetric-predicate clause is `CD-26`. — *review of #81 ·
      #89*

- [x] `PM-30` **A gap's id is written, not counted.** Every `KNOWN_GAPS`
      tuple carries its id, so filing a gap mid-list no longer renumbers the
      citations after it; `verify.py` requires the ids to be 1..N with no
      gap or repeat, and walks the tree for every `known_gaps #N` to fail
      one that names a row that does not exist. Which existing row a
      citation should name stays a reader's judgement, as `PM-28` was. —
      *review of #87 · #90*

- [x] `LV-02` **The weekend timetable, as data.** `sessions`: 115 rows, every
      session of the 23 2026 weekends with its start in UTC and the
      circuit's IANA zone, read from formula1.com's race pages (a start time
      is a fact). `verify.py` holds each weekend to the five sessions its
      sprint flag implies, in running order, with a valid zone, and holds
      each race's local day to the last day of the calendar's weekend — the
      test that proves the UTC reading and the zone together (Las Vegas
      races on a Saturday evening that is Sunday in UTC). Starts carry a Z
      so a browser reads them as UTC. The FIA's per-event timetable PDFs are
      not yet read by tool; `known_gaps` #15 records that every start has
      one source behind it until they are. The page work stays open as
      `LV-02`. — *request · #91*

- [x] `PD-12` **The timing constraint is a position.** The shared `NOT_HELD`
      sentence on `/data`, in both renderers, opens with what the absence
      means — nobody publishes Formula One race timing under a licence that
      permits passing it on, so this database holds none of it, and
      everything here may be passed on under the licence shown beside it —
      before it names the four empty tables. The first cut said "no one may
      lawfully redistribute lap timing", which the review of #94 showed was
      a claim about the law rather than the licences and collided with the
      27,000 qualifying lap times F1DB publishes under CC BY; `known_gaps`
      #5 carries the same words. — *product critique · #94*

- [x] `PM-31` **The commercial-readiness figures are spans the build writes.**
      `tools/readme_figures.py` now writes every document in `DOCUMENTS` —
      the README and `docs/COMMERCIAL-READINESS.md` — and counts the licence
      position the way `./f1 licences` does: class shares, the two facts-only
      domains, and each listed table's rows; `verify.py` checks them all.
      The class table had said 539 against 552 held. The writer refuses a
      facts-only row in a table the statement does not itemise, and every
      listed table's figure must be stated or the build fails — the review
      of #92 found the first cut's span would have rewritten itself around
      an unread row, and a second cut's sum check that could not fail. —
      *review of #91 · #92*

- [x] `CD-26` **The span comparison is symmetric, and either end can be
      declared.** A NULL at either end of the register's span is no claim
      about that end and the other is still compared, in `seasonsNote()`
      and the `verify.py` pin alike; an `EXPLAINED_SPANS` row may name
      `last_season`, and its figures are checked against the records' MAX
      year as a first-season row's are against MIN. No row needed it today.
      — *review of #81 · #93*

- [x] `PD-26` **`/records` holders are links.** `holderPath()` in the
      shared records module resolves a driver, constructor, circuit or race
      holder to its page — a race by year and round, which the query now
      carries — and both renderers link it; a shared record, which names
      two holders and carries no id, stays text. The wins and poles
      leaderboards link their drivers as well; the champions, decade and
      constructor tables are `PD-27`, because their views carry no id. —
      *product critique · #96*

- [x] `CD-27` **The aside and the strip agree: the register's figure is
      "published".** The explained aside says "the published span and the
      one the race records give differ", from a footer string both renderers
      share and a unit test pins. The quality page's column is "Recorded",
      not "Published" — the review of #97 found thirteen of its rows hold
      this project's own authored claim, which nobody published. The
      assessments inside `f1.db` still say "the register's" and "the stored
      figure"; that is database prose, `CD-28`. — *review of #89 · #97*

- [x] `LV-02` **The weekend timetable, on the page.** Every race page carries
      a Timetable — each session on the circuit's clock and in UTC, both
      derived through Intl from one stored instant and zone — in the app and
      the static page from the shared `web/src/queries/sessions.js`; the app
      adds the reader's zone and "Next: … in 11 days", and the 2026 season
      page names the next session with a link to its race, computed in the
      browser, which is the only place "now" exists. — *request · #95*

- [x] `PM-32` **The loop is a skill, not the default.**
      `.claude/skills/backlog-loop/`: the procedure (`SKILL.md`), the CI
      waiter that treats
      empty output as pending, the merge helper that resolves only the
      backlog's predictable conflict and a moved figure span, rebuilding the
      artefacts rather than hand-merging them and stopping on any source
      conflict, the reviewer brief, and a `precheck.sh` that refuses the slips
      a reviewer used to find. Three review rounds in the 2026-09-12 run were
      lost to retyping these by hand. Model policy decided 2026-09-13:
      Opus for a first pass, Sonnet to confirm a fix or review wording, one
      reviewer unless a source is reclassified, and a documentation-only fix
      merges without a further pass (`PM-33`). Invoked with `/backlog-loop`
      through `.claude/commands/backlog-loop.md`; `CLAUDE.md` says so. —
      *project record · #98*

- [x] `CD-28` **The assessments say "published" too.** The two explained
      span rows and the nine 2026 points rows in `discrepancies` no longer
      say "the register's" or "the stored figure"; every surface on a driver
      page now uses the one word. — *review of #97 · #99*

- [x] `PM-34` **The fourteen stale open lines are gone.** `CD-18`, `CD-19`,
      `CD-24`, `IA-02`, `PD-03`, `PD-05`, `PD-10`, `PD-11`, `PM-29`, `PM-31`,
      `VD-07`, `VD-08`, `VD-11`, `VD-12` — each confirmed against its *Landed*
      entry and its open line removed in the 2026-09-13 re-rank; the merge
      helper's duplicate check is the guard from here. — *review of #98 ·
      [#100](https://github.com/Alex-Farley/formula-1-data/pull/100)*

- [x] `IA-17` **The season in progress is labelled as concluded.** The
      headings turn on whether a round is still scheduled — *The title race*
      and *Drivers' standings after round 13* while one is, *How the title
      was decided* and *Final drivers' standings* once none is — from one
      rule in `queries/season.js` that the app, the prerenderer and the smoke
      test all read, so the static page fixed itself in the same change
      (`UR-13`'s other renderer). On `/seasons` the live row carries its
      leader, the leader's points and wins so far, the driver second, the gap
      and *13 of 23* rounds, each marked *so far*, from `queries/seasons.js`;
      `/races` opens on the last race run, the rounds to come following every
      race that has been; the next session is a tile among the others, and
      only in the app, since only a browser knows how long until it. Rung two
      of `PD-02` shipped with it, because the fix and the sharing were one
      edit. — *IA critique · #102*

## Declined

Measured, decided, and on the record. Each may be re-raised — the reason is what
a critique has to argue against.

- **Moving `/records` out of the masthead.** The IA critique (`IA-16`) examined
  the slot and endorsed it: seven of the eight current nav items map 1:1 to a
  table, and Records is the only one cut by question rather than by storage, as
  well as the highest-intent fan destination. `PD-03` is a content problem, as
  filed. The escalation is recorded on `PD-03`, not here. — `IA` critique

- **Building full-text or site-wide search.** It already exists. `Search.jsx` is
  good work that is mislabelled and indexes the wrong column; `IA-05` and
  `IA-06` are the fix. — `IA` critique
  **Re-raised 2026-09-13 as natural-language search.** The position holds for
  full-text: the fix for a question is not indexing more text. What is filed
  instead is `IA-20` — a wider needle, an intent grammar and a question
  library, no model — with generated SQL held as a decision.

- **Route-level code splitting in the front end.** The bundle is 398 KB raw /
  118 KB gzipped, irrelevant beside the database the browser downloads (4.4 MB
  gzipped, 20 MB raw). — `CLAUDE.md`

- **An HTTP range-request VFS for the data layer.** No source has lap times under
  a redistributable licence, and prerendering already took the download off the
  first-paint path. The product critique reopened this specifically and cleared
  it: *"the problem is not the 27 seconds — it is that the page shown during them
  is a different product."* — `CLAUDE.md`, `docs/TIMING-ARCHITECTURE.md`,
  `PD` critique

- **`BUILT` as a real timestamp.** The database must be a pure function of its
  sources so CI can compare the committed artefact against a fresh build, and so
  the browser can cache on a digest. — `CLAUDE.md`

- **Merging `f1-geometry.db` into `f1.db`.** ODbL's share-alike reaches the whole
  database its data lands in; merging would put 117,000 unrelated rows under
  ODbL. — `CLAUDE.md`, `docs/COMMERCIAL-READINESS.md`

- **Filling `laps`, `stints`, `race_timing` and `race_control_messages`.** No
  source publishes Formula One lap timing under a licence that permits passing it
  on. The empty tables are the correct permanent state, not a missing feature. —
  `docs/TIMING-ARCHITECTURE.md`

- **Deleting the 148 hand-maintained 2025–26 rows** in `races`, `race_entries`
  and `standings` as redundant beside F1DB. The Wikipedia harvest stops at 2024,
  so they are the only independent check on the two most recent seasons.
  Removing them removes a check, not a liability. — `docs/COMMERCIAL-READINESS.md`

- **A deploy-time database rebuild.** The Cloudflare build does not rebuild the
  database and should not: a build step whose execution cannot be established
  invites exactly the reasoning that cost three deploys. CI rebuilds from
  `data/*.py` and compares against the committed artefact on every push, which is
  a better place to stop a bad database than a deploy. — `CLAUDE.md`,
  [#25](https://github.com/Alex-Farley/formula-1-data/pull/25)

- **Interactive 3D circuits with elevation.** Raised by the author on
  2026-09-11; declined by four disciplines independently (`PD-23`, `VD-12`,
  `IX-10`, `UR` Q3). The reasons that bind: it would be the only figure in the
  database with no cross-check and no honest confidence tier; the free DEMs
  are surface models that return rooftops on the seven street circuits; a
  WebGL canvas cannot be prerendered, cannot carry `Figure.jsx`'s table of its
  own numbers and cannot be read by a screen reader, on the one page type that
  already has no static content; three.js would double the bundle the
  code-splitting decision rests on; and a perspective view makes the one
  comparison the shape supports *harder*. The Lap Ledger-shaped versions are
  filed and small: `elevation_change_m` as a sourced column (`PD-23`), the
  atlas renderer on the circuit page (`VD-12`), and a profile strip under the
  plan map if a source is ever classified. Re-raise with a sampled SRTM
  profile of Monaco that looks like Monaco. — `PD`, `VD`, `IX`, `UR`

- **A formula1.com-style hero portrait on driver pages.** formula1.com's
  pages are a marketing surface for ~20 licence-holder drivers; this register
  has 862, and 302 of them would have no portrait, clustered in the pre-1970
  half that is most this project's own. Across 22 simulated tasks no persona
  was blocked by the absence of a photograph; five were blocked by a false
  or missing figure. An *identification* portrait beside the heading remains
  open as `PD-18`, after `PD-16` and `PD-19`. — `PD`, `VD`, `UR`
  **Checked 2026-09-13:** `PD-28`'s season page keeps to this — no portrait,
  the season's figures lead.

- **Changing `race_entries`' grain to (race, driver, car).** The known loss
  from one row per driver per race was measured: two positions in 27,482 rows
  (1955 Argentina P3, 1956 Monaco P4) where a co-driver already has a row in
  that race. Changing the grain would touch every view, both exporters,
  `verify.py` and the front end to fix two rows. Record the two in
  `discrepancies` with the arithmetic; move the grain statement into an
  inline schema comment that ships (`DA-06`). — `DA` critique

- **The whole-download architecture**, re-examined a third time on
  2026-09-11 by the product, interaction and user-research critics with the
  network available, and cleared again: the second visit is 0.8 s, and the
  cold window is a content-and-signalling problem (`IX-01`, `IX-02`, `PD-02`,
  `PD-22`), not an architecture one. — `PD`, `IX`, `UR`

- **Making the repository public.** Decided 2026-09-11 by the author: it
  stays private. Raised by `PD-14` and `SD-01`, which are right about the
  consequence — the pipeline half of the "audited" claim (the ~200 checks,
  the source literals, "rebuild and compare") is not readable by anyone, and
  the release page's stable links are 404. What remains checkable from the
  artefact alone is kept and is the claim now made: `discrepancies` (45
  conflicts, 44 resolved on the record, 1 open), `known_gaps`, a source on
  every row with its licence in `source_registry`, the schema's comments
  inside the file, and stored-versus-derived figures shown side by side.
  `AF-02` carries the three follow-ons that keep most of the ground. Re-raise
  only with a reason the author has not weighed: the code is private by
  choice, not by oversight. — the author

- **Telemetry replays.** Re-raised by the maintainer on 2026-09-13 and
  declined again, on the licences alone: Jolpica-F1 and OpenF1 are CC
  BY-NC-SA 4.0 (OpenF1 now declares it on its own site — `PD-29` corrects the
  stale *FOM's data* cell), FastF1 is FOM live-timing data, F1DB has no lap
  times. What may be drawn is drawn: `PD-30`'s grid-to-flag, stint windows and
  gap-to-pole from CC BY 4.0 tables. Re-raise only with a source that both has
  the data and permits passing it on. — `PD` critique, the design review

- **A ninth masthead item for the current season.** The taxonomy is eight cuts
  by entity plus `Data`; the season is the one cut by time and already has a
  slot at `/seasons/:year`. `IA-18`'s `/now` redirect and `PD-28`'s page that
  knows it is in progress do the job; the nav already overflows at 720 px
  (`IA-14`). — `IA` critique

- **A new visual identity.** The Pit Wall system is measured and coherent;
  the flatness is density and what the accent is spent on (`VD-26`, `VD-28`,
  `VD-34`, `PD-34`). A repaint would change none of the pages whose problem is
  what is on them. Keep the tokens; spend them differently. — `PD`, `VD`
  critiques

- **Livery colours inside `f1.db`.** `PD-31` is upheld for the database: no
  F1DB field, no Wikidata value, nothing here can check a hex, and a livery is
  per-season and often mid-season. The front-end palette `AF-04` is the form
  the maintainer chose instead, on 2026-09-13, over the critic's
  recommendation to decline liveries everywhere. — `PD` critique, the
  maintainer
