# Accessibility critique — 2026-09-11

**Critic:** `accessibility-critic` (`.claude/agents/`), first run.
**Subject:** the built site at v2.21, commit `c4026ca` on `main`, served at `localhost:4180` (`vite preview` of `web/dist`), plus the prerendered HTML at the same routes.
**Brief:** `.claude/CRITIQUE-BRIEF.md`.
**Prior:** `docs/critiques/` (four files) and `docs/BACKLOG.md` at 8 landed items. `CD-10`, `IA-14`, `PD-22` and the chart/table discipline are cited where I add to them and not re-filed.

**I drove a browser.** Playwright's Chromium, against the served build, at 1280×900, 1100×700, 390×844, 320×720 and 320×256; in light and dark; with `prefers-reduced-motion: reduce` and without; with the app bundle blocked to read the static half; and with CDP network throttling at 4 Mbps and 1.5 Mbps to see the cold load. Everything below was observed unless labelled otherwise.

**I did not run a screen reader.** No NVDA, JAWS, VoiceOver or Orca was available here. Where I describe what assistive technology receives, the observation is **Chromium's accessibility tree, read over CDP** (`Accessibility.getFullAXTree`) — the same tree a Windows or macOS screen reader consumes, but not the reader itself. Announcement *order* and *verbosity* vary by product, and I flag the two places where that matters. Nothing below says "a screen reader would say"; it says what the tree contains and what focus does.

**Automated pass.** axe-core 4.13.0, rule set `wcag2a + wcag2aa + wcag21a + wcag21aa + wcag22aa` — **63 rules applied across 12 routes**. Result: **one rule violated, `color-contrast`, 158 nodes**; 325 rule-passes; 272 "incomplete" which on inspection are all `nonBmp` (the `⌕` and `▲` decorative glyphs, correctly `aria-hidden`) and are noise. Zero violations of `aria-*`, `label`, `region`, `heading-order`, `image-alt`, `link-name`, `button-name`, `list`, `td-headers-attr`, `frame-title`, `html-has-lang`, `duplicate-id`. **The mechanical layer is genuinely clean**, and almost everything that follows is something a scanner cannot see.

**Re-checked by the author before filing:** `aria-modal="true"` at `Search.jsx:139`; the progressbar at `Boot.jsx:66` carries `aria-valuenow` and nothing else; no `scroll-padding` anywhere in `app.css`; the bullet at `Race.jsx:338`; `--ink-faint: #6d7480` in the light block of `tokens.css`; the bare `/` shortcut at `App.jsx:131`. One nuance on `AX-04`: `role="status"` does appear in the source — on the three chart tooltips and on `States.jsx:27`'s loading state — but each renders conditionally, so the critic's count of zero live regions is a count of the DOM at rest and stands. The axe run, the contrast ratios and the throttled timings were not re-run.

**Findings are filed as `AX-01` onward.** Each is marked **WCAG failure** (with the criterion) or **usability beyond WCAG**, and sized S / M / L / ?.

---

## The three that matter

### 1. For the first 11.5 seconds of every cold visit the document has two `<h1>`s, and then it is replaced with nothing announced and focus on `<body>` (`AX-01`)

`index.html:60-61` puts `#prerendered` before `#root`, and React mounts `Boot` into `#root` immediately. So during the download the document contains the whole real page *and*, 6,151 px below it, a second `<h1>` cycling "Starting up" → "Checking for a newer build" → "Downloading the database" → "Starting SQLite". Measured on `/drivers/hamilton` at 4 Mbps: **two `h1`s for 10,885 ms of an 11,495 ms load**. Throughout, `document.querySelectorAll('[aria-live],[role=status],[role=alert]').length === 0` — nothing on the page is a live region. The `role="progressbar"` at `Boot.jsx:66` has `aria-valuenow` and **no accessible name, no `aria-valuemin`/`max`, no `aria-valuetext`, no text content**. Then `main.jsx:22` deletes `#prerendered`, the outline and the page title change (on `/seasons/1976`, from "1976 FIA Formula One World Championship" to "1976"), and focus is at `document.body`.

Sighted readers get the graceful upgrade this was designed for. Everyone else gets a document that is silently rewritten under them.

### 2. The search palette says `aria-modal="true"` and is not one, and its keyboard state exists only in CSS (`AX-02`)

`Search.jsx:139`. Shift+Tab from the input lands on the footer's "sources page" link — content the `aria-modal` has told assistive technology does not exist. Observed. The result list is a plain `<ul>` of links: no `role="listbox"`, no `option`, no `aria-activedescendant`, no `aria-expanded`. Arrow keys move a `data-active` attribute that drives a CSS rule and nothing else, so the highlight a sighted user steers by is invisible in the accessibility tree. Escape returns focus to `document.body`, not to the control that opened it — including when the Search button opened it. This is the site's primary wayfinding tool for 3,494 entities.

### 3. `--ink-faint` fails 4.5:1 on three of the four light surfaces it is used on, and the token file's comment measured it against the fourth (`AX-05`)

`tokens.css` states "light … faint 4.7:1". That is `#6d7480` on `--panel` (`#ffffff`) and it is correct. But `--ink-faint` is what carries the wordmark tagline, every `thead` label, `.eyebrow`, `.crumb`, `.result-count`, `.count`, `.source-note`, `.faint` and the footer `<dt>`s — and those sit on `--bg` (**4.28:1**), `--panel-sunk` (**4.05:1**) and `--stage` (**4.43:1**). axe found 158 nodes across 12 routes; every one of them is this token. Dark is fine (4.80–5.15). One token, four surfaces, the whole automated finding.

---

## Conformance findings

### `AX-01` — The cold load and the handover are unannounced; the progress bar has no name — **WCAG failure: 4.1.2 Name, Role, Value (A); 4.1.3 Status Messages (AA)** — **M, in three S pieces**

*Evidence: drove the site, throttled to 4 Mbps and 1.5 Mbps; read the source.*

Measured on `/drivers/hamilton`, 4 Mbps / 70 ms RTT, cold context:

