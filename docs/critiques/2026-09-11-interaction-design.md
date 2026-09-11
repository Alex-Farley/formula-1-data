# Interaction design critique — 2026-09-11

**Critic:** `interaction-design-critic`, first run.
**Subject:** Lap Ledger v2.21, commit `c4026ca` on `main`, driven as the built site
(`web/dist`) served by `vite preview` on `localhost:4180`.
**Brief:** `.claude/CRITIQUE-BRIEF.md`. **Prior:** the three critiques in
`docs/critiques/` and `docs/BACKLOG.md`, both read before starting.

**How this was evidenced.** Everything below was driven in Chromium through
Playwright, at 1280×900 and on emulated iPhone SE / iPhone 13 / Pixel 5, with
CDP network throttling at 1.6, 4 and 10 Mbps. Where a claim is a number, I
measured it in that harness and the figure is in the finding. Two claims are
queries against `f1.db` / `f1-geometry.db` (search ranking, walk direction);
they are marked. Source was read only after the behaviour was observed, to name
the line. **Read-only — the repository was not modified.** Scratch scripts and
screenshots live outside it.

**Findings are filed as `IX-nn`** in `docs/BACKLOG.md`. This file is the
reasoning; the backlog is the queue.

**Re-checked by the author before filing:** `Search.jsx:79-80` breaks ties on needle length and nothing else; `lap.js:53` starts the ring at `lines[0]`; the offline claim appears at `Boot.jsx:64` and `App.jsx:87` and `web/` contains no service worker; `.boot` is `min-height: 100vh` (`app.css:1039`). The throttled timings, the boot panel's y-offsets, the search replay over 3,494 rows and the two reversed walk directions were not re-measured and stand at the critic's stated evidence level.

---

## The three that matter

### 1. The screen that explains the wait is rendered 1,391 pixels below the fold, so no one has ever seen it

`Boot.jsx` is a good piece of work — four named phases, a determinate bar,
bytes-of-bytes, and a sentence promising the payoff. It renders inside `#root`,
which sits *after* `#prerendered` in the document, and `.boot` is
`min-height: 100vh`. So on a cold visit the reader gets a complete-looking
static page and the progress panel is below it, off screen, animating to nobody.

Measured on `/drivers/hamilton`, static paint to handover: **5.1 s at 10 Mbps,
11.7 s at 4 Mbps, 28.0 s at 1.6 Mbps**, with no indication anywhere in the
viewport that anything is loading. The panel's top edge sits at y=1,391 on the
homepage, y=1,782 on a race page, y=3,880 on `/circuits/monza` and **y=33,857 on
`/drivers`** — 37 screens down. The same panel is where a *failed* boot reports
itself, so a reader whose connection drops mid-download is told nothing at all.

### 2. Any click during that wait throws away the 4.5 MB already downloaded and starts again

The static page's links are ordinary anchors, they look and behave exactly like
links, and nothing suggests waiting. Clicking "Drivers" at **t = 3.0 s** produced
a full document navigation: the in-flight `GET /f1.db.gz` was abandoned and
re-requested at t = 3.9 s. Ready at **14.9 s instead of 11.9 s, having pulled
4.7 MB twice**. Finding 1 is what makes this likely; this is what it costs.

### 3. One careless query in the public SQL console kills the whole site, silently and permanently

`SELECT COUNT(*) FROM race_entries a, race_entries b, race_entries c` — a
plausible beginner's mistake — occupies the single worker for the rest of the
session. There is no cancel and no timeout. I navigated away to `/drivers`: the
heading, the nav and the footer render, and **the table shows a skeleton that
never fills, with no message, at +22 s and indefinitely after**. The tab is not
frozen, which makes it worse: it reads as the site breaking rather than as
something the reader did. The only escape is a reload nobody has been given a
reason to attempt.

---

## The full set, by consequence

### `IX-01` — the progress panel is below the fold on every cold visit — **S**
*Evidence: drove the site, read the source. Defect.*

`main.jsx` writes the prerendered facts into `#prerendered` and `createRoot`
renders into `#root`, which follows it. `Boot` (`web/src/components/Boot.jsx`)
returns a `min-height: 100vh` panel (`app.css:1038`) while `phase !== 'ready'`.
Both are in the document at once, stacked.

