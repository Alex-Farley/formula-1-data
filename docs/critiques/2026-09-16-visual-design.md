# Visual design critique — 2026-09-16

**Critic:** `visual-design-critic`, third run, scoped to how a circuit is drawn.
**Subject:** the committed build of `main` at `b15f48e` (v2.23), served with
`vite preview` and driven in Playwright Chromium at 1440, 768 and 400 px, both
themes, at device scale 1 and 2 — ten circuit routes plus `/circuits`. Geometry
computed from `f1-geometry.db`; rendered sizes probed with `getBBox` against
each `viewBox` on the running page.
**Brief:** `AF-22` (#305) — "an expert animation and interaction design eye, to
look at it objectively": should motion appear here at all, and what is the best
drawing of a circuit for a reader who wants to understand its shape. The atlas,
cut in `AF-20`/`AF-21`, is not re-proposed. Sibling `AF-23` (#306) asks whether
the page's two drawings should be consolidated; this feeds that decision rather
than taking it.
**Prior:** `docs/critiques/2026-09-11-visual-design.md` (`VD-12`, `VD-17`),
`docs/critiques/2026-09-13-visual-design.md`, the open queue.

**Read-only.** Scripts and ~60 screenshots in the session scratch directory;
**neither the repository nor the worktree was modified.**

---

## The three that matter

**1. The circuit page has no picture of the circuit worth looking at, and for 55
of the 80 it has no large picture at all.** Silverstone — 61 races, the first
one, eight layouts — has no traced centreline, so no *"The shape of it"*
section, and its largest drawing of Silverstone is a **162.8 px** outline card
in a **1236 px** row. Where a trace exists the frame is spent, not used:
`fitted()` builds a square viewBox, so Gilles-Villeneuve's 622 × 1915 m circuit
renders **143 × 440 px** inside a 458 px square inside a 1236 px section —
**11.6 %** of the width available. Monza manages 256 of 1236. `.map-grid` caps a
single trace at 460 px (`app.css:1354`), leaving 63 % of the row empty; `VD-32`
recorded 55 % before the measure widened, so this got worse. It is `VD-12` one
build on: the atlas's renderer is gone and the page with the audience still
shows the flattest drawing of the best asset. *(drove the site; measured in the
DOM · defect)* → **`VD-37`**

**2. The two drawings are one picture twice, and the static page shows only the
smaller one.** At Monza the trace (458 px, 4 px `--ink`, framed card, arrow,
ODbL) and F1DB's `monza-7` (162.8 px, 2.25 px `--ink`, unframed, no arrow, CC BY
4.0) are the same shape at two sizes, two weights, two framings and slightly
different rotations, in consecutive sections, with nothing saying which is
authoritative. And `dist/circuits/monza/index.html` holds **0** `lapfigure`
nodes, **15** `outline` nodes and no *"The shape of it"* heading — the trace is
ODbL and cannot be prerendered, so the page a search arrival paints leads with
the outlines, and the app then inserts a **553 px** figure above them. The
reader's primary picture of Monza changes identity and position at boot. *(drove
the site; read the build output · defect)* → feeds **#306**; register half in
**`VD-43`**