| t | `<h1>`s in the document | live regions |
|---|---|---|
| 100 ms | `["Sir Lewis Hamilton"]` | 0 |
| 610 ms | `["Sir Lewis Hamilton", "Checking for a newer build"]` | 0 |
| 865 ms | `["Sir Lewis Hamilton", "Downloading the database"]` | 0 |
| 9,971 ms | `["Sir Lewis Hamilton", "Starting SQLite"]` | 0 |
| 11,495 ms | `["Sir Lewis Hamilton"]` — `#prerendered` removed, app rendered, focus on `<body>` | 0 |

Three separate defects, each independently shippable:

1. **The progress bar is unnamed.** `Boot.jsx:66` renders `role="progressbar" aria-valuenow={…}` and the observed node has `aria-label: null`, `aria-labelledby: null`, `aria-valuemin: null`, `aria-valuemax: null`, `textContent: ""`. A progressbar whose value is "30" and whose name is nothing is a number with no referent. **Do:** `aria-labelledby` the boot `<h1>`, plus `aria-valuemin="0" aria-valuemax="100"` and `aria-valuetext={"1.3 MB of 4.5 MB"}` — the string `Boot.jsx:73-77` already composes. **S.**
2. **The four phase words are status messages with no live region.** `WORDS` changes three times across 11 s and nothing announces it. Wrapping the boot `<h1>` and `.boot-detail` in a single `role="status"` is the fix; it must be one region, present from first render, or the first message is missed. **S.**
3. **The handover destroys the document and moves focus nowhere.** `main.jsx:22` removes `#prerendered` once `ready`. Focus is at `<body>`; the outline, the title and the heading text all change. **Do:** on the `ready` transition, move focus to the app's `<h1>` with `tabIndex={-1}` and announce the swap once in a polite region ("The database is open; this page now answers from it"). Keep the removal — it is right — but make it an event rather than a disappearance. **S.**

*Two h1s is a symptom, not the defect;* it goes away once the boot screen stops being a second page. But if you fix nothing else here, `aria-hidden="true"` on `.boot` while `#prerendered` is still present costs one attribute and removes the duplicate document.

**Escalation, not a re-file:** `PD-22` is about the atlas having no prerendered content; this is about every page having two. And `IA-04` is **landed and works** — `document.title` is now correct after in-app navigation, confirmed ("Adrian Sutil — Lap Ledger" after clicking through from `/drivers`). But the entry claims the fix reaches "the screen reader's announcement", and it does not: a `document.title` assignment without a page load is not announced by NVDA or JAWS. The tab, the bookmark and the history entry are fixed; the announcement needs `AX-03`.

### `AX-02` — The search palette: a modal that is not modal, and a listbox that is not a listbox — **WCAG failure: 4.1.2 (A), 2.4.3 Focus Order (A), 4.1.3 (AA)** — **M, in three S pieces**

*Evidence: drove the site with the keyboard; read the Chromium accessibility tree; read `Search.jsx`.*

Observed tree for the open palette, with "hill" typed:

```
dialog "Search the database"
  textbox "A driver, a team, a circuit, a car, a season, a race…"
  list ""
    listitem "" level=1
      link "CONSTRUCTOR Hill United Kingdom · 1975"
    …
```

- `aria-activedescendant: null`, `aria-expanded: null`, `aria-autocomplete: null`, `ul role: null`, active item marked only by `data-active="true"`.
- **Shift+Tab from the input leaves the dialog**, in three presses: "sources page", "OpenStreetMap contributors", "F1DB" — all footer links behind the backdrop. `aria-modal="true"` (`Search.jsx:139`) asserts the opposite. This is the brief's "`aria-*` contradicting the element it sits on", and it is worse than having neither: a screen-reader user is now reading content their software reports as absent, and a sighted keyboard user is focused on something the backdrop covers.
- Forward Tab stays inside (the palette is last in DOM order), so the trap risk is nil — but that is an accident of DOM position, not containment.
- **Escape puts focus on `document.body`**, from both entry points (`/` and the Search button). The keyboard user is returned to the top of a 186-tab-stop document.
- The result list appears with no announcement of how many results there are.

**Do,** in three sittings:

1. `role="combobox"` + `aria-expanded` on the input, `role="listbox"` on `#palette-results`, `role="option"` + `aria-selected` on each row, and `aria-activedescendant` on the input pointing at the active option's id. The visual `data-active` rule can stay as it is. **S.**
2. Containment and restoration: remember `document.activeElement` when `open` flips true, cycle Tab within `.palette`, and restore focus in the `onClose` path. About fifteen lines. **S.**
3. `role="status"` carrying "12 results" — throttled, or it will fire on every keystroke. The existing `.hint` paragraph is the natural home. **S.**

### `AX-03` — Focus is dropped to `<body>` on every in-app navigation and on "Show the remaining *N*" — **WCAG failure: 2.4.3 Focus Order (A)** — **S**

*Evidence: drove the site with the keyboard.*

Two observations:

- `/drivers` → focus "Adrian Sutil" → Enter. Afterwards: `document.activeElement === document.body`, `document.title === "Adrian Sutil — Lap Ledger"`, `h1 === "Adrian Sutil"`, live regions: none. `App.jsx:74` scrolls to the top, which is right, and nothing touches focus. The next Tab starts at the wordmark. On a site where the intended journey is driver → team → car → race, every hop costs eleven tab stops.
- `/drivers`, "Show the remaining 712" (`DataTable.jsx:184`) → Enter. 712 rows are inserted, the button unmounts, `activeElement === document.body`, `scrollY` stays at 5,703. The reader is visually mid-table and programmatically at the start of the document, with no notice that 712 rows arrived.

**Do:** in `Page` (`Page.jsx:63`), give the `<h1>` `tabIndex={-1}` and focus it on `pathname` change — the same hook `useDocumentName` already runs on, so it costs one line and cannot drift from the title. For the table, keep focus by rendering the button as disabled-and-then-removed on the next frame, or simpler: replace it with a `role="status"` line reading "Showing all 862" and move focus to it. Both are S; do the navigation one first, it is worth more.

### `AX-04` — Nothing the reader causes to happen is announced, anywhere except a query error — **WCAG failure: 4.1.3 Status Messages (AA)** — **M, but each surface is S**