Measured at 4 Mbps, 1280×900, `.boot` present and `bootVisibleNow: false` at
t = 1.5 s, 4.0 s and 7.0 s on the homepage, top edge at y=1,391 against a 900 px
viewport. By route:

| route | static page height | boot panel top | screens to scroll |
|---|---|---|---|
| `/` | 1,391 | 1,391 | 1.5 |
| `/reference/sql`, `/circuits/atlas` | 900 | 900 | 1.0 |
| `/races/2024/1` | 1,782 | 1,782 | 2.0 |
| `/circuits/monza` | 3,880 | 3,880 | 4.3 |
| `/drivers` | 33,857 | 33,857 | 37.6 |

The silent window is 5.1 s / 11.7 s / 28.0 s at 10 / 4 / 1.6 Mbps. Three things
ride on this:

- The promise *"It downloads once, then it stays in your browser — later visits
  open straight away"* is only in the panel. The payoff is real (finding
  "genuinely good", below: 12.0 s → 0.81 s) and the reader who abandons at
  second six never learns it exists.
- The **failure** state uses the same panel, so a boot that fails is as
  invisible as a boot that succeeds (see `IX-13`).
- `/circuits/atlas` prerenders *"The drawings need JavaScript; the measurements
  are on each circuit page"* — true for a no-JS reader, and read by every
  JavaScript reader for 5–28 seconds as "you will not get the drawings". A
  visible progress strip makes that sentence legible as a fallback rather than a
  refusal.

This is the cause behind the symptom `PD-02` and `IA-03` describe. They are
about the static half saying the *wrong things*; this is about the reader having
no way to know the static half is temporary.

**Do:** when `#prerendered` is in the document, render `Boot` as a fixed status
strip instead of a 100vh panel — same copy, same bar, pinned to the bottom of the
viewport — and drop it to the full panel only when there is no static page to
stand on. One conditional in `Boot.jsx` and one CSS class.

### `IX-02` — clicking during the wait restarts the download from zero — **M**
*Evidence: drove the site. Defect.*

Request log, throttled to 4 Mbps, homepage, one click on the "Drivers" nav link
at t = 3.0 s:

```
   750 GET /f1.db.gz?v=708d5f1d0f505e07      <- first attempt
  3494 NAV http://localhost:4180/drivers     <- the click
  3880 GET /f1.db.gz?v=708d5f1d0f505e07      <- from zero
 13152 GET /sql-wasm.wasm
 14557 GET /f1-geometry.db                   <- ready at 14.9 s
```

Uninterrupted, the same page was ready at 11.9 s. The file is `immutable`-cached
(`dist/_headers`), which does not help an aborted transfer. On 1.6 Mbps a single
click costs the reader roughly another half-minute, and a reader who clicks twice
pays three times.

There is no reason a reader would not click. The masthead looks live, the links
are real anchors, and (`IX-01`) nothing says a wait is under way.

**Do:** attach one delegated click handler to `#prerendered` while `phase !==
'ready'`. On a same-origin link, `preventDefault`, `history.pushState` to the
target, and leave the static page in place with the boot strip reading "opening
<page> when the database arrives". The download survives, the URL is right, and
the router picks the route up at `ready`. Ships independently of `IX-01` and is
better with it.

### `IX-03` — at handover the reader is thrown to the top of the page and loses keyboard focus — **S**
*Evidence: drove the site. Defect.*

On `/drivers/hamilton` at 4 Mbps I scrolled to y=900 — the Hungarian Grand Prix
row in the race list — and waited. At **11.84 s** `#prerendered` was removed and
the app rendered; scroll position was **y=0**. The reader is returned to the top
of a 7,000 px page eleven seconds into reading it, with no event they caused.

The keyboard case is worse. Twelve Tab presses on `/races/2024/1` during the wait
put focus on the `2024` season link. After handover `document.activeElement` is
`BODY` and the next Tab lands on the wordmark: the reader is back at tab one,
silently, at second 11.8.

Two causes: removing `#prerendered` collapses the document so the browser clamps
the scroll, and `ScrollToTop` (`App.jsx:73`) fires on mount.

**Do:** read `window.scrollY` immediately before `document.getElementById('prerendered').remove()` in `main.jsx:24`, and restore it after the app's first paint; skip `ScrollToTop`'s effect on its initial run. Focus restoration is harder and belongs to the accessibility critique — but say in the handover that the two are the same moment.

