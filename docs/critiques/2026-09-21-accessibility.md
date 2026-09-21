# Accessibility critique — 2026-09-21

**Subject:** Lap Ledger at `main` `dda5afb`, served at `localhost:4179`, and the
same commit live at `https://lapledger.org`. Both the prerendered HTML and the
app after the database opens.
**Prior:** `docs/critiques/2026-09-11-accessibility.md` (`AX-01`…`AX-22`), and
the open queue. Nothing below re-states a finding unless it has got worse, was
sized wrong, or I can now name a cause the first pass could not.

The local preview died partway through the run (another critic's process, most
likely); the last two probes — the palette's Escape behaviour and the keyboard
shortcuts — were re-run against `lapledger.org` instead, and are marked where
they appear. Everything else is the local build.

**I drove a browser.** Playwright Chromium against the built site: 1280×900,
390×844, 320×720 and 320×512; light and dark; `prefers-reduced-motion: reduce`
and not; `forced-colors: active`; JavaScript disabled; CDP throttling at
4 Mbps/70 ms for the cold path; and with the database request aborted to hear
the failure. Twenty-two routes. Everything below was observed unless tagged
otherwise.

**I did not run a real screen reader.** No NVDA, JAWS, VoiceOver or Orca was
available. Where I describe what assistive technology receives, the observation
is **Chromium's accessibility tree read over CDP** (`Accessibility.getFullAXTree`)
plus observed focus behaviour. Announcement order and verbosity differ by
product. Nothing here says "a screen reader would say".

**Automated pass.** axe-core 4.13, rule set `wcag2a wcag2aa wcag21a wcag21aa
wcag22aa`, **64 rules over 22 routes × 2 themes = 44 runs**. Result: **one
violation, on one node** — `color-contrast`, the dark-theme Run button on
`/data/sql` (`AX-06`, already filed, unchanged at 3.33:1). Everything else in
this report is something a scanner cannot see. The mechanical layer is cleaner
than it was on 2026-09-11, when the same tool found 158 nodes; `AX-05` is
comprehensively fixed and `--ink-faint` no longer fails on any surface I
measured.

---

## The three that matter

### 1. Five routes scroll the page body sideways at 320 px, and one CSS word fixes all five (`AX-10`, re-scoped)

**Conformance — 1.4.10 Reflow (AA). Defect.** `AX-10` was filed as three routes;
it is now **five**, and the three named in the issue are not the three that fail.
Measured document scrollWidth against a 320 px viewport, app side:

| route | body scrollWidth | over |
|---|---|---|
| `/now` | 453 px | +42 % |
| `/seasons/1976` | 413 px | +29 % |
| `/circuits/monza` | 366 px | +14 % |
| `/data/sql` | 344 px | +8 % |
| `/data/quality` | 324 px | +1 % |

**The prerendered half of every one of those routes is clean at 320 px.** This is
an app-only regression, and the cause is one declaration. `web/src/styles/app.css:491`:

```css
@media (max-width: 860px) {
  .split { grid-template-columns: 1fr; }
}
```

`1fr` is `minmax(auto, 1fr)`, and `auto` floors the track at the widest child's
min-content — 344 px at Monza, 391 px on 1976. The desktop rule two lines above
already uses `minmax(0, 1fr)` and is correct. I patched `minmax(0, 1fr)` into the
narrow rule in the browser and re-measured: **all five routes drop to exactly
320 px**. Nothing else changes.

`/now` is the worst of the five and is the page `PD-28` added, so this arrived
with the current-season work. Re-size `AX-10` from S to **XS** and move it to the
top of *Now*: it is the only Level AA failure on this site that can be fixed in
one word, and it takes out the whole 1.4.10 exposure.

### 2. The cold handover replaces the document, changes the heading and the title, announces nothing, and moves focus nowhere — while an ordinary click does all three correctly (`AX-01` piece 3, still open)

**Conformance — 4.1.3 Status Messages (AA); 2.4.3 Focus Order (A). Defect.**
Two of `AX-01`'s three pieces have landed and work: the boot progressbar is now
named, bounded and carries `aria-valuetext` ("13.3 MB of 21.9 MB"), and there is
exactly **one** `<h1>` in the document throughout the boot — the two-`<h1>`
problem is gone. There is now one live region during boot.

The third piece has not. Measured on `/seasons/1976`, cold, 4 Mbps, 12.5 s to
handover:

| at handover | before | after |
|---|---|---|
| `<h1>` | "1976 FIA Formula One World Championship" | "1976" |
| `document.title` | "1976 Formula One World Championship — Lap Ledger" | "1976 — Lap Ledger" |
| live regions in the document | 1 (the boot status) | **0** |
| `document.activeElement` | `body` | `body` |

The boot status region unmounts *with* the boot screen, so the one thing it was
there for — saying the swap happened — is the one thing it cannot say. And the
inconsistency is the tell: click a link inside the app and focus moves correctly
to the new `<h1>` (verified on `/drivers` → Hamilton and on a palette result →
`/circuits/monza`; `main.jsx:25` and `Page.jsx:161` both document the intent).
The handover is the one navigation that does not do it.