*Evidence: drove the site; enumerated every live region on twelve routes.*

Across twelve routes, `[aria-live], [role=status], [role=alert]` returns **zero nodes** on eleven of them. The twelfth is `/circuits/atlas`, whose `<output>` (`Atlas.jsx:209`) is an implicit `status live=polite` — and that one works (see *what is solid*). Observed consequences:

| Surface | What changes | What is announced |
|---|---|---|
| Register filter (`Filters.jsx:16`) | "862 drivers" → "0 of 862 drivers", 150 rows → 0 | nothing |
| Column sort (`DataTable.jsx:132`) | row order; `aria-sort` flips | nothing beyond `aria-sort`, which most readers speak only on re-entry |
| SQL console success (`Sql.jsx:179`) | "15 rows in 6 ms" → "3 rows in 40 ms", table replaced | **nothing**; focus stays in the textarea |
| SQL console failure (`States.jsx:33`) | error panel | **`role="alert"` — correct** |
| Atlas wall selection (`Atlas.jsx`) | the stage 726 px above, 12 fields, the drawing | `aria-pressed`, and "0 m of 4,458" — not the circuit's name |
| "Show the remaining *N*" | 712 rows | nothing |

The SQL console is the sharp case. A blind user presses ⌘/Ctrl+Enter; a bad query announces itself, a good one does not. **Success is the silent outcome and failure is the loud one** — exactly backwards. `Sql.jsx:179` needs `role="status"` on `.result-count` and a phrase a person can act on ("3 rows, 40 ms") rather than a fragment.

**Do:** `role="status"` on `.result-count` in `Filters.jsx:16` and `Sql.jsx:179` — two attributes, and they cover the two densest surfaces. That is the S piece worth shipping alone. Sort and the atlas selection can follow.

*One caveat on my evidence:* whether a given reader speaks an `aria-sort` change in place is product-dependent; I am reporting the absence of a status region, which is not.

### `AX-05` — `--ink-faint` fails 4.5:1 on `--bg`, `--panel-sunk` and `--stage` — **WCAG failure: 1.4.3 Contrast (Minimum) (AA)** — **S**

*Evidence: axe-core `color-contrast`, 158 nodes over 12 routes; ratios recomputed from `tokens.css` independently.*

| `--ink-faint` `#6d7480` on | ratio | verdict |
|---|---|---|
| `--panel` `#ffffff` | 4.71 | passes — and this is the figure the token comment records |
| `--stage` `#f7f8fa` | 4.43 | fails |
| `--bg` `#f3f4f6` | 4.28 | fails |
| `--panel-sunk` `#eceef2` | 4.05 | fails |

Sample nodes: `.eyebrow` "Round 1 of 2024" (4.27), `.result-count` "862 drivers" (4.27), `.source-note` on the atlas (4.27), the footer's four `<dt>`s (4.05), the wordmark's "1950–2026 · every championship race" (4.27), and an atlas cell's "6.995 km" on `--accent-wash` (4.18). Dark theme is clean.

**Do:** darken `--ink-faint` in the light block until it clears 4.5:1 against `--panel-sunk`, the worst case — `#666d78` gives 4.52 there and 4.77 on `--bg`. Then change the comment in `tokens.css` to state the surface each figure was measured against, because that omission is what let this ship. This is the whole automated finding and it is one line.

*Not filed, but worth a look while in there:* `thead th` is `--ink-faint` at **9.5 px**, uppercase, 0.16em tracking, on `--panel` — 4.71:1, so it conforms, and it is the smallest text on the site by 2.5 px.

### `AX-06` — Dark theme: white on `--accent` is 3.34:1 on the primary button — **WCAG failure: 1.4.3 (AA)** — **S**

*Evidence: axe-core, `/reference/sql` in dark; recomputed.*

`#ffffff` on `#ff4757` = **3.34:1**. This is `.button`, which is the SQL console's **Run** control and every primary `Actions` link. Light theme is 5.90:1 and fine. The dark accent was chosen as a mark colour (5.42:1 against `--panel`, and the token file's stated 5.4 is correct) and then reused as a *fill under white text*, which is a different calculation.

**Do:** give `.button` a dark foreground in the dark block (`color: var(--ink-invert)` → `#0c0d10` on `#ff4757` = 6.1:1), or darken the button fill specifically to `--accent-ink`'s light-mode role. One rule. Note that the only other dark-mode contrast violation on the whole site is this same button.

### `AX-07` — The atlas's colour ramp and one light-theme chart series are below 3:1 against their own background — **WCAG failure: 1.4.11 Non-text Contrast (AA)** — **S each**

*Evidence: recomputed from `tokens.css`; confirmed visually at 1100×700 in light.*

Two graphics, both carrying meaning that nothing else carries:

**The atlas corner-radius ramp**, light theme, against `--stage` `#f7f8fa`:

| band | token | vs stage | vs the next band |
|---|---|---|---|
| straight | `--seq-1` `#86b6ef` | **1.99** | 1.42 |
| fast | `--seq-2` `#5598e7` | **2.81** | 1.48 |
| medium | `--seq-3` `#2a78d6` | 4.16 | 1.84 |
| slow | `--seq-4` `#184f95` | 7.63 | 1.47 |
| hairpin | `--seq-5` `#0d366b` | 11.25 | — |

Two of five bands are under 3:1 against the surface they are drawn on, and **no two adjacent bands are separated by 2:1**. The screenshot bears this out: at Spa the straights are a wash that barely reads as a line. Dark is better but `--seq-1` is still 2.83.

**The light-theme chart series**, against `--stage`: `--series-1` 4.16, `--series-2` **3.01**, `--series-3` **2.65**. The token file already concedes this — *"the relief the light-mode palette's sub-3:1 aqua requires"* — and answers it with the numbers table. **Engaging with that reason:** the table is a real and good mitigation for *getting the value*, and it is not a defence under 1.4.11, which asks whether the graphic itself is perceivable. It is also not a defence for the reader who can see the chart perfectly well and simply cannot separate the green line from the paper.