### `IX-04` — the SQL console has no cancel, and one bad query ends the session — **M**
*Evidence: drove the site, read the source. Defect.*

`client.js:10` holds one module-level `Worker` created once, with no terminate
path. `Sql.jsx:120` awaits `queryReadOnly` with no timeout and no abort. A
three-way self-join of `race_entries` (27,482³) runs forever.

Observed: Run pressed; at +4 s the console shows "Running…" and the Run button is
disabled — correct so far. I then clicked "Drivers" in the nav. The route
changed, the heading and chrome rendered, and at +22 s the register still showed
a skeleton with **no loading message, no error, and no explanation** (screenshot
`sql-escape-late.png`). Every other page in the site is in the same state from
that moment on.

The reader who did this has no model that connects "I pressed Run on a page I
have left" to "the drivers list is blank". There is nothing to undo, nothing to
cancel, and the recovery — reload the tab — is unprompted. The warm reload is
cheap (809 ms measured), so the cost of recovery is small; the cost of not
knowing to recover is total.

**Do:** give the console a Cancel button, enabled while `status === 'running'`,
that terminates the worker and re-opens the database from IndexedDB. Under a
second, measured. The same handle lets a query that outlives its page be
cancelled when the console unmounts.

### `IX-05` — search ranks by string length, so it puts the wrong driver first for 11 of the 25 winningest — **S**
*Evidence: drove the site, queried the database. Defect.*

`Search.jsx:79` scores start-of-label 100, start-of-word 60, anywhere 20, minus
`label.length / 200`. The length term is the only tie-break, so among equally
matching names **the shorter name wins**. Typed into the running palette:

| typed | first result | the one they meant |
|---|---|---|
| `hamilton` | Duncan Hamilton (0 wins) | Sir Lewis Hamilton, 2nd |
| `schumacher` | Ralf Schumacher (6) | Michael Schumacher, **3rd** |
| `senna` | Bruno Senna (0) | Ayrton Senna, 2nd |
| `moss` | Bill Moss (0) | Sir Stirling Moss, 2nd |
| `max` | Max Jean (1 race, 1971) | Max Verstappen, not in the first four |

Replaying `score()` over the full 3,494-row index against the database:
**11 of the 25 winningest drivers are not the first hit for their own surname.**

Enter opens the first result (`Search.jsx:126`), so the keyboard model actively
completes the mistake. I ran it as a task: on Hamilton's page (106 wins), `/`,
"schumacher", Enter — landed on `/drivers/r-schumacher`, **6 wins**. Nothing in
the flow flags it but the name in the `h1`. A fan settling an argument gets a
wrong answer that looks like a right one.

Some of these are honest ambiguity — Prost Grand Prix against Alain Prost, Hill
the constructor against the two Hills. Duncan over Lewis and Ralf over Michael
are not.

**Do:** add a prominence figure to the index — `drivers.wins`,
`constructors.wins`, `circuits.races` are all already columns — and break the tie
on it before length. One `UNION ALL` gains a column; `score()` gains a term.

### `IX-06` — accented names are findable by only one spelling, and it is not always the right one — **S**
*Evidence: drove the site, queried the database. Defect.*

`Search.jsx` matches raw lowercased substrings. The register is inconsistently
accented — 50 of 862 drivers carry a diacritic in `full_name`, and 0 of 80
circuits and 0 of 150 constructors do — so the reader has to guess which
convention a given row used:

| typed | result |
|---|---|
| `frere` | *Nothing in the register answers to that.* (the row is "Paul Frère") |
| `Frère` | Paul Frère |
| `eric bernard` | nothing (the row is "Éric Bernard") |
| `jarvilehto` | nothing (the row is "Jyrki Järvilehto") |
| `raikkonen` | Kimi Raikkonen |
| `Räikkönen` | **nothing** — the correctly spelled name finds nobody |
| `nurburgring` | three circuits |
| `Nürburgring` | nothing |

Both directions fail, so no single data fix would close it: a Wikipedia editor
pasting "Räikkönen" and a phone typist typing "frere" both get the same flat
sentence saying the register does not hold the thing it holds.