Worse, the swap **degrades** the page. Every static title is more descriptive
than the app title that replaces it: `/drivers` "Every driver, 1950–2027" →
"Drivers"; `/` "Lap Ledger — a Formula One database you can check" → "Every
Formula One race since 1950". And `/now` and `/seasons/2026` are distinct URLs
that the app gives the **same** title, "2026 — Lap Ledger". 2.4.2 Page Titled is
arguably still met, but the reader who arrives cold gets the good title for
12.5 s and the poor one thereafter, which is the wrong way round.

**Do,** three independently shippable pieces:
1. Keep one `role="status"` mounted in `App` for the whole session rather than
   inside `Boot`, and write one sentence into it at the `ready` transition:
   "The database is open; this page now answers from it." **S.**
2. On the `ready` transition, run the same `<h1>` focus the router already runs
   on `pathname` change (`Page.jsx`). One call site. **S.**
3. Make the app's `useDocumentName` emit the prerenderer's title string rather
   than a shorter one, and give `/now` a title that is not `/seasons/2026`'s.
   **S.** Owned jointly with content design.

### 3. Three interactive surfaces are announced only to people who can see them — and the search palette's `aria-modal` is a lie (`AX-02`, unchanged)

**Conformance — 4.1.2 Name, Role, Value (A); 2.4.3 Focus Order (A); 4.1.3 (AA).
Defect.** Re-tested in full on the live site; every observation in `AX-02` still
holds and one is new.

```html
<div class="palette" role="dialog" aria-modal="true" aria-label="Search the database">
  <input aria-controls="palette-results" …>
  <ul id="palette-results">…</ul>
```

- **Shift+Tab leaves the dialog in one press**, onto the footer's "Report it",
  then "F1DB", then "OpenStreetMap contributors" — content behind the backdrop
  that `aria-modal="true"` asserts does not exist. No `inert`, no `aria-hidden`
  on `.app`, no focus cycle. An `aria-*` contradicting its own element is worse
  than none here: a screen-reader user is reading content their software has
  been told is absent.
- **No combobox pattern.** `aria-controls` points at a `<ul>` with no `role`; the
  input has no `role="combobox"`, no `aria-expanded`, no `aria-activedescendant`;
  the `<li>`s have no `role="option"` and no `aria-selected`. Arrow keys move a
  `data-active` attribute that drives a CSS rule and nothing else — the highlight
  a sighted user steers by does not exist in the tree.
- **Escape puts focus on `document.body`**, including when the Search *button*
  opened it and Escape is pressed immediately with no intervening navigation.
  Verified on lapledger.org.
- **The result count is never announced.** Typing "monza" yields one result; the
  only live region on the page still reads "862 drivers" — the register's count,
  behind the modal.
- **New:** `⌘K` *and* `Ctrl+K` both work, on macOS, today. So the bare `/`
  (`AX-15`, 2.1.4 Character Key Shortcuts, Level A — confirmed still firing while
  focus is on a table-row link) is **functionally redundant**. Dropping it costs
  a `<kbd>` in the Search button and nothing else.

This is the site's wayfinding tool for 3,519 entities and it is the one surface
where the accessibility work has not moved since 11 September.

---

## Conformance findings

Ordered by consequence. New items are numbered from `AX-24`; existing IDs are
re-tested, not re-filed.