**Do:** two independent S changes. (a) Compress the sequential ramp's light end — start at the equivalent of step 400 rather than 250; the ramp already reverses direction for dark, so a per-theme start value is an established pattern here. (b) Darken `--series-3` in light until it clears 3:1 (`#178a60` gives 3.6). The categorical palette's *identity* claim is unaffected; only its lightness moves.

*The international-racing-colour rule is not in scope here and I am not touching it* — nothing in this finding concerns constructor colour. It is the two derived ramps, both of which are the project's own choices.

### `AX-08` — Tabbing backwards puts the focused link completely behind the sticky masthead — **WCAG failure: 2.4.11 Focus Not Obscured (Minimum) (AA, new in 2.2)** — **S**

*Evidence: drove the site; screenshot at `/private/tmp/claude-503/-Users-alex-Lap-Ledger/28c9ec9a-95c5-4830-8278-35d180cff409/scratchpad/shots/obscured-focus.png`.*

`app.css:135` makes `.masthead` sticky to a height of 63 px. Nothing sets `scroll-padding-top` (measured: `auto` on both `html` and `body`). Reproduced on `/drivers`: focus a row link near the top of the viewport, Shift+Tab twice —

```
shift-tab 1: "Bill Holland"     top=31  bottom=47  mastheadBottom=63   partly hidden
shift-tab 2: "Bill Cheesbourg"  top=0   bottom=21  mastheadBottom=63   ENTIRELY hidden
```

2.4.11 (Minimum) is failed when the focused item is *entirely* hidden. This is one of them, and it happens every time a keyboard user reverses direction anywhere on the site.

**Do:** `html { scroll-padding-top: 72px }`. One line, no other effect.

### `AX-09` — The atlas is the one interactive graphic with no text equivalent — **WCAG failure: 1.1.1 Non-text Content (A)** — **M**

*Evidence: drove the site; read the accessibility tree; read `Atlas.jsx`.*

Every chart on this site carries a `<details>` table of its own numbers — `Figure.jsx` enforces it, and the comment there ("THE TABLE IS NOT A FALLBACK") is the best single piece of accessibility reasoning in the repository. The atlas has no such thing. Observed tree for the stage drawing:

```
image "Traced centreline of Circuit de Spa-Francorchamps, 6.9947 km over 359 points"
```

That is the whole alternative. The page's stated purpose is *"colour the line by how hard it turns"*, and the corner-radius banding — which run of the lap is hairpin, which is straight — exists nowhere but as stroke colour. The legend (`.radius-key`) is exposed correctly as a `DescriptionList` with real names and metre ranges, so a reader learns the *scheme* and can never apply it.

Unlike the four charts, this is also the page type `PD-22` found has no prerendered content at all, so the no-JS and pre-takeover reader gets one sentence.

**Do:** the equivalent already exists in the geometry. `cornerRadius` and `stitch` in `lib/lap.js` give you, per circuit, a sequence of banded runs with distances. A `<details>` table of *band · from · to · length* — "hairpin, 1,240–1,310 m, 70 m" — is a text equivalent of the actual claim, and is also the thing a reader would want to copy. It answers `PD-22` at the same time, because `prerender.js` already reads the geometry database and `pathOf`/`project` are pure. Sized **M** because the banding-to-runs transform has to move out of the component; the table markup is trivial once it has.

### `AX-10` — Three routes scroll the page body sideways at 320 px — **WCAG failure: 1.4.10 Reflow (AA)** — **S**

*Evidence: drove the site at 320×720 and 320×256.*

Horizontal scroll on `document.scrollingElement`, viewport 320 px:

| route | page scroll X | culprit |
|---|---|---|
| `/circuits/atlas` | **107 px** | `.atlas-stage` measures 427 px wide |
| `/circuits/spa` | **41 px** | the "How it changed" `.table-wrap` measures 361 px and is not itself scrollable |
| `/reference/sql` | 24 px | `span.faint` (an example's truncated SQL preview) at 344 px |
| `/`, `/drivers`, `/races/2024/1`, `/records`, `/drivers/hamilton` | 0 | clean |
| `/seasons/1976` | 2 px | rounding, ignore |

The pattern the site normally uses is correct — a wide table inside `.table-scroll` is exactly what 1.4.10 permits, and it works on the big registers. These three are the places the pattern was not applied: the atlas stage has a fixed minimum, the Spa layouts table overflows its own wrapper rather than scrolling inside it, and the SQL example preview uses a truncation that does not shrink.

**Do:** `min-width: 0` on `.atlas-stage` and its grid parent; check why `.table-scroll` on `/circuits/spa` is 360 px wide inside a 320 px column (it is the `.table-wrap` that overflows, so the scroller never engages); `overflow: hidden; text-overflow: ellipsis` on the example preview span.

*Cleared:* **1.4.4 Resize Text at 200% text-only is clean on all nine routes tested** — zero horizontal page scroll, no clipping. See *what is solid*.

### `AX-11` — Heading and caption text is concatenated from inline spans with no separator — **WCAG failure: 2.4.6 Headings and Labels (AA); 1.3.1 (A)** — **S**

*Evidence: read the accessibility tree; read `Page.jsx:97` and `Circuit.jsx:136-141`.*

`Section` renders `{title}<span className="count">{count}</span>` inside the `<h2>` with no whitespace. Visual spacing comes from CSS; the accessible name does not. Observed names:

```
h2  "Classification20 entries"
h2  "Known gaps11"
h2  "All twenty-five25"
h3  "Original road circuit1950–197014.1 kmmedium"      /circuits/spa
h3  "Modern circuit1983–7.004 kmmedium"
```

The Spa `h3`s are the bad case: four unrelated values, one of them a confidence tier, run together so that `1950–1970` and `14.1` become the token `1950–197014.1`. Somebody navigating by heading — the primary way a screen-reader user reads a page this long — gets that as the name of the section. The same string then becomes the table's `sr-only` `<caption>`, because `DataTable.jsx:125` takes the caption from `SectionTitle`.

The same defect is in `ErrorBox` (`States.jsx:33`): the observed alert text is `"SQLite refused thatno such column: nope"`.

**Do:** put a space in. Either `{title}{' '}` before the count span, or move the count out of the heading entirely and render it as a sibling — which is better, because "11" is not part of the heading's topic. For the Spa timeline, make the `h3` the layout name alone and render the years, length and confidence as a `Fields` row beneath it. **S**, and it improves the visible page too.

### `AX-12` — The fastest-lap column is a bullet, and the result rail is an empty cell named "Result" on every row — **WCAG failure: 1.1.1 (A)** — **S**

*Evidence: read the accessibility tree on `/races/2024/1`.*

`Race.jsx:338`: `render: (value) => (value === 1 ? '●' : '')`. Observed cell in the tree: `cell "●"`. The fact that Verstappen set the fastest lap of the 2024 Bahrain Grand Prix is carried by U+25CF and nothing else, under a column header reading `FL` with no expansion anywhere on the site (`CD-09` has the glossary half of that; this is the markup half). `●` is a non-text use of a text character with no alternative.

Separately, `Race.jsx:266-269` gives the rail column an `sr-only` header "Result" and an empty `<i>` for the cell. Observed: `cell ""` on all 20 rows. The intention (the CSS comment at `app.css:1808`) was that an unnamed column cannot be introduced — but naming the column and leaving the cells empty produces "Result, blank" twenty times, which is worse than a column that is skipped. The rail's *information* is fine: `Pos`, `Points` and `Out` all carry it in text on the same row, so **1.4.1 Use of Colour passes** and the rail is correctly redundant.

**Do:** for FL, `<span aria-hidden="true">●</span><span className="sr-only">fastest lap</span>`, and make the header `<abbr title="Fastest lap">FL</abbr>`. For the rail, `aria-hidden="true"` on the cell contents and drop the `sr-only` header — a purely decorative reinforcement should be invisible to the tree, not announced as blank.

### `AX-13` — Photograph `alt` text is the Commons file name, extension included — **WCAG failure: 1.1.1 (A)** — **S**

*Evidence: drove `/cars/mclaren-mp4-4`; read `CommonsImage.jsx:40` and `commons.js:29`.*

```
alt      = "McLaren MP4-4 front-right Honda Collection Hall.jpg"
figcaption contains = "McLaren MP4-4 front-right Honda Collection Hall.jpg · Morio · CC BY-SA 3.0"
```

`fileTitle()` strips `File:` and underscores and keeps the extension, so the alternative text ends in ".jpg" and is then repeated verbatim immediately below it. The gallery on `/cars` does this correctly — `Cars.jsx:105` passes `alt={car.car}`, and the observed link name is "Alfa Romeo 158/159 Alfetta" — so the right answer is already in the codebase.

**Do:** in a `<figure>` whose `<figcaption>` names the file, the image's own `alt` should be either a genuine description or empty. `alt={caption ?? ''}` is the one-character version and is defensible: the caption is the text alternative and is already adjacent. If you would rather keep a name, strip the extension in `fileTitle`. **S.** (`PM-07`'s 337 mismatched photographs are a different problem and this does not touch them.)

### `AX-14` — The chip filter groups have no name — **WCAG failure: 1.3.1 Info and Relationships (A); 4.1.2 (A)** — **S**

*Evidence: drove `/circuits`; read `Filters.jsx:54`.*

`/circuits` exposes eight controls: `INPUT "Filter circuits"`, `SELECT "Country"`, then `BUTTON "All"`, `"hybrid"`, `"oval"`, `"permanent"`, `"street"`, `"Traced"`. The first two are labelled well. The six buttons are `aria-pressed` toggles inside a bare `<span className="chips">` with no grouping and no name, so "hybrid, toggle button, not pressed" arrives with no indication that it filters by circuit type — and "Traced", which is a separate single-chip control, is indistinguishable from a seventh member of the same set.

**Do:** `role="group"` + `aria-label` on the `Chips` wrapper, taking a new `label` prop the way `Select` already does. Two lines in `Filters.jsx`, and every register gets it.

### `AX-15` — `/` is a global single-character shortcut with no off switch — **WCAG failure: 2.1.4 Character Key Shortcuts (A)** — **S**

*Evidence: drove the site; read `App.jsx:125-137`.*

`App.jsx:131` opens the palette on `/` whenever `event.target.tagName` is not `input`, `textarea` or `select`. Confirmed: pressing `/` while focus is on a table row link opens the palette. Confirmed the guard does work where it matters most — `/` typed into `textarea.sql` inserts the character and does not open the palette.

2.1.4 requires one of: a way to turn it off, a way to remap it, or activation only while the relevant component has focus. The typing guard is none of those; it is a partial mitigation of the same risk. The people this hurts are speech-input users, whose recogniser emits stray characters into a page with no text field focused, and screen-reader users in browse mode, where single letters are navigation commands the host application may pass through.

Judged proportionately: the guard removes the common case, there is no contenteditable anywhere in `web/src` so the guard's coverage is complete for this site, and ⌘/Ctrl+K already exists as a modified alternative. So this is a **small** finding that is nonetheless a Level A failure.

**Do:** cheapest conforming fix is to drop the bare `/` and keep ⌘/Ctrl+K, which is the convention readers expect anyway and is exempt as a modified shortcut. If you want to keep `/`, a "single-key shortcuts" toggle stored beside the theme choice satisfies the "turn off" clause. The `<kbd>/</kbd>` in the Search button would need to follow either way.

### `AX-16` — A line chart identifies one of its three series by colour alone — **WCAG failure: 1.4.1 Use of Colour (A), arguable in application** — **S**

*Evidence: drove `/seasons/1976`; read `LineChart.jsx:52-70`.*

The chart's design is deliberately good: direct labels ride the end of each line so the legend is a confirmation, and the comment explains that a colliding label is dropped rather than nudged. On 1976 — three series, Hunt, Lauda, Scheckter — the observed SVG text ends `… "R15", "R16", "69", "49"`. **Two labels for three lines.** The third series is identifiable only by matching a legend swatch to a stroke colour, which is what 1.4.1 prohibits.

*Engaging with the recorded reason:* dropping a colliding label is the right call, and nudging it would be worse. The gap is that nothing takes the dropped label's place. The `<details>` table gives the values, and as a *conformance* argument that is weak, because the table is itself visual and is collapsed by default.