**Do:** fold diacritics on both sides — `s.normalize('NFD').replace(/\p{M}/gu,
'')` on the indexed label and on the needle. Four lines, and it stays correct
whichever way the vocabulary is later normalised.

### `IX-07` — search requires the reader's words in the database's order — **S**
*Evidence: drove the site. Defect.*

`"monaco 1996"` → *Nothing in the register answers to that.*
`"1996 monaco"` → the 1996 Monaco Grand Prix. `"british gp"` → nothing;
`"british grand prix"` → 77 editions. The index labels races as
`year || ' ' || name_used`, and `score()` looks for the whole typed string as one
substring.

"Monaco 1996" is at least as natural as "1996 Monaco", and it is the form a
person carries in their head. The empty result asserts the database has no such
thing, which is false and is the worst thing an empty state can say on a site
whose selling point is knowing what it does and does not hold.

**Do:** split the needle on whitespace, require every token to match somewhere in
the label, and score on the best-placed token. Same function as `IX-05` and
`IX-06`; all three are about twenty lines in `Search.jsx:79–106` and should ship
together.

### `IX-08` — the atlas marker travels the wrong way round two circuits, and starts nowhere in particular — **S**
*Evidence: drove the site, queried the database, read the source. Defect.*

`stitch()` (`web/src/lib/lap.js:41`) begins the ring at `lines[0]` — and its own
comment says the ways arrive "in no particular order". So the scrubber's `0 m` is
an arbitrary OpenStreetMap way boundary, not the start/finish line, and the
direction of travel is whichever way that way happened to be drawn.

I checked the walk direction (shoelace sign on the stitched ring) against
`circuits.direction` for all 25 traces. **Baku and Long Beach are walked the
opposite way from the racing direction the page's own Fields panel states two
inches to the right** — the panel reads "Direction: anti-clockwise" for Baku
while the marker goes clockwise. Twenty agree; three do not close and are
correctly disabled.

Meanwhile `/circuits/spa` invites the reader in with *"Open it in the atlas to
walk the lap metre by metre"*. The lap you walk starts at a point no one can
identify and, twice in twenty-two, runs backwards.

**Do:** reverse the stitched ring when its signed area disagrees with
`circuits.direction`, which is already selected by `Atlas.jsx:14`. The origin
cannot be fixed — no start/finish coordinate exists in either database — so the
readout should stop implying one: *"1,240 m along the trace"*, not a lap
position. (`PM-26` already owns the three unclosed traces; this is separate.)

### `IX-09` — dragging the scrubber tells the reader nothing the page has not already told them — **S**
*Evidence: drove the site, read the source. Defect.*

The whole output of the atlas's only real control is the `<output>` at
`Atlas.jsx:212`: `"4,253 m of 4,253"`. The marker moves along a shape the reader
is already looking at, and a distance counts up. Nothing else on the page
responds — not the Fields panel, not the colour key, not the corner-radius note.

And the page *computes* the thing the marker could say. `lap.radius`
(`Atlas.jsx:103`) is a per-point corner radius over all 7,800 traced points, used
only to pick a stroke colour and never shown as a number. The colour key lists
five bands in five close blues at a 4 px stroke; matching a stretch of line to a
band by eye is the one thing the key asks the reader to do and the one thing the
scrubber could do for them.

On an iPhone 13 the slider is **129 px wide** for up to 7 km of circuit — about
54 m per pixel at Spa, under a thumb — and the wall of 25 circuits sits 990 px
below the stage it controls, so tapping a circuit changes something 1.4 screens
away. (At 1280 px the same click moves the stage 1,000 px above the viewport;
the selected cell does highlight and the "Keep going" band updates, so it is not
invisible, just remote.)

**Do:** put the band at the marker into the `<output>` — *"1,240 m along the
trace · hairpin, 38 m"*. One expression, using an array the component already
holds, and it turns the scrubber from a position indicator into the thing that
teaches the colour key.

### `IX-10` — on interactive 3D circuits with elevation: not this, and not yet — **L, decision first**
*Evidence: drove the site, read the docs, queried the database. Preference, argued.*

The author is weighing 3D circuits with elevation against the current atlas. My
answer is no, and the reason is not cost — `f1-geometry.db` is 217 KB and 7,800
points, and elevation would add tens of kilobytes.