### `AX-10` (existing) — Reflow at 320 px, five routes — **1.4.10 (AA)** — **XS**
Above. Re-size S → XS, re-rank to the head of *Now*, and correct the body: the
three routes it names (atlas, Spa's layouts table, the SQL example) are not the
five that fail today; the atlas no longer exists.

### `AX-01` (existing, part) — The handover is silent and drops focus — **4.1.3 (AA), 2.4.3 (A)** — **S ×3**
Above. Two of the three pieces landed; file the remaining one as its own S rather
than leaving a partly-done M on the board.

### `AX-02` (existing) — The search palette — **4.1.2 (A), 2.4.3 (A), 4.1.3 (AA)** — **M in three S**
Above. Unchanged since 2026-09-11. Ranked too low for what it is: this is the
only Level A failure on the site's primary navigation control.

### `AX-06` (existing) — White on `--accent` is 3.33:1 in dark, on the Run button — **1.4.3 (AA)** — **S**
Re-measured by axe: `#ffffff` on `#ff4757`, 13.5 px, **3.33:1**. It is the single
remaining automated violation on 44 runs, and it is on the primary action of the
one surface a reader types into. Already at the head of *Now*; leave it there.

### `AX-23` (existing) — The P1 halo, and a machine-checked contrast floor defeated one line downstream — **1.4.11 (AA)** — **S**
Worse than filed, and more interesting than filed. `AX-23` records 2.33:1 light
and 2.69:1 dark. Composited across five drivers and both themes:

| driver | light | dark |
|---|---|---|
| Norris (papaya) | 1.83 | 2.66 |
| Senna (chart blue) | 1.98 | 2.15 |
| Hamilton (Petronas) | 1.83 | 2.23 |
| Vettel (Red Bull) | 2.99 | **1.72** |
| ink `.mark-halo-hollow` | 2.33 | 2.68 |

**Every one is under 3:1.** The cause matters: `web/test/conventions.mjs:711`
machine-checks that every chart-series pair clears 3:1 against `--panel` and
`--panel-sunk`/`--panel-raised`, and it passes — and then
`web/src/styles/app.css:1830` sets `opacity: 0.5` on `.figure .mark-halo` and
halves the value the check guaranteed. This is the one place in the project where
a guard exists and is bypassed downstream of itself, which is exactly the class
of thing this codebase otherwise refuses. **Do:** drop the opacity and derive the
halo stroke as a *colour* mixed toward the panel — the same `color-mix` idiom
`--livery-edge` already uses — then extend the `conventions.mjs` check to the
composited value so it cannot happen again. Re-rank from wherever it sits to
*Now*, beside `AX-06`.

### `AX-24` (new) — The prerendered race page draws the circuit outline at 1,236 × 1,236 px — **1.4.10 (AA), borderline; 1.4.4 clean** — **S**
*Evidence: drove the site with JavaScript disabled; read `scripts/prerender.js`.*

`web/src/pages/Race.jsx:244` wraps the facts block in `.with-outline`, whose
grid pins the outline card to a 200 px track (`app.css:1502`). **`scripts/prerender.js:546`
emits the same `<figure class="outline-card">` with no `.with-outline` parent**,
so on the static page the SVG takes its container's full width: measured
**1,236 × 1,236 px** at a 1280 px viewport, against 200 × 200 in the app. The
result is a full screen of empty circuit drawing between the facts and the
classification on 1,196 prerendered race pages — and every cold visitor reads
that page for ~12.5 s before the app replaces it.

At 320 px it reflows (it is a square), so this is not a hard 1.4.10 failure. It
is a screen-magnifier and low-vision problem: at 400 % zoom the outline is
roughly five screens of nothing, with `role="img"` and the label "Outline of
Bahrain International Circuit, F1DB layout bahrain-1" — a layout id, not a
description. **Do:** emit the `.with-outline` wrapper in the prerenderer. One
element. Visual design owns the aesthetic call; this is the parity bug under it.

### `AX-25` (new) — A heading is four facts and a link concatenated with no separator, nine times on one page — **1.3.1 (A), 2.4.6 (AA)** — **S**
*Evidence: drove `/circuits/monza`; read the DOM.*

`AX-11` was filed for this pattern in September and closed; it has come back on
the surface `AF-03` built. Observed, `/circuits/monza`, "How it changed":

```html
<h3>Road course<span class="years">1950–1954</span><span class="years">6.3 km</span><span class="years">drawn as monza-1</span><a class="pill pill-medium" title="Confidence tier &quot;medium&quot; …" href="/data/quality">medium</a></h3>
```

The computed heading text is **"Road course1950–19546.3 kmdrawn as monza-1medium"**.
Nine such headings on Monza, eight on Silverstone. Two problems in one element:

1. Inline spans with no whitespace or punctuation between them run together in
   the accessible name. `1950–19546.3` is not a string anyone can parse.
2. There is a **link inside the heading**, whose accessible name is the single
   word "medium", repeated nine times on the page, all pointing at
   `/data/quality`. 2.4.4 Link Purpose (In Context) survives on the heading
   context; nine identically-named links in a heading list is still the thing
   2.4.4 exists to prevent, and the explanation lives in a `title` attribute,
   which is mouse-only and fails 2.1.1 as a route to that information.

**Do:** separate the facts with " · " as text nodes (the caption elsewhere on the
site already does this), and take the confidence pill out of the heading and put
it in the card body beneath. **S.**

### `AX-26` (new) — Placeholder text is 3.93:1 in dark on the two busiest registers — **1.4.3 (AA)** — **XS**
*Evidence: measured `::placeholder` computed colour against the field background,
both themes, twelve routes.*

`/drivers` "A name…" and `/cars` "A chassis or a constructor…" render their
placeholder at the UA default `#757575` on `--panel` `#14161b`: **3.93:1** in
dark. Light is 4.61:1 and passes. Nothing in `app.css` styles `::placeholder`, so
this is the browser's default arriving on a surface the project chose.
Placeholder text is text and 1.4.3 reaches it. axe missed it because axe does not
evaluate pseudo-element colour.

It matters more here than usual: the register filter fields have **no visible
`<label>`** — the accessible name comes from `aria-label`, and the placeholder is
the only visible thing telling a sighted reader what the field is for. **Do:**
`input::placeholder { color: var(--ink-soft) }` — one rule, both themes. Adding
the visible `<label>` is the better fix and is `CD-17`'s neighbourhood.

### `AX-12` (existing, half) — The result rail is still an empty cell named "Result" on every row — **1.1.1 (A)** — **S**
The FL half has **landed and works**: `<span class="fl" aria-hidden="true">●</span><span class="sr-only">fastest lap</span>`,
in both renderers. Close that half.

The rail half has not. Chromium tree, `/races/2024/1`, rows 2 and 3:

```
row "" → cell "" | cell "2" | cell "Sergio Perez" | cell "Red Bull Racing" | … | cell ""
```

`<th scope="col"><span class="sr-only">Result</span></th>` over `<td class="rail"><i class="podium"></i></td>`,
twenty times on that page and on every classification and standings table on the
site. A column that introduces itself as "Result" and is then empty in every cell
is worse than an unnamed one: it promises information and delivers silence. The
information is already in the row as text ("Finished", the position), so
**`aria-hidden="true"` on the `<td>` and the `<th>`** is the right fix, not a new
`sr-only` string. Two attributes, both renderers. Re-size to XS.

### `AX-15` (existing) — `/` is a global single-key shortcut with no off switch — **2.1.4 (A)** — **XS**
Confirmed still firing with focus on a table-row link; correctly suppressed in
`textarea`. New evidence that lowers the cost of the fix to nil: **`⌘K` and
`Ctrl+K` both already open the palette**. Drop the bare `/` and the `<kbd>/</kbd>`
badge; modified shortcuts are exempt from 2.1.4 and nothing is lost. Re-size S → XS.

### `AX-16` (existing) — A three-line chart still ends with two labels — **1.4.1 (A)** — **S**
`/seasons/1976`: three series (Hunt, Lauda, Scheckter), strokes
`rgb(42,120,214)` / `rgb(235,104,52)` / `rgb(21,161,116)`, **no `stroke-dasharray`
on any of them**, and the SVG's last text nodes are `"69"`, `"49"` — two end
labels for three lines. Unchanged from 11 September.

It is now **worse on the page the maintainer most wants read.** `/now`'s 2026
chart has three series of which **two share one colour** — Antonelli and Russell
are both `rgb(15,153,145)`, distinguished only by `stroke-dasharray: 6 4` — and
again only two end labels, `"292"` and `"211"`. So on the current-season page one
of two same-coloured lines has no label and the only remaining channel is a dash
pattern read off a legend swatch. The legend swatch does carry the dash
(`i.livery-series.dashed`), which is the right half of the fix already built; the
missing half is applying a dash to a line **that loses its end label**, not only
to a line that shares a colour. Re-rank up: it now affects the current season.

### `AX-27` (new) — Two tables on `/records` share the caption "Counted from the race records", and it names neither — **1.3.1 (A), arguable; 2.4.6 (AA)** — **XS**
*Evidence: enumerated every `<caption>` on twenty-two routes.*

`AX-17` landed well — every table in both renderers now has a caption, and the
`sr-only`-caption-from-`Section` mechanism is sound. Two captions escaped the
quality of it. On `/records` the wins chart's table and the poles chart's table
are both captioned **"Counted from the race records"**; the constructors chart's
table is captioned **"Constructors"**. A caption is how a table introduces itself
when a reader jumps into it from a table list, and "Counted from the race records"
is a provenance note, not a name. **Do:** "The forty drivers with the most wins",
"The forty drivers with the most poles", "The thirty-four constructors with the
most wins". Three strings.

---

## Usability with assistive technology — no criterion fits, and I am raising it anyway

### `AX-28` (new) — At the handover, 712 rows are deleted from under the reader, and 7 of 8 sections appear out of nowhere
*Evidence: compared the prerendered DOM with the app DOM on six routes; measured.*

This is `IX-19` seen from this side, and it is larger than `IX-19` records.
Measured, static → app, same URL:

| route | static | app after handover |
|---|---|---|
| `/drivers` | 862 rows in one table | **150** rows + "Show the remaining 712" |
| `/constructors/ferrari` "Every win" | 251 rows | **100** rows |
| `/cars` chassis register | 1,153 rows | **150** rows |
| `/records` | **1** table, **zero** `<h2>` | **8** tables, 8 `<h2>` |
| `/drivers/hamilton` | "Wins" (106 rows) | "Every entry" (394 rows) — a different table |

For a screen-reader user the `/records` row is the sharp one: the prerendered page
is 11,047 characters under a single `<h1>` with no section headings at all — no
way to navigate it by heading — and then at ~12.5 s it becomes an eight-section
page, unannounced. For a reader at row 700 of `/drivers`, 712 rows vanish and the
document they were reading is gone.

`IX-19`'s proposed fix (seed `DataTable`'s visible count from the prerendered
table's `data-rows`) is right and I would ship it. The `/records` half needs
something different: the prerenderer should emit the section headings even where
it cannot emit the tables, or the page should not claim to be prerendered.

**Do:** `IX-19` as filed (M), plus one S for the `/records` heading gap. Raise
`IX-19` out of the middle of *Next*: it is an interaction-design item with an
accessibility severity the interaction critique could not see.

### `AX-29` (new) — Half the team-colour marks are invisible against their own surface, in each theme — and the decision that this is acceptable is correct
*Evidence: measured every `.livery` fill against its row background, both themes,
twelve routes; read `web/src/lib/liveries.js:25-55` and `web/test/conventions.mjs`.*

I examined this expecting a 1.4.11 finding and I am not filing one. Measured
fills against their surface:

| theme | below 3:1 | example |
|---|---|---|
| light | 6 of 14 sampled | papaya `#ff8000` **2.52**, Haas `#f4f4f4` **1.10**, Benetton green `#00e701` 1.69 |
| dark | 8 of 14 sampled | matte navy `#1c2648` **1.17**, Mercedes black `#111214` 1.04, Red Bull `#0f3fa8` 1.98 |

The recorded reason (`liveries.js:33`, maintainer's decision of 2026-09-14) is
that the mark is decorative because the team's name is always beside it, so 1.4.11
does not reach it. **I checked that claim rather than accepting it and it holds**:
the Chromium tree shows the mark as `generic ""` with no accessible name — the
`title` is *not* promoted, so it adds no verbosity either — and the constructor
name is a text link in the same cell on every surface I looked at. The compensating
`--livery-edge` ring (`app.css:2144`, a `color-mix` toward the theme's ink, held to
≥2:1 by `conventions.mjs`) is a real second channel. **Endorsed. Do not churn it,
and do not let a future audit re-file it** — but see the guard-rails below,
because the decision rests entirely on "the name is always beside it", and that
is a property of the current pages, not of the component.

Two consequences the decision does not cover, which are why this is here rather
than in *what is solid*:

1. The mark is **7 px wide**. At 1.10:1 or 1.17:1 it is not a weak signal, it is
   no signal. The engaging-visual work paid for a team-colour system that a
   low-vision reader receives as a row of grey ticks. That is a design failure
   rather than a conformance one, and worth knowing before more is built on it.
2. The **prerenderer draws no mark at all** on the race page (`static race livery:`
   returned nothing), while the app draws ten. `AF-59` records that the two
   renderers disagree about `aria-hidden`; they also disagree about whether the
   mark exists. Fold that observation into `AF-59`.

### `AX-21` (existing) — No table on the site has a row header
Re-confirmed on nine routes: every `<table>` has `<th scope="col">` and **zero**
`<tbody>` cells are `<th>`. Chromium tree for a classification row is ten `cell`
nodes and no `rowheader`. On a 394-race career table, reading down the "Result"
column in table-navigation mode gives 394 values with no way to ask which race
each belongs to. Unchanged, correctly filed, correctly sized S. This is still the
single largest improvement available to a screen-reader user on this site, and it
is sitting in the middle of *Next*.

### `AX-22` (existing) — Each car card is two adjacent links to one page
Re-confirmed on `/cars`: `/cars/alfa-158` appears twice in tab order, then
`/cars/ferrari-500` twice, and so on — 29 cards, 58 stops. The photograph link is
now named by the image `alt` (the car's name) rather than "no photograph matched",
so both links in each pair have the *same* name, which is an improvement on the
filed state and does not change the fix: `tabIndex={-1} aria-hidden="true"` on the
image link. Re-size S → XS.

### `AX-30` (new) — `IX-27`'s 632 px, confirmed, and what it costs this audience
*Evidence: measured `/drivers` at 390 × 844.*

Table 976 px inside a 344 px scroller: **632 px of every row is off screen**, the
figure `IX-27` gives. Two things `IX-27` does not say. First, the column the table
is **sorted by** — Wins, carrying `aria-sort="descending"` — is at x ≈ 610 and
therefore off screen, so the one column that explains the row order is the one a
phone reader cannot see. Second, for a screen-reader user this is a non-issue
(`<th scope="col">` is announced per cell), and for a keyboard user it is fine
(the scroller is reachable). It is a low-vision and cognitive-load problem
specifically. That should raise `IX-27`, not lower it — the audience it hurts is
the one with no workaround.

### `AX-31` (new) — A photograph's credit line is its file name, and that is the link text
*Evidence: drove `/seasons/1976` and `/constructors/ferrari`; read the rendered
`<figcaption>`.*

`CD-29` reports the file name as `alt`. That part is **fixed**: the `alt` is now
the car's name ("March 761", "Ferrari SF-26"). What `CD-29` does not cover is that
the file name has moved to the visible caption and is the **accessible name of a
link**:

```
March 761
StuckHansJ1976-07-31.jpg · Lothar Spurzem · CC BY-SA 2.0 de · unchecked
```

`StuckHansJ1976-07-31.jpg` is a link to Commons. Six of those per season page,
762 car pages. 2.4.4 survives on context; it is still a link named after a file
system. Two smaller things in the same block: the caption's first two parts run
together in the accessible name ("March 761StuckHansJ1976-07-31.jpg" — `AX-25`'s
pattern again), and the `alt` duplicates the caption's first line word for word,
so the photograph is named twice. **Do:** make the link text the Commons page
title or "on Wikimedia Commons", separate the caption parts, and consider
`alt=""` where the caption already carries the name. Fold into `CD-29` rather
than filing separately — it is one edit in `CommonsImage`/`commons.js`.

### One line each, not filed
- **The theme toggle is right.** Its accessible name states the *current* state
  ("System theme — click to change" → "Light theme — click to change"), so the
  change is discoverable on the button itself. No live region needed; leave it.
- **`aria-sort` is applied only to the sorted column**, which is the correct
  usage, and the `▼` glyph is `aria-hidden`. Nothing to do.
- **The `/reference/*` → `/data/*` redirect stubs** use `<meta http-equiv="refresh" content="0; …">`
  plus a real `<a>` in the body plus `rel=canonical`. That is the conforming
  pattern (2.2.1 exempts a zero delay) and it works with JavaScript off. Good.
- **`/data/sql` with JavaScript off** says "The console needs JavaScript: it runs
  SQLite compiled to WebAssembly against the database file in your own browser"
  and offers the download. That is how a no-JS fallback should read.
- **`IX-25` re-confirmed from this side:** `SELCT * FROM drivers` is answered by a
  `role="alert"` headed "SQLite refused that" and a paragraph about writes being
  rolled back. The alert mechanism is right; the *content* misdiagnoses a typo as
  a write attempt, and a screen-reader user gets the wrong instruction spoken with
  assertive priority. That raises `IX-25` above a cosmetic copy fix.

---

## Guard-rails for the "engaging, modern" work

The design critics are going to recommend motion, imagery and colour. These are
the conditions under which each can be built here without re-opening what has
already been fixed. They are cheap to hold to in advance and expensive to retrofit.

**Motion.** There is **no animation and no transition anywhere on the site today**
— I enumerated every element's computed `animation-name` and `transition-duration`
on the homepage under both `prefers-reduced-motion` settings and got zero in both.
So 2.3.3 Animation from Interactions is currently satisfied vacuously, and there
is no `@media (prefers-reduced-motion: reduce)` block to inherit. **Before the
first transition ships**, put the reduce block in `app.css` as a blanket
`animation: none; transition: none` and let components opt back in. Otherwise the
first animation is also the first `prefers-reduced-motion` bug, and there will be
no pattern to copy. 2.2.2 Pause, Stop, Hide bites anything that moves for more
than five seconds or auto-advances — a hero carousel of Commons photographs is the
obvious candidate and would need a pause control.

**Colour.** The machinery to do this right already exists and is machine-checked:
`liveries.js` holds a `light`/`dark` pair per constructor, `conventions.mjs:711`
holds each to 3:1 against the surfaces it lands on, and `conventions.mjs:776`
holds the mark's edge to 2:1. Two rules follow.
*(a)* **A colour may only carry information alone if it wears the tested pair.**
Today only a chart series does, and the file says so. If `AF-49` replaces the
result rail with a team-colour rail, the team's name must remain as text in the
same row — it currently is, so `AF-49` is safe as written, but the constraint
should be written into the item rather than left to be rediscovered.
*(b)* **Nothing may dim a tested value after the test.** `AX-23` is what that
looks like: a 3:1 floor checked in `conventions.mjs` and halved by `opacity: 0.5`
in `app.css`. Extend the check to the composited value.

**Imagery.** The Commons photographs are the biggest new visual surface and their
`alt` is now correct. Two conditions for expanding them: the credit link must stop
being a file name (`AX-31`), and a photograph must never become the only route to
a fact — the `canShow()` fail-closed rule means a page can legitimately render
with no image at all, so anything that depends on one will be empty for some
readers on some rows. I saw exactly that behaviour and it behaved well.

**Density.** Do **not** add padding to table rows for accessibility reasons. I
re-ran the 2.5.8 Target Size analysis on `/races/2024/1` at 390 × 844: 164 of the
targets are under 24 px and, after applying the spacing exception correctly (a
24 px circle per undersized target, tested against every other target), **zero
fail**. There is no requirement to meet here and a design critic asking for
bigger rows should be asked for a different reason.

---

## Could this site publish an accessibility statement today?

**Yes, and it should — but it cannot claim WCAG 2.2 AA conformance.** An
institutional or paying customer will ask for one, and a truthful partial
statement is a stronger commercial asset than silence, because it demonstrates
the thing this project already sells: that it measures itself and publishes what
it finds. That is the same instinct as `discrepancies` and `known_gaps`, applied
to the interface.

What it would honestly have to say today:

> Lap Ledger targets WCAG 2.2 Level AA and is **partially conformant**. Known
> failures, all recorded publicly as issues:
> - **1.4.10 Reflow** — five routes scroll the page body horizontally at 320 px
>   in the interactive application; the static version of each is unaffected.
> - **1.4.3 Contrast (Minimum)** — the SQL console's Run button in the dark
>   theme (3.33:1) and the register filter placeholders in the dark theme (3.93:1).
> - **1.4.11 Non-text Contrast** — the ring marking a championship-winning season
>   on driver charts (1.7–3.0:1).
> - **4.1.2 Name, Role, Value** and **2.4.3 Focus Order** — the search palette
>   declares itself modal but does not contain focus, is not exposed as a
>   combobox, and returns focus to the document body when closed.
> - **2.1.4 Character Key Shortcuts** — `/` opens search with no way to turn it off.
> - **1.1.1 Non-text Content** — a colour-coded result column is announced as
>   "Result" and is empty in every cell.
> - **4.1.3 Status Messages** — when the database finishes loading, the page is
>   rewritten with no announcement and focus is not moved.
> - **1.4.1 Use of Colour** — on a three-series chart, one line can lose its
>   direct label and be identifiable only by its colour.
>
> Not tested: real screen readers (NVDA, JAWS, VoiceOver), voice control, switch
> access, mobile assistive technology. Automated testing is axe-core over 22
> routes in both themes on every build.

Three things would make that statement short enough to be an asset rather than a
liability, and all three are in the top ten below: `AX-10` (one word), `AX-06`
and `AX-26` (two CSS declarations), `AX-23` (one declaration). Those four remove
half the list for roughly an afternoon. `AX-02` is the one that needs a real
sitting.

I would also put the automated run in CI. `web/test/conventions.mjs` already
demonstrates the pattern — a contrast rule the build refuses to violate — and an
axe pass over a dozen routes as part of `npm test` would have caught `AX-26`
(no: axe misses pseudo-elements) but would catch `AX-06` and any regression of
`AX-05`. Given `[D-09]`'s rule about build steps whose execution you cannot
establish, it belongs in `npm test`, not the deploy chain.

---

## What is genuinely good — do not churn these

- **The failure path is excellent.** With the database request aborted, the
  prerendered content is **kept** rather than replaced, and a `role="status"`
  carries: *"The database could not be opened. The figures on this page are from
  the last published build."* with a "Try again" button. That is the correct
  design decision, correctly announced, and it is better than most commercial
  sites manage. Nothing to change.
- **Focus on in-app navigation is fixed and works.** `AX-03`'s first half has
  landed: click a link, focus lands on the new `<h1>`; open a search result, same.
  `Page.jsx:161` and `main.jsx:25` document why. Keep.
- **The skip link landed and is correct** (`AX-20`), and the comment at
  `App.jsx:266` gets the reasoning right — landmarks already satisfied 2.4.1 and
  the link is for keyboard users without a screen reader. `scroll-padding-top: 72px`
  is set, and I could not produce a single focus stop obscured by the sticky
  masthead in ten reverse-tab presses (`AX-08`, landed and working).
- **Captions landed everywhere**, in both renderers, on every table I found
  (`AX-17`). Two of them are poorly worded (`AX-27`); the mechanism is right.
- **The dead sticky-header rule was deleted rather than patched** (`AX-18`):
  `thead th` is now `position: relative`. That was the right of the two options.
- **`--ink-faint` is comprehensively fixed** (`AX-05`). Zero contrast violations
  in the light theme across 22 routes, and one in dark. That was 158 nodes.
- **The `Figure` discipline holds on every chart.** Eleven `role="img"` graphics,
  each with a descriptive sentence as its label ("Percentage of races each season
  won from pole position, 1950 to 2026") and each with a reachable `<details>`
  table of its own numbers. The atlas was cut, so the one exception is gone.
- **The chart palette is measured, not asserted.** Series strokes clear 3:1 on
  their surfaces in both themes (light 3.20–4.42, dark 3.69–5.66), and
  `conventions.mjs` enforces it. The `AX-23` opacity bug is a bypass of a good
  system, not the absence of one.
- **Target size passes**, with the spacing exception applied properly. Confirmed
  independently of the September run.
- **1.4.4 Resize Text at 200 %** is clean on all 17 routes tested: zero
  horizontal page scroll, no clipping. So is `forced-colors: active` on the race
  and season pages — the outline SVG uses `stroke="currentColor"` and survives,
  the layout holds, photographs render.
- **`lang="en"` and one `<h1>` on every route in both renderers**, and every
  static page has a distinct, descriptive `<title>`.
- **The FL bullet fix** (`<span aria-hidden>●</span><span class="sr-only">fastest lap</span>`)
  is exactly right and is implemented identically in both renderers.
- **`role="alert"` on query failure**, and the refusal copy that tells a person
  nothing has changed.

---

## What I did not examine

- **A real screen reader.** Everything here is the Chromium accessibility tree and
  observed focus. Three findings would be sharpened by an hour with NVDA:
  `AX-29`'s claim that the `title` on `.livery` is not announced (Chromium does
  not promote it; JAWS' behaviour with `title` on a nameless generic differs),
  `AX-28`'s account of what the row deletion feels like, and whether the boot
  `role="status"` fires early enough to be heard.
- **Voice control and switch access.** `AX-15` anticipates a speech-input user
  and is inference about the mechanism.
- **Mobile assistive technology.** No TalkBack or iOS VoiceOver. The search
  palette is the surface most likely to differ.
- **`/reference/eras`, `/reference/glossary`, `/records`' authored prose, `/changes`
  and `NotFound`** got an axe pass and a structural read but no keyboard walk.
- **The 2,300 routes I did not open.** Twenty-two in the app, seventeen static.
  Every page *type* is covered; individual outliers are not — in particular I
  checked one race with a photograph strip and one without, and one circuit with
  nine layouts.
- **Cognitive accessibility beyond structure.** The conventions a reader meets
  cold (an em dash meaning "not established", a repeated finishing position
  meaning a shared drive) are a content-design question and I left them there.
- **3.1.2 Language of Parts.** `lang="en"` is correct and survives the handover;
  I did not read 552 prose fields for embedded foreign-language passages.

---

## Backlog verdicts

Every open issue in my prefix, plus the four assigned to me, re-tested against
`dda5afb`.

| ID | # | Verdict | Why |
|---|---|---|---|
| `AX-02` search palette | 226 | **keep — move to *Now*, below `AX-06`** | Reproduces in full on the live site, including Escape → `body` from the button entry point. The only Level A failure on the primary navigation control; size M is right, the three S pieces are right. Add the new observation that `⌘K`/`Ctrl+K` already exist. |
| `AX-06` Run button 3.33:1 | 134 | **keep — *Now*, as ranked** | Unchanged, re-measured 3.33:1. The only axe violation across 44 runs. |
| `AX-10` reflow at 320 px | 228 | **keep — re-size S → XS, re-rank to head of *Now*; rewrite the body** | Five routes, not three, and none of the three it names. One word in `app.css:491` (`1fr` → `minmax(0, 1fr)`) clears all five — measured in the browser. |
| `AX-12` FL bullet + result rail | 229 | **re-scope and re-size S → XS** | The FL half **landed and works** in both renderers; close it in the body. The rail half stands and the fix is simpler than filed: `aria-hidden="true"` on the `<td>` and `<th>`, not a new `sr-only` string. |
| `AX-15` bare `/` | 230 | **keep — re-size S → XS** | Confirmed. New evidence: `⌘K` and `Ctrl+K` both work, so removing `/` costs nothing. |
| `AX-16` dropped end label | 231 | **keep — re-rank up within *Next*** | Reproduces on `/seasons/1976`, and now on `/now` where two of three series share one colour. The legend already carries a dash; the missing half is dashing a line that loses its label. |
| `AX-21` no row headers | 236 | **keep — re-rank to top of *Next*** | Confirmed: zero `<tbody> <th>` anywhere. Largest single screen-reader improvement available, sized correctly at S, ranked too low. |
| `AX-22` two links per car card | 237 | **keep — re-size S → XS** | Confirmed, 29 cards / 58 stops. Both links now share the same name, which is an improvement and does not change the fix. |
| `AX-23` P1 halo under 3:1 | 416 | **keep — re-rank to *Now*, beside `AX-06`** | Worse than filed: 1.72–2.99:1 across five drivers and both themes, not 2.33/2.69. And the cause is a machine-checked 3:1 floor (`conventions.mjs:711`) defeated by `opacity: 0.5` one file over — the only place in this project where a guard is bypassed downstream of itself. |
| `AF-59` livery mark `aria-hidden` disagreement | 399 | **keep — S, widen the body** | The disagreement is real and larger than recorded: on `/races/2024/1` the prerenderer draws **no mark at all** while the app draws ten. Low severity (the mark has no accessible name in either renderer — verified in the Chromium tree), but it should be settled once, with the answer `aria-hidden="true"` in both. |
| `CD-29` photograph alt is a file name | 403 | **partly fixed — re-scope, keep at S in *Now*** | The `alt` is now the car's name on every surface I checked. The file name has **moved to the visible caption and is the link text** for the Commons link — six per season page, 762 car pages. Rewrite the body around the link text and the two-run-together caption parts; that is one edit in `commons.js`/`CommonsImage`. |
| `IX-27` 632 px off screen | 137 | **keep — re-rank up within *Next*** | Confirmed at exactly 632 px. Add that the sorted column (`aria-sort="descending"`) is one of the hidden ones, and that the affected audience is low-vision/cognitive with no workaround, not keyboard or screen-reader users. |
| `IX-19` handover deletes rows | 142 | **keep — re-rank up, and add an S sibling** | Confirmed and broader than filed: `/drivers` 862 → 150, `/cars` 1,153 → 150, `/constructors/ferrari` 251 → 100, and `/records` goes from **one** table and **zero** `<h2>` to eight of each. The filed fix (seed from `data-rows`) handles the tables; `/records`' missing prerendered sections is a separate S. |

**New, from this run** — `AX-24` (prerendered outline at 1,236 px, S),
`AX-25` (concatenated layout heading with a link inside it, S), `AX-26`
(dark placeholder 3.93:1, XS), `AX-27` (two identical captions on `/records`, XS),
`AX-28` (the handover's content gap — merge into `IX-19` plus an S for `/records`),
`AX-29` (team-mark contrast: **closed decision endorsed**, filed only as the
guard-rails above), `AX-30` (fold into `IX-27`), `AX-31` (fold into `CD-29`).
Net new issues to file: **four** — `AX-24`, `AX-25`, `AX-26`, `AX-27`.

---

## Top ten for the whole project, from this discipline

Ranked by how much access is bought per hour, given the stated goals: a public
tool anyone can use, eventually commercial, eventually flashier.

| # | Item | Size | New? | Why this rank |
|---|---|---|---|---|
| 1 | `AX-10` — `minmax(0, 1fr)` on the narrow `.split` rule | XS | existing, re-scoped | One word removes the site's entire 1.4.10 exposure, on five routes including `/now`. Measured. Nothing else on this list has that ratio. |
| 2 | `AX-06` + `AX-26` — the Run button and the dark placeholder | XS | 1 new | Two CSS declarations. `AX-06` alone takes the site to **zero** axe violations across 44 runs; `AX-26` removes the only 1.4.3 failure a scanner cannot see. Two lines off any conformance statement. |
| 3 | `AX-23` — drop `opacity: 0.5`, mix the halo colour instead, extend the check | S | existing, worse than filed | The only place a machine-checked guard is bypassed. Fixing the value and the check together stops the class, not the instance. |
| 4 | `AX-02` — the search palette, three S pieces | M | existing | The one Level A failure on the primary navigation control for 3,519 entities, and the piece of the September audit that has not moved. Do the containment/restoration piece first; it is fifteen lines. |
| 5 | `AX-01` piece 3 — announce and focus the handover | S | existing, part | Every cold arrival on 2,385 pages passes through this. The router already does it correctly on a click; this is making one more transition use the same code. |
| 6 | `AX-21` — a `rowHeader` flag on `DataTable`'s column spec | S | existing | One component change, one prop per call site, and it is the largest improvement available to a screen-reader user reading a 394-race career table. |
| 7 | `AX-12` (rail half) + `AX-15` + `AX-22` + `AX-27` — four XS in one sitting | XS ×4 | 1 new | Two attributes, one deleted key handler, two attributes, three strings. An afternoon clears four items and two conformance lines. |
| 8 | An axe-core pass in `npm test`, over a dozen routes in both themes | S | new | The project's instinct is a check the build refuses to violate; `conventions.mjs` already does this for colour. This is the same idea for the mechanical layer, and it is what makes an accessibility statement maintainable rather than a snapshot. Belongs in `npm test`, not the deploy `[D-09]`. |
| 9 | `IX-19` + the `/records` prerender gap | M + S | existing + new | The handover deleting 712 rows and seven of eight sections is the largest divergence between what a cold reader starts reading and what they end up with. |
| 10 | Publish the partial accessibility statement | S | new | It is honest today, it is the same instinct as `discrepancies` and `known_gaps`, and a paying or institutional customer will ask for it. Writing it also fixes the ranking of everything above by making the list public. |

`AX-16` (the dropped end label) and `AX-24`/`AX-25` (the prerendered outline and
the concatenated heading) are the next three; I left them off only because the ten
above each buy more per hour.