**3. Twenty-five circuits are drawn in the one colour the system reserves for
interaction.** `Circuits.jsx:81` strokes every `/circuits` thumbnail
`var(--accent)` — probed `rgb(200, 16, 40)` light, `#ff4757` dark. `tokens.css:6–8`:
the accent means "you can act on this", "**Never a data mark**".
`web/README.md:307` restates the rule in the very paragraph recording `VD-26`
(#113), which landed and removed a 22 × 2 px bar from stat tiles while leaving
25 whole circuits red two routes away. The same traces are `--ink` on
`/circuits/:id`, and F1DB's outlines are `--ink` everywhere: three drawings of
one subject, two inks, no rule. *(read the source; probed the running page ·
defect)* → **`VD-38`**

---

## On motion: no. And the colour was correctly cut.

Asked first because the brief asks it first. **There is currently no motion on
either route** — `app.css` holds three animations (skeleton shimmer, boot bar,
`photo-breathe` on a loading `img`); the lap figure carries `.photo` but no
`img` and no `data-state`, so none fire. That is the right state and I would
not change it.

- **A moving lap asserts a time this database does not have and will not have.**
  A dot at constant speed claims a pace; at varying speed, telemetry. Both are
  permanently unsourceable (brief constraint 1). Every other mark here is a fact
  the geometry holds; motion would be the first that is not.
- **Direction and order are all a drawn-in animation would encode, and a static
  mark encodes them better** (finding 6). A fact carried by motion is one the
  2,385 prerendered pages lose, and deep arrival is this site's main door.
- **On a 25-card grid, motion is 25 moving things at once** — the worst case for
  the only task that grid has.
- **One contingent exception.** *If* #306 lands a toggle between the outline and
  the trace of one layout, a 200 ms cross-fade is a blink comparator: the one use
  of motion that makes a comparison a static side-by-side does not. User-driven,
  never autoplay, static superposition under `prefers-reduced-motion`. Absent
  that toggle, nothing here needs to move.

**The turn-rate colouring was correctly judged.** I looked for a way to argue it
back and there is none. Corner radius is a property of the shape, and the shape
is already drawn at position; colouring it re-encoded in a weak channel what a
strong channel already carried — `VD-25`'s 1.23:1 band separation was a symptom,
not the disease. What settles it: `circuit_geometry` holds `centreline`,
`measured_km`, `published_km`, `delta_pct`, `node_count`, `segment_count`,
`loose_ends`, `closes` — no elevation, speed, gear, surface or sector. **There is
no second variable for colour to carry.**

---

## The rest, by consequence

**4. "Every layout raced here" normalises away the change it documents.** Each
outline is fitted to its own 500-unit box, so Silverstone's 1950 airfield
perimeter (4.649 km, 8 turns) is drawn **exactly as large** as today's circuit
(5.891 km, 18 turns): 27 % more length and ten more corners, invisible. Monza's
`monza-4` and `monza-5` differ by 25 m and cannot be told apart at 163 px. It is
not fixable from F1DB's data — **an outline is a drawing with no scale, so the
trace is the only scalable circuit drawing the project holds.** That is my
sharpest input for #306: whichever leads, only one of the two can ever answer
"is this bigger than that". *(drove the site; queried the database · defect,
with no cheap fix)* → **`VD-44`**

**5. The credit prints once per card, and it is two lines of every five.**
Monza's grid prints "F1DB, CC BY 4.0 · drawn by Jules Roy" **seven** times,
Silverstone's **eight**. At 1440 the caption block measures **98.6 px** (Monza)
to **116.8 px** (Silverstone) under a **162.8 px** drawing — the label is 72 % of
the height of the thing it labels, and on Indianapolis's two cards the text is
the dominant object. At 400 px the grid is ~2,000 px of scroll, ~39 % of it
repeated credit. CC BY 4.0 §3(a)(2) lets attribution be given "in any reasonable
manner based on the medium"; one credit beside `OUTLINE_RULE`, which already
prints once above the grid, satisfies it, and the per-card caption keeps the
layout id, the figures and the years. *(drove the site; measured; read the
licence · defect)* → **`VD-39`**

**6. The direction arrow is sized in metres on a drawing whose line is sized in
pixels.** `LapFigure.jsx:51` gives the polygon an 88-unit span in projected
metres while the path is `non-scaling-stroke` at a constant 4 px. Measured, the
arrow renders **17.9 px at Monza, 18.8 at Spa, 30.9 at Long Beach, 38.3 at
Zandvoort** — 2.1× for the same mark across 25 pages, its `--stage` halo
ranging 2.0–4.4 px. Separately it is one triangle at an arbitrary 12 % of the
lap, which the caption then has to disclaim ("the arrow is the direction, not
the start"). **A mark that needs a disclaimer is the wrong mark.** Four or five
chevrons spaced round the lap read as flow rather than as a place, and the
disclaimer goes with them. Size them in pixels, like the line. *(measured in the
DOM; read the source · defect)* → **`VD-40`**

**7. The three traces that do not close are drawn exactly like the twenty-two
that do.** Monaco, Las Vegas and Montjuïc render as open paths with the same
round caps as a closed ring; Monaco reads as a broken squiggle, and at the 90 px
I forced it to, as nothing. The circuit page's caption says "the trace does not
close"; the `/circuits` thumbnail says nothing, though `Circuits.jsx:48` already
selects `g.closes`. A square terminal at each loose end lets a reader **see** the
hole the caption describes, which is the house style everywhere else here.
*(drove the site; read the source; queried the database · defect)* → **`VD-41`**

**8. Three stroke-weight rules for one subject.** Trace 4 px fixed
(`lap.js:156`), outline 2.25 px fixed (`app.css:1390`), register thumbnail
`side / 44` — proportional, ≈3.15 px at its 138.6 px card. Only the third
survives being shown at several sizes; the outline gets away with a fixed value
because it is never larger than 200 px. Forced to 90 px side by side, the
trace's 4 px clots Ascari and the Lesmos into one blob while the outline stays
legible. One rule as a token — stroke as a fraction of the frame, floored near
1.5 px — would give `VD-03`'s missing scale its first real entry. *(measured;
drove the site · defect)* → **`VD-42`**

**9. `/circuits` prerenders with no drawing at all.** The static register is
30,498 bytes and contains zero SVG — no thumbnails, no *"The traced laps"*
heading. That section is built entirely from the one source that cannot ship in
`f1.db`, and covers 25 of 80 venues. F1DB's outlines — 79 of 80, CC BY 4.0,
already in `f1.db`, already prerendered on `/circuits/:id`, on race pages and in
the season strip — appear nowhere on the register. *(read the build output;
drove the site · defect)* → **`VD-43`**

**10. Three smaller lapses**, folded into **`VD-37`**. `.lapfigure-card` is a
`figure.photo` — 1 px border, panel ground, ruled caption — while
`.outline-card` beside it is bare on a stage-tinted square: one page, one
subject, two objects. `auto-fill, minmax(150px, 1fr)` gives seven columns at
1236 px, so Silverstone's **eighth** outline, the current layout, orphans under
a row of seven (768 px, four columns, is clean; 1440 fails). And `OUTLINE_RULE`
— "the trace is OpenStreetMap's, where it exists" — prints on all 79 circuit
pages including the 55 with no trace, where nothing says this is one of them.
*(drove the site · defects, small)*

---

## What is well made, and should survive

The register's stated scale rule — *"each at its own scale so the shape reads
rather than the size"* — is right for a recognition grid, is written on the
page, and the per-card `km` in mono restores the size fact numerically: a better
answer than the atlas's true-scale toggle, and not to be reopened.
`lib/outline.js` is the best-documented module I read; printing `OUTLINE_RULE`
wherever a shape appears means a reader never guesses which source they see, and
its comment that the outline "borrows none of the trace's colours because it
carries none of the trace's facts" is exactly right — it is the register
thumbnail, not the outline, that broke it. `outlineCaption` marking F1DB's
figures as F1DB's, beside a timeline marking the register's as the register's,
is unusually honest, and both run oldest-first. The caption printing
measured-against-published with a signed delta turns a picture into a check,
which is the whole product in one line, and `LapFigure`'s "there is no
start/finish marker because neither database has that coordinate" is a refusal
to keep verbatim.

## Not examined

Race pages, the season strip and every other surface an outline appears on;
`/circuits` at 320 px; hover, focus and keyboard states on the lap cards; the
throttled cold load and the look of the boot swap (observed that static and app
differ, not how it reads at 4 Mbps); forced-colors and print; colour-vision
simulation, unneeded here because nothing encodes by hue; accessible names
beyond the source. Noted in passing and accessibility's to own: the boot bar's
`slide` animation lacks the `prefers-reduced-motion` guard the site's other two
have.