Four things, in order:

1. **The existing single control has no payload and one of its two claims is
   wrong.** `IX-08` and `IX-09` are a day's work between them. A surface that
   cannot yet say which way round the lap goes is not a surface to add a camera
   to. If the two S fixes land and the page still feels inert, that is
   information; if they land and it does not, 3D was never the missing piece.
2. **3D multiplies the controls a reader must discover.** The atlas today has a
   slider and two toggles, all self-labelled. Orbit, pan, zoom and a vertical
   exaggeration slider are four controls with no labels and no affordance, and
   an exaggeration factor is a number the reader must be told or the drawing
   lies. This project's whole discipline is that a figure declares where it came
   from; a 15× vertical stretch that is not stated is the opposite of that.
3. **It needs a new source, and there is no default.** `CLAUDE.md` is explicit:
   `SOURCE_LICENCE` classifies every source and the build refuses an
   unclassified one. Elevation means a DEM, a classification, a provenance
   statement, and — since the sample points come from an ODbL database — a
   decision about which file it ships in. That is real work before a pixel is
   drawn.
4. **None of the six audiences in the brief asks for it.** The fan settling an
   argument, the journalist checking a figure, the data scientist, the developer,
   the Wikipedia editor and the search arrival are all served by facts with
   sources. `PD-08` filed "decide what the atlas is for" as *not a task until
   there is a way to answer the question*, and that question is still open
   because `PD-Ø` is. Building a bigger version of an unmeasured thing answers
   neither.

What the atlas *is* good for, and should be sold as, is already on the page and
nearly invisible: it is the only place the project shows its own measurement
being checked — Walked 4.253 km against Published 4.259 km, −0.13%, over 25
circuits, with the three that do not close drawn in amber and explained. That is
the verifiability claim rendered as a picture, and it does not need a third
dimension.

**Do:** land `IX-08` and `IX-09`. Then, if the atlas is to earn more, spend the
next unit on making it answer a question a reader arrived with — "how does Monaco
compare with Spa" already works via True scale and is the strongest thing there —
rather than on a new rendering mode.

### `IX-11` — clicking a worked example destroys the reader's query, with no undo — **S**
*Evidence: drove the site, read the source. Defect.*

`Sql.jsx:205` sets the textarea's value from the example and runs it. I typed
`SELECT full_name FROM drivers WHERE country = "Italy" LIMIT 5`, clicked the
first example, then pressed ⌘Z in the textarea. The value after undo was **the
example, not my query** — React's programmatic `value` set does not enter the
element's native undo stack, so the browser has nothing to restore.

The six examples are the most inviting thing on the page and the one a reader
uses precisely when they are stuck mid-query and want to check syntax. Every one
of them is an unrecoverable destructive action on the reader's work, presented as
a suggestion.

**Do:** write the example through a path that preserves the undo stack — focus
the textarea, select all, `document.execCommand('insertText', false, statement)`
— so ⌘Z does what every other text box on the machine does. (`IA-07`'s `?q=`
permalink is the other half of making a query survive; they are independent.)

### `IX-12` — "use the button above" names a button ten pixels below it — **S**
*Evidence: drove the site. Defect.*

`Sql.jsx:194` sets the footer *"Showing the first two hundred rows — use the
button above to see the rest."* `DataTable.jsx:178` renders that string and the
"Show the remaining 662" button **in the same `.table-foot` row**. Measured on
`SELECT full_name, nationality FROM drivers`: the sentence sits at y=8,388, the
button it names at y=8,398. The only button above is Run, at y=563 — 7,800 px
back up.

**Do:** delete the sentence. The button says what it does.

### `IX-13` — a failed boot never retries, and the failure is as invisible as the progress — **S**
*Evidence: drove the site. Defect.*

I cut the network at t = 5.0 s on `/drivers/hamilton`. The design intent holds and
is good: `#prerendered` survives (`main.jsx` removes it on `ready` only), so the
reader keeps the facts they came for. But:

- The failure panel is inside the same `.boot` container, so it is below the fold
  like everything else (`IX-01`). The reader sees a normal Hamilton page and
  never learns the search button is not coming.
- I restored the network at t = 30.3 s. **Twenty seconds later the panel still
  read "The database could not be opened"** with the same `sql-wasm.wasm`
  `NetworkError`. There is no retry, automatic or manual, ever.

