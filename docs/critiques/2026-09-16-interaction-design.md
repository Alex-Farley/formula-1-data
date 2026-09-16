# Interaction design critique — 2026-09-16

**Critic:** `interaction-design-critic`, third run. Scoped to `AF-22` (#305).
**Subject:** Lap Ledger v2.23 at `b15f48e`, `web/dist` under `vite preview`,
driven in Chromium through Playwright at 1280×900 and 390×844. Scope:
`/circuits` and `/circuits/:id`, and the relationship between the two drawings
the circuit page shows.
**Brief:** the maintainer's, 2026-09-14 — *"an expert animation and interaction
design eye to look at it objectively"*. Deliberately open: **should motion
appear here at all**, and **what is the best drawing of a circuit for someone
who wants to understand its shape** — not *how should we animate a lap*. The
track atlas was cut in `AF-20`/`AF-21` and is not re-proposed.
**Prior:** the 2026-09-11 and 2026-09-13 interaction reports, `docs/LANDED.md`,
and the open queue including `VD-37`–`VD-44` (#324–#331), filed by the visual
critic against these routes while this ran; their findings are not repeated,
and where one is shared the issue is named.

**Read-only. The repository was not modified.** The preview serves 21.8 MB
uncompressed where production serves the 4.9 MB gzip member, and CDP throttling
did not reach the worker's fetch, so wall-clock figures here are local — the
prior run's 29.2 s at 1.6 Mbps against the live site is the better one.
Everything else is DOM measurement, `getBBox`/`getPointAtLength` probing of the
shipped paths, or SQL.

---

## The three that matter

**1. Motion should not come back to this page. What it would have been for is
already broken, and static fixes it.** "How did this circuit change" is a
question about *difference between layouts*, and the grid that answers it draws
differences too small to see. Sampling every shipped outline at 400 points and
comparing each layout with its predecessor in the same 500-unit box: **30 of 81
consecutive pairs differ nowhere by more than 10 units — 2.9 px at the 143 px
the cards render at — and 13 of those by no more than 1.4 px.** Median across all 81 pairs: 16 units, 4.6 px. Seven Monza thumbnails, six of
them the same boot, are not a failure of animation but of size and
registration, and a crossfade would only make an invisible difference invisible
more slowly.

**2. At the handover the reader is thrown to the top of the page — every time,
on both routes.** Scrolled to y = 1500 on `/circuits/monza` and reading "Ayrton
Senna", the reader is at y = **0** when the app lands: four runs of four, and
the same on `/circuits/silverstone`, which has no trace and so no inserted
section — this is not new content pushing. `main.jsx:handOver()` reads
`window.scrollY` and restores it two frames later; `App.jsx:70-76` mounts
`ScrollToTop`, whose effect fires `window.scrollTo(0, 0)` on that same mount.
`IX-19` recorded the symptom on `/drivers` with a different cause (the document
shrank); this is the cause the register pages have.

**3. The two sections that draw a circuit's history are the same list twice,
and at Monza they disagree.** "Every layout raced here" prints seven cards;
"How it changed" prints nine timeline rows below it; the only join is the
string *"drawn as monza-5"* in a heading the reader must carry back up the page
by eye. `monza-5` (1974–1975, 2 rounds) has a card and **no timeline row**; the
timeline's *"Revised chicanes, 1974–1993, 5.8 km"* carries **no
`f1db_layout_id`**, so it names no drawing. Sitewide, 11 outlines have no
timeline row at a circuit that has a timeline, and 5 timeline rows have no
layout id. A reader asking what the 1975 Italian Grand Prix ran on gets two
answers and a note that reconciles only the *lengths*.

## Should motion appear here at all — the verdict

No, with one narrow exception that is a transition rather than an animation.

- **Shape is apprehended in parallel.** A line drawn over time is strictly
  worse than the same line drawn at once: it costs the reader the ability to
  compare any part with any other, and this page's job is comparison throughout.
- **There is no quantity for motion to encode.** With no lap times (constraint
  1) a moving dot varies only arc length, which the caption prints. Turn-rate
  colour was cut for reading nothing the shape already showed; a moving dot is
  weaker than that.
- **Every atlas failure returns with it.** Three of 25 traces do not close and
  would need a disabled state again; a scrubber without an address is
  unshareable (`IX-24`); `prefers-reduced-motion` needs a static equivalent, and
  if that must be as good, build it and stop.
- **Nothing is measured** (`PD-Ø`). The atlas was cut without a usage number
  because none was obtainable; spending the next increment on motion before
  anyone knows whether `/circuits/:id` is read repeats that exactly.

**The exception.** If the layout grid becomes a single stage with a selector
(`IX-29`), the swap between layouts may cross-fade over ~120 ms behind
`prefers-reduced-motion: no-preference`, instant otherwise. That is motion in
service of *"what moved?"* — the eye locating a change between two nearly
identical shapes — and it needs no play, pause, scrub or keyboard-repeat
vocabulary, which is the whole of what went wrong before. Nothing else here
earns motion.

## What `AF-23` (#306) needs, and what I am not deciding

Measured, not argued. The **trace** carries true scale, true aspect, a measured
length with a signed delta against the published figure, and direction of
travel; it covers **25 of 80 circuits, current layout only**, can never hold a
historic one, and is **absent from every prerendered page** —
`dist/circuits/monza/index.html` has the seven outline cards and no
`svg.lapfigure`, and `dist/circuits/index.html` has no SVG at all. The
**outline** carries a recognisable shape for **79 of 80 circuits and all 160
layouts**, with years and rounds, on the static page; it carries **no scale**
(every shipped path's `getBBox` spans 15→485 of its own 500-unit box, so Spa's
14.12 km 1950 layout is drawn exactly as large as its 7.004 km current one), no
direction, no position — and at Silverstone three of eight (`-5`, `-6`, `-7`)
are the **same path string** under three different captions.

Two things the decision should have that the issue does not:

- **Consecutive layouts that did not change the circuit's extent share a
  coordinate frame** and can honestly be superimposed — `monza-3`…`-7`,
  `zandvoort-1`…`-4`, `spa-2`…`-4` have identical bounding boxes. `monza-1`,
  `monza-2`, `spa-1` and `zandvoort-5` do not, and overlaying those would be a
  lie. An overlay is viable *gated on a bbox match*: four lines of arithmetic.
- **Whichever leads, the page must say when a trace is absent.** Today it is
  silent, and a failed ODbL overlay produces a byte-identical page (`IX-31`).

I am not taking the decision. The evidence leans to the outline as the identity
picture and the trace as the measured supplement — on coverage and the
prerender gap, not aesthetics — and the one thing that would overturn it is
prerendering the trace, which the licence permits (two files, side by side) and
nothing in the build currently does.

## The full set, by consequence

**`IX-29` — the layout grid draws differences too small to see, and the fix is
size and registration, not motion — M.** *Drove the site; probed the shipped
paths. Defect.* As above. `.outline-grid` is `repeat(auto-fill, minmax(150px,
1fr))` (`app.css:1405`): seven 163 px cards on desktop, a 4×2 grid costing
~1,000 px of scroll at 390 px, and nothing in it focusable, so there is no way
by mouse or keyboard to see a layout larger than 163 px. **Do:** one stage at
`.map-grid`'s 460 px showing one layout at a time, the existing cards below it
as a tablist (arrow keys, `aria-selected`), and the selection in the URL
(`?layout=monza-5`) so it is shareable and survives Back. At 460 px the median
difference becomes ~15 px. Second rung: ghost the preceding layout beneath in
`--ink-soft` where the bounding boxes match, and say "the circuit's extent
changed" where they do not. *Rides with #306; the interaction half of `VD-37`
and `VD-44`.*

**`IX-30` — the handover returns the reader to the top of a 7,291 px page —
S.** *Drove the site; read the source. Defect.* Measured above. **Do:** have
`ScrollToTop` skip its first run — it exists to emulate a page load on *route
change*, and the app's own mount is not one.

**`IX-31` — a circuit with no trace and a trace that failed to load are the
same page — S.** *Drove the site with the overlay aborted. Defect.* Blocking
`f1-geometry.db` leaves `/circuits/monza` structurally identical to
`/circuits/silverstone` — no "The shape of it", no message — and makes
`/circuits` read **"The traced laps 0 of 80"** above an empty grid, under a
note still saying "Drawn from the centreline each one was matched to". The only
evidence is a `console.warn` (`worker.js:264`); the `traced` column empties with
it, so the page is internally consistent and wrong. Silverstone has the same
silence with no failure at all — the sole hint is `OUTLINE_RULE`'s "where it
exists". **Do:** one line under the outlines, chosen from whether
`mergeGeometry` returned null: "No traced centreline for this circuit — 25 of
the 80 have one", or "The centreline file did not load." *Bears on #306.*

**`IX-32` — the outline grid and the layout timeline are one list rendered
twice, joined by an id the reader matches by eye — M.** *Drove the site;
queried the database. Defect.* Measured above. **Do:** fold the timeline's prose
into `IX-29`'s stage — one row per layout, the register's name, years, length
and change reason beside the drawing it names — so there is one list with a
picture rather than two lists with a join. Rows carrying no `f1db_layout_id`
then show as rows with no drawing, which is the true state. *Rides with #306 and
`AF-08` (#279).*

**`IX-33` — the register's filter bar governs the table and not the 25 pictures
above it — S.** *Drove the site. Defect.* Filtering `/circuits` to "street"
leaves 16 table rows under an unchanged 25-card grid, and the bar sits *below*
the grid, so by the time a reader has used it the grid is off screen and its
scope unknowable. **Do:** hoist the filter state from `Register` to `Circuits`
and put one bar above both.

**`IX-34` — focus lands on `<body>` after every in-app navigation, though it is
managed at the handover — S.** *Drove the site. Defect.* Tab to a traced-lap
card on `/circuits`, press Enter: `/circuits/albert-park`, with
`document.activeElement === body`. Back does the same. `main.jsx` focuses
`#root main h1` at the static→app handover — once, where nobody is navigating —
and nothing does it on the 2,385 route changes after; with `AX-20`'s eleven tab
stops before content, a keyboard reader pays them again on every circuit.
**Do:** move that existing `h1.focus({ preventScroll: true })` into the route
change. *Accessibility owns the fix; here because it is the exit from the
register.*

**`IX-35` — one chip group, two vocabularies, mutually exclusive — S.** *Drove
the site. Defect.* `/circuits` offers `All · hybrid · oval · permanent · street
· Traced` in one `role="group"`, so "Traced" and "street" cannot both be on and
choosing one silently clears the other; the four raw database values are
lower-case and the written label is capitalised, which is the only visible sign
they are different kinds of thing. **Do:** take "Traced" out of the type chips
and give it its own toggle beside them.

## Genuinely good — do not disturb

The traced-lap grid on `/circuits` is the best picture surface on the site: 25
shapes at 139 px, each card carrying name, country and measured length, and it
declares its own convention — *"each at its own scale so the shape reads rather
than the size"* — which is exactly the sentence the outline grid lacks. Nothing
on either route is hover-only. The figcaption under a trace is a model of a
verifiable caption: relation number as a live link, point count, measured
against published with a signed delta, the direction, and the fact that the
arrow is the direction and *not* the start.
`/circuits/nurburgring-sudschleife` — no races, no trace, no outline — leads
with a lede explaining why a circuit with zero championship races is in the
register, and draws nothing rather than something empty. Browser Back restores
the register's scroll exactly. `mergeGeometry` refusing to take the site down
when the ODbL file fails is right; only its silence is wrong.

## Examined and cleared

The boot strip's byte counter appears to run backwards on the preview — "3.9 MB
of 4.9 MB" at 2.3 s, then "5.3 MB of 21.8 MB" at 2.8 s, because `drain()` swaps
its denominator when `loaded` passes `manifest.gzipBytes` (`worker.js:104`). It
does **not** happen in production: `curl -I https://lapledger.org/f1.db.gz`
returns `content-type: application/gzip` with no `content-encoding`, so the
browser never inflates in transit. A preview artefact that becomes real the day
the host sets `Content-Encoding: gzip`. Recorded, not filed. Also cleared:
deep-arrival orientation on a circuit page needs nothing, and the app's outline
counts and the prerendered page's agree on every circuit checked.

## Not examined

The race page's layout card and the season strip (`AF-07`, out of scope); dark
theme; Safari and Firefox; real devices and assistive technology; whether
either drawing is ever reached from search; the register table's sorting and
pagination beyond the filter interaction above; the other nineteen routes; and
a throttled production load.