**Do:** when a series loses its end label, give its line a stroke-dash pattern and put the same pattern on the legend swatch. That is a second channel that costs nothing and survives both collision and colour deficiency. `Figure.jsx:27` would need the swatch to accept a pattern as well as a colour. **S.**

---

## Usability with assistive technology — no criterion fits, and I am raising it anyway

### `AX-17` — Five of the six registers and the SQL console render their main table with no caption — **usability; 1.3.1 arguable** — **S**

*Evidence: drove twelve routes; read `DataTable.jsx:120-126`.*

The mechanism is right and the comment explaining it is right: a table takes its `sr-only` caption from the `Section` that introduces it, so there is one string and it cannot drift from the visible heading. It works on `/reference/eras` (seven named tables), `/reference/sources` (three), `/races/2024/1` (Classification, Qualifying, Pit stops) and forty-odd others.

It does not fire when a page renders a `DataTable` outside a titled `Section`:

| route | caption | rows in the table |
|---|---|---|
| `/drivers` | **none** | 862 |
| `/constructors` | **none** | 210 |
| `/races` | **none** | 1,172 |
| `/seasons` | **none** | 77 |
| `/reference/sql` | **none** | the reader's own result |
| `/circuits` | "Every venue" | 80 |
| `/cars` | "The chassis register" | 1,153 |

The five unnamed ones are the busiest tables on the site, and the SQL console's is the one a reader produced themselves. In the prerendered half **no table anywhere has a caption**, including all 862 static rows of `/drivers` — which is the accessibility face of `CD-04`, and needs a different fix from the one `CD-04` describes (a caption, not a footnote).

**Do:** give `DataTable` a `caption` prop at those six call sites — "Every driver, 1950–2026", "The result of your query" — and emit the same string from `prerender.js`. Cheap, and it is the difference between "table, 10 columns, 862 rows" and a table that introduces itself.

### `AX-18` — The sticky column headers do not stick — **usability** — **S**

*Evidence: drove `/drivers`; measured.*

`app.css:589` sets `thead th { position: sticky; top: 0 }`. It has no effect. The nearest scroll container is `.table-scroll`, which has `overflow: auto` on both axes and, measured on `/drivers`, `scrollHeight === clientHeight === 5822` — it never scrolls vertically, so the sticky headers stick to a scrollport that does not move and scroll away with the page. Confirmed in the screenshot: at `scrollY 3393` the column headers are gone, and there is no way to get them back short of scrolling to the top.

This matters most to exactly the readers this audit is about. On `/drivers` the reader is looking at ten columns, five of which contain `0` and two of which contain `—`; at row 400 there is nothing on screen that says which is which. For a screen-reader user the `<th scope="col">` markup makes this a non-issue — the headers are announced per cell, correctly. For a low-vision user at 400% zoom, or anyone with a working-memory constraint, it is the difference between a usable table and a wall of digits.

**Do:** either make the sticky work — give `.table-scroll` a `max-height` so it becomes a real vertical scroller, with `scroll-padding` for `AX-08` — or delete the rule, because a rule that looks like it works is worse than an absent one. My preference is the first for tables over ~40 rows and the second otherwise; both are S, and doing nothing is the only bad option.

### `AX-19` — The atlas scrubber announces an abstract number, and its pointer target is 3 px tall — **usability; 2.5.8 passes** — **S**

*Evidence: drove `/circuits/atlas`; read the tree; read `app.css:1670-1687`.*

The good news is in *what is solid*: the `<output>` is a polite live region and it works. The two gaps:

- The slider itself reports `valuetext="5"` after five ArrowRight presses — the raw 0–1000 scale. Most readers speak the slider's own value on each press, *then* the polite `<output>`, so the sequence a user hears is a meaningless number followed by a meaningful one. **Do:** `aria-valuetext={`${Math.round(marker.metres)} m of ${Math.round(shape.length)}`}` on the input and drop the duplication; or keep the `<output>` and set `aria-valuetext` to the same string.
- `input[type='range']` is `height: 3px` with a 15×15 px thumb. The observed bounding box is 647×3 on desktop, 129×3 on a phone. **This passes 2.5.8** — the spacing exception applies, because no other target's 24 px circle comes near it — and I am not filing it as a failure. It is still a 3 px drag target for the site's only continuous control, which is a real barrier for a tremor or a touch user. **Do:** `height: 24px` with the visible 3 px track painted as a background gradient, and a 24 px thumb. The drawing does not change.
- When a trace does not close (Monaco, Montjuïc, Las Vegas) the input is `disabled`, so it leaves the tab order entirely and a keyboard user never meets the explanation. `aria-disabled="true"` plus ignoring input would keep it reachable and keep the `<output>`'s "not a closed lap" discoverable.

### `AX-20` — There is no skip link, and eleven tab stops precede every page's content — **usability; 2.4.1 arguably passes** — **S**

*Evidence: drove the site; counted.*

Tab stops before the first content link on every page: wordmark, eight nav items, Search, theme — **eleven**. There is no `a[href^="#"]` anywhere in either renderer. 2.4.1 Bypass Blocks lists `ARIA11` (landmarks) among its sufficient techniques, and this site has proper `<header>`, `<nav>`, `<main>`, `<footer>` and named `nav`s throughout, so **I am not calling this a failure**. It costs a screen-reader user nothing.

It costs a keyboard-only user without a screen reader eleven presses on every page, which is the population landmarks do not help. Given that most arrivals here are deep-page arrivals, that is eleven presses per arrival.

**Do:** one anchor before the masthead, `id` on `<main>`, three CSS rules to reveal it on focus. Fifteen minutes.

### `AX-21` — Data tables have no row headers — **usability; 1.3.1 arguable** — **S**

*Evidence: read the accessibility tree on nine routes.*

Every `<table>` on the site has `<th scope="col">` and **zero** cells in `<tbody>` are `<th>`. Observed on `/races/2024/1`, row 1: `row → cell "", cell "1", cell "Max Verstappen", cell "Red Bull Racing", …`. Reading down a column in table-navigation mode gives a column of values with no way to ask "which row is this?" without moving back across.