`CD-17` already owns the copy — the current text explains `npm run build` and
`file://` to somebody whose train went into a tunnel. This is the missing
affordance, not the wording.

**Do:** add a "Try again" button to the failure branch of `Boot.jsx` that calls
`openDatabase()` again. Ships with `CD-17`'s rewrite or before it.

### `IX-14` — "works offline" is not true of anything but an already-open tab — **S**
*Evidence: drove the site, read the source. Defect.*

The claim is made twice, on all 3,515 pages: `Boot.jsx:62` *"later visits open
straight away, and work offline"*, and the site footer (`App.jsx:91`) *"once it
has loaded it works offline"*. There is no service worker anywhere in `web/`.

Measured: load the site, let it settle, go offline, reload →
`net::ERR_INTERNET_DISCONNECTED` and Chrome's own error page. The document itself
cannot be fetched, so nothing else matters. What is true is that a tab already
open keeps working, and that a second *online* visit is nearly free (0.81 s).

**Do:** the cheap fix is to say the true thing — "a tab you already have open
keeps working with no network". Content design owns the sentence. The expensive
fix that keeps the claim is a small service worker caching the app shell plus the
last-visited routes (M), and is only worth it if offline is a use anyone has.

### `IX-15` — `IA-14` confirmed, with the measurement it asked for — **S**
*Evidence: drove the site on emulated devices. Defect — previously filed as inference.*

`IA-14` says the phone nav overflows silently, tail-first, and asks for
confirmation on a device before sizing. Emulated iPhone SE, iPhone 13 and
Pixel 5, homepage, app loaded:

| device | viewport | nav scrollWidth | hidden | items off screen |
|---|---|---|---|---|
| iPhone SE | 320 | 582 | **306 px** | Constructors, Circuits, Cars, Records, Reference |
| iPhone 13 | 390 | 582 | **236 px** | Circuits, Cars, Records, Reference |
| Pixel 5 | 393 | 582 | 233 px | Circuits, Cars, Records, Reference |

Four of eight items on a current phone, five of eight on a small one — and the
four lost include `Reference`, behind which sit the quality page, the sources
page and the SQL console, which is to say the entire distinguishing claim. The
one affordance is that "Circui" is clipped mid-word at the right edge; there is
no fade and no scrollbar. Search survives at every width and is prominent, which
is the mitigation.

Sized S as filed; the measurement supports doing it rather than changing it.

### `IX-16` — `IA-08` escalation: Back restores the scroll position and not the filter — **M, as filed**
*Evidence: drove the site. Defect — raising the severity of a recorded finding.*

`IA-08` records that filter and sort state is not in any URL and that "Back and
forward do not restore it". What it does not name is that the browser restores
*half* the view, which is worse than restoring none.

Driven: `/drivers` → nationality = France (73 of 862) → sort by Wins descending →
scroll to y=1,500 → open Didier Pironi → browser Back. Result: **y=1,474** — the
same pixel — on a table that is now unfiltered, 862 rows, sorted alphabetically,
first row Adolf Brudes. The reader is returned to the exact place on the page
they left and is looking at a completely different set of rows, with the filter
select visibly back at "All" only if they scroll up 1,474 px to see it.

A view that resets fully teaches the reader to redo it. A view that restores its
scroll and discards its state teaches nothing and can be misread. That is why I
think `IA-08` is under-rated at "lower priority than `IA-07`": the citation case
`IA-07` serves is a nice-to-have; this one silently shows the wrong rows to a
reader who thinks they are back where they were.

**Do:** as `IA-08` says — sync filter, sort and chip state to the query string in
`Filters` and `DataTable`. Independently shippable one register at a time; do
`/drivers` first, since it is the one with a scroll long enough for this to bite.

---

## Already filed, and confirmed still live

Raised only because I hit them while doing something else. No new work implied.

- **`PD-02`** — `/drivers/hamilton` reads **Entries 392** statically and **393**
  in the app, eleven seconds apart, on the same screen.
- **`PD-06`** — `/drivers` opens on Adolf Brudes with 291 em dashes visible above
  the fold and two columns empty.
- **`IA-05` / `IA-06`** — `"ferrari 312"` and `"lotus 72"` both return *Nothing in
  the register answers to that.*
- **`CD-05` / `CD-15`** — `SELECT * FROM laps LIMIT 5` returns *"The statement ran
  and matched nothing."* in 5 ms.
- **`IA-10`** — `back={{ label: 'The register' }}` is what the app offers instead
  of a breadcrumb on drivers, constructors, circuits and cars.

---

## What is genuinely good — do not touch while fixing the rest

- **The warm second visit, and the fact that it says so.** 12.0 s cold, **0.81 s**
  warm, and the footer reads "This load: from your browser store" against
  "downloaded". That is a system telling the reader what happened, in the place
  it can be checked, without being asked.
- **The static page survives a failed boot.** `main.jsx` removes `#prerendered`
  on `ready` and only on `ready`, with the reasoning in the comment. I cut the
  network mid-download and the reader kept every fact on the page. That is a
  deliberate, correct, unusual decision.
- **No hover-only information anywhere I could find.** Every chart sits in
  `Figure`, which always renders a `<details>` table of the same numbers, with
  the reasoning written on the component. Four charts, four tables. That closes
  the touch case, the keyboard case and the copy-it-out case in one move, and it
  is the reason I filed nothing about the charts.
- **`DataTable` sinks nulls outside the direction flip**, so a descending sort
  does not surface 824 em dashes, and the register's footer says so in a
  sentence: *"A blank is a figure nobody has established, not a zero, and those
  rows sink to the bottom whichever way you sort."* Convention and explanation in
  the same viewport.
- **The console's two refusals.** *"Reads only: start with SELECT, WITH, VALUES,
  EXPLAIN or PRAGMA. A write would be rolled back anyway, so nothing has
  changed."* and the non-introspection PRAGMA refusal. Both refuse, explain and
  reassure in one sentence.
- **The per-entity not-found states.** `/cars/mp4-4` → "No such car · Nothing in
  the chassis register has the id 'mp4-4' · Press / to search by chassis name, or
  browse the register." Names the thing, offers two routes out.
- **Steppers and "Keep going".** `← Previous race / Next race →` on races,
  `← 1975 season / 1977 season →` on seasons, and a three- or four-item onward
  band on every deep page with a reason attached to each destination. Arrival in
  the middle is well served once the app is up.
- **The circuits register's "Traced" column.** ●/— against all 80, with "Open the
  track atlas" above it. The 25-of-80 coverage is discoverable rather than
  mysterious.
- **The amber traces.** Monaco, Montjuïc and Las Vegas are drawn in warning
  colour, the slider is disabled for them with the output reading "not a closed
  lap", and the paragraph explaining why is directly below the wall. A
  deliberately unusual state that reads as deliberate.

---

## What I did not examine

- **Any real person.** Every audience judgement is reasoned from the artefact and
  the brief.
- **Real devices and real networks.** All measurement is Chromium with CDP
  throttling against `vite preview` on localhost. Latency was a flat 100 ms;
  a real mobile connection is burstier and the silent window would vary more.
- **Safari and Firefox.** Chromium only. The undo-stack behaviour in `IX-11` and
  the scroll clamping in `IX-03` are both engine-sensitive and should be
  confirmed once before sizing.
- **Assistive technology.** I recorded where focus lands (`IX-03`) because it is
  an interaction fact; announcements, roles and the live-region behaviour of the
  console's result count belong to the accessibility critique and I left them
  there.
- **Dark theme, and the theme toggle's persistence.**
- **Touch tooltips on a real phone.** Playwright's tap does not emulate the
  synthetic mouse events a real mobile browser fires, so I could not test whether
  a chart tooltip sticks after a tap. The `<details>` table makes the consequence
  small either way, which is why I filed nothing.
- **`/seasons`, `/records` and `/reference/quality` as interactive surfaces**
  beyond loading them and inventorying their sections. `/reference/quality` is
  15,359 px tall with eleven sections and deserves its own pass.
- **Forward navigation, multiple tabs at once, and a rebuild arriving while a tab
  is open** (`db-manifest.json` is `no-cache`, so there is a digest-change path I
  did not drive).
- **The bulk-data flows** — the GitHub release, `f1-parquet.zip`, `SHA256SUMS`.
  `PD-11` owns the front door; I did not test the download itself.