The natural row header exists in every one of these tables: the driver's name, the circuit's name, the season. **Do:** a `rowHeader` key on `DataTable`'s column spec that emits `<th scope="row">` instead of `<td>` for that column. One component change, one prop per call site, and it is the single largest improvement available to a screen-reader user reading a 393-race career table.

### `AX-22` — Each car card is two adjacent links to the same page — **usability** — **S**

*Evidence: drove `/cars`; read `Cars.jsx:100-118`.*

```
/cars/alfa-158      :: ""                     then "ALFA ROMEO 158/159 ALFETTA"
/cars/ferrari-500   :: "NO PHOTOGRAPH MATCHE" then "FERRARI 500"
/cars/maserati-250f :: ""                     then "MASERATI 250F"
```

Twenty-nine cards, fifty-eight tab stops, every destination named twice — and for the cars with no photograph, the first of the pair is named "no photograph matched", which is a link name that describes an absence rather than a destination. (The image link's accessible name comes from the `alt`, which is correct where there is an image.)

**Do:** `tabIndex={-1} aria-hidden="true"` on the image link. The mouse target survives; the duplicate disappears from the keyboard order and the tree. Two attributes.

### One line each, not filed

- **`IA-14` confirmed on a device-sized viewport**, and worse than inferred: at 320 px the masthead strip shows "Seasons Races Drivers Constructo…" with `scrollbar-width: none`, so five of eight destinations have no visual affordance. **For keyboard it is fine** — Tab scrolls the strip and reaches all eight — so this is a pointer and low-vision problem, not a 2.1.1 one. That may lower its priority or raise it depending on which reader you weight; it does not change the fix.
- **`CD-10`, the bare confidence pill**, from this side: the pill is `<span class="pill pill-reference">reference</span>` with no programmatic relationship to the fact it qualifies, so a reader who lands on it out of order gets one word with no subject. But **1.4.1 passes** — `Page.jsx:112`'s rule that the colour only ever supports the word, never replaces it, is correctly implemented and only the two ends take colour at all. Whatever `CD-10` ships, keep that rule.
- **Register filter fields are labelled only by `aria-label` and a placeholder** (`Filters.jsx:28`), so once the reader types, nothing visible says what the field does. 3.3.2 is arguably met; a persistent visible label would be better and costs a `<label>`.
- **The stepper's links read "← Previous race" / "Next race →"** (`Page.jsx`, `Stepper`), which names a direction and not a destination. 2.4.4 passes on context; 2.4.9 is AAA. Naming the race would help everyone and is adjacent to `IA-10`.

---

## What is solid — do not churn these

Specifically, because several of these are places a careless audit would file work:

- **Target size passes.** I expected this to be the big finding and it is not. On `/drivers` at 390×844, **154 of 186 targets are under 24 px**, and after applying 2.5.8's spacing exception correctly — a 24 px circle on each undersized target, tested against every other target's box and circle — **zero fail**. Row pitch is 39 px, comfortably over 24, and the name column has no horizontal neighbour. The one apparent hit is the footer's "write your own query" against "How far to trust it", and those are inline links in a sentence, which is the other exception. **Do not add padding to table rows for accessibility reasons; there is no requirement to meet.**
- **The focus indicator is good in both themes.** `app.css:58`: 2 px solid `--accent` at 2 px offset, and it renders on every one of the sixteen stops I walked from the top of `/`. Against its own backgrounds: **5.08–5.90:1 in light, 5.42–5.82:1 in dark** — comfortably past 1.4.11's 3:1, on all four surfaces in both themes. The one exception, `.palette input:focus { outline: none }`, is a text field with a caret and is defensible.
- **No keyboard traps.** 186 Tab presses down `/drivers` and out of the document; Tab escapes `textarea.sql` cleanly to the Run button; `<details>` in the schema list and the chart tables are native and behave.
- **1.4.4 Resize Text at 200%, text-only, is clean** on all nine routes I checked at 1280×1024 with `html { font-size: 200% }` — zero horizontal page scroll, no clipping, no overlap. That is not common and it is worth knowing you have it.
- **`Figure.jsx`'s rule that every chart carries a table of its own numbers.** Verified on eleven `Figure` call sites across six pages: every one has both a `role="img"` with a real descriptive `aria-label` ("Percentage of races each season won from pole position, 1950 to 2026" — a sentence, not a title) and a reachable `<details>` table, keyboard-operable, with the right number of rows. The comment at `Figure.jsx:8` is correct and the discipline should be extended to the atlas (`AX-09`), not relaxed.
- **`role="alert"` on query failure** (`States.jsx:33`) and on the SQL console's refusals. The refusal copy — *"Reads only: start with SELECT, WITH, VALUES, EXPLAIN or PRAGMA. A write would be rolled back anyway, so nothing has changed."* — tells a person what to do and reassures them about what did not happen. That is what an error message is for.
- **The atlas `<output>`.** `Atlas.jsx:209` is an implicit `status live=polite`, observed carrying "35 m of 6,995" and updating on each arrow press. It is the only working live region on the site, and it happens to be on the hardest control. Whatever else changes on that page, keep it.
- **The prerendered half is structurally sound.** Seven routes checked with the bundle blocked: `lang="en"`, exactly one `h1`, `main`/`nav`/`header`/`footer`, a named "Breadcrumb" nav, heading order with nothing skipped, distinct and descriptive `<title>` on every one (2.4.2 passes in both halves), `<th scope="col">`, zero images, zero `img` without `alt`. axe finds nothing on it but the same `--ink-faint` token. Its only accessibility gap is captions (`AX-17`).
- **The `sr-only` caption-from-`Section` mechanism, the `aria-sort` on sortable headers, the `nav aria-label` on every secondary nav, the `aria-pressed` toggles, and `aria-hidden` on every decorative SVG and glyph** are all done correctly and consistently. Sixty-three axe rules found one problem; that is the reason.
- **1.4.1 Use of Colour passes on the result rail and the confidence pill**, both by design and both documented. The rail's four states are each restated in text in the same row; the pill always carries the word. Two places the project got right on purpose.

---

## What I did not examine

- **A real screen reader.** Everything here is the Chromium accessibility tree and observed focus behaviour. Announcement order, verbosity and browse-mode behaviour differ by product, and three findings (`AX-04` on `aria-sort`, `AX-19` on announcement order, `AX-12` on how `●` is spoken) would be sharpened by thirty minutes with NVDA on Windows or VoiceOver on this machine. None of them would be overturned by it — the absence of a live region and the absence of a role are facts about the DOM.
- **Voice control and switch access.** Not driven. `AX-15` is the one finding that anticipates a speech-input user and it is inference about the mechanism, not an observation of Dragon or Voice Control.
- **Windows High Contrast / forced-colors.** Not tested. The site uses `currentColor` in the wordmark and CSS variables throughout, which is a good sign, but the SVG charts' explicit `stroke` values and the atlas ramp would need checking under `forced-colors: active`.
- **Mobile screen readers.** No TalkBack or iOS VoiceOver. The atlas scrubber and the search palette are the two surfaces most likely to differ there.
- **`/reference/eras`, `/reference/glossary`, `/reference/sources`, `/records`' authored block and `NotFound`** got an axe pass and a structural read but no keyboard walk.
- **3.1.2 Language of Parts.** `lang="en"` is correct and persists through app takeover; the non-English strings I saw are proper names, which are exempt. I did not read the 552 prose fields for embedded foreign-language passages.
- **The 2,300 pages I did not open.** Twelve routes in the app, seven static. The registers and the race/driver/constructor/circuit/car page types are covered; individual outliers are not.

---

## Backlog entries

```
- [ ] `AX-01` **The cold load and the handover are unannounced.** Two h1s for
      10.9 s of an 11.5 s load at 4 Mbps, an unnamed progressbar, zero live
      regions, and focus dropped to <body> when #prerendered is removed.
      Three S pieces: name the progressbar, one role="status" for the phase
      words, focus the h1 on handover. — *accessibility critique · M*
- [ ] `AX-02` **The search palette is not modal and not a listbox.** Shift+Tab
      leaves it despite aria-modal="true"; no activedescendant, no listbox
      role, no focus restore, no result count. Three S pieces. —
      *accessibility critique · M*
- [ ] `AX-03` **Focus is dropped to <body> on every in-app navigation** and on
      "Show the remaining N". tabIndex={-1} on the h1 in Page, focused on
      pathname change. Escalates IA-04, which fixed the title and not the
      announcement. — *accessibility critique · S*
- [ ] `AX-04` **Nothing the reader causes is announced except an error.** Zero
      live regions on eleven of twelve routes. role="status" on .result-count
      in Filters.jsx:16 and Sql.jsx:179 is the S piece worth shipping alone. —
      *accessibility critique · M*
- [ ] `AX-05` **--ink-faint fails 4.5:1 on three of four light surfaces**
      (4.05 / 4.28 / 4.43); the token file measured the fourth. 158 axe nodes,
      one line. — *accessibility critique · S*
- [ ] `AX-06` **Dark theme: white on --accent is 3.34:1** on .button — the SQL
      console's Run control. — *accessibility critique · S*
- [ ] `AX-07` **The atlas ramp and one light chart series are under 3:1.**
      --seq-1 at 1.99:1 on stage, no two bands 2:1 apart; --series-3 at 2.65:1.
      1.4.11. — *accessibility critique · S each*
- [ ] `AX-08` **Shift+Tab hides the focused link behind the sticky masthead.**
      2.4.11. `html { scroll-padding-top: 72px }`. — *accessibility critique · S*
- [ ] `AX-09` **The atlas is the one graphic with no table of its numbers.**
      A banded-runs table answers 1.1.1 and PD-22 together. —
      *accessibility critique · M*
- [ ] `AX-10` **Three routes scroll sideways at 320 px** — atlas 107 px, Spa
      41 px, SQL 24 px. 1.4.10. — *accessibility critique · S*
- [ ] `AX-11` **Heading names concatenate without spaces** —
      "Original road circuit1950–197014.1 kmmedium". Also ErrorBox. —
      *accessibility critique · S*
- [ ] `AX-12` **The FL column is a bullet with no alternative,** and the result
      rail is an empty cell named "Result" on every row. —
      *accessibility critique · S*
- [ ] `AX-13` **Photograph alt text is the file name, ".jpg" included,** and
      repeats the caption below it. Cars.jsx already does it right. —
      *accessibility critique · S*
- [ ] `AX-14` **Chip filter groups have no name.** role="group" + aria-label on
      the Chips wrapper. — *accessibility critique · S*
- [ ] `AX-15` **"/" is a global single-key shortcut with no off switch.**
      2.1.4. Drop it and keep Cmd/Ctrl+K, or add a toggle. —
      *accessibility critique · S*
- [ ] `AX-16` **A dropped end label leaves one line identified by colour alone.**
      1.4.1. Stroke-dash per series, echoed in the legend swatch. —
      *accessibility critique · S*
- [ ] `AX-17` **Five registers and the SQL console render their table with no
      caption,** and the static half has none anywhere. —
      *accessibility critique · S*
- [ ] `AX-18` **The sticky column headers do not stick.** .table-scroll never
      scrolls vertically, so app.css:589 has no effect. Make it work or delete
      it. — *accessibility critique · S*
- [ ] `AX-19` **The scrubber announces "5" and has a 3 px pointer target.**
      aria-valuetext, a 24 px hit area, aria-disabled instead of disabled.
      2.5.8 passes; this is usability. — *accessibility critique · S*
- [ ] `AX-20` **No skip link; eleven tab stops before content on every page.**
      2.4.1 arguably passes via landmarks. — *accessibility critique · S*
- [ ] `AX-21` **No table has a row header.** A rowHeader flag on DataTable's
      column spec. — *accessibility critique · S*
- [ ] `AX-22` **Each car card is two adjacent links to one page.**
      tabIndex={-1} aria-hidden on the image link. —
      *accessibility critique · S*
```

**If you ship four things:** `AX-08` (one CSS line, a clean AA failure), `AX-05` (one token, the entire automated finding), `AX-03` (one line in `Page`, fixes every navigation on the site), and `AX-04`'s two `role="status"` attributes. That is under an hour and it moves the four highest-frequency defects. `AX-01`, `AX-02` and `AX-09` are the real work and are each three shippable pieces.
