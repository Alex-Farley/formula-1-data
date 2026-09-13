# Design review — 2026-09-13

**Author:** the maintainer's agent, synthesising four independent critics run
the same day (`2026-09-13-{product-design,information-architecture,visual-design,interaction-design}.md`)
with its own reading of the source, the committed databases, the live site at
1280 px and on a phone, and the licences of the open track-geometry sources.
**Subject:** `main` at `aed5fb5`, v2.23.
**Brief:** the maintainer's seven asks — a more exciting design language;
better track visualisation, possibly with telemetry replays; a focused
current-season area with driver, car and track profiles and more imagery;
correct constructor colours for the current season and past seasons where
possible; more sensible tables with choosable fields; natural-language search;
anything a subject-matter expert would add. The published review, with the
drawings, is at
https://claude.ai/code/artifact/1e4fd5ce-d099-4cc9-8354-f34118c8c8f3.

**The repository was not modified** by the review. The backlog edit that files
its items is a separate change.

---

## The two findings that outrank everything else

**1. The current season is rendered in the 1950 template.** Three critics found
it independently (`IA-17`, `VD` finding 1, `PD-28`). With 13 of 23 rounds run,
`/seasons/2026` heads its tables *Final drivers' standings* and its chart *How
the title was decided*; the `/seasons` row for 2026 is seven em dashes; `/races`
sorts ten unrun races above the last one run; the one hourly-changing sentence
on the site is an unstyled paragraph. The season page already computes the
right figures. No ninth nav item: a season page that branches on status, a
`/now` redirect, one "2026" chip on all four registers.

**2. F1DB ships an outline for every layout the championship has raced on.**
Pointed out by the maintainer during the review. F1DB (source 10, CC BY 4.0)
added circuit layouts in v2026.0.1, schema 6.4.0: `src/assets/circuits/` holds
**160 layout SVGs for 78 circuits** in four styles (black, black-outline,
white, white-outline), 500×500, ~1.7 KB each, drawn by one contributor (Jules
Roy), not bundled in the release zip. Every F1DB race record carries
`circuitLayoutId` (2026 r13: `monza-7`), so race-to-shape is data. Ten circuit
ids differ from this project's (`melbourne`/`albert-park`, `austin`/`cota`,
`montreal`/`gilles-villeneuve`, `spielberg`/`red-bull-ring`,
`mexico-city`/`rodriguez`, `spa-francorchamps`/`spa`,
`hockenheimring`/`hockenheim`, `bugatti`/`le-mans-bugatti`,
`clermont-ferrand`/`charade`, and one `nurburgring` for the three Nürburgring
rows); aliased, the set covers all 80 venues, all 23 rounds of 2026 (Madring
included), and historic layouts — seven Monzas, eight Silverstones, six
Catalunyas — that OpenStreetMap structurally cannot hold. F1DB's year ranges
for layouts live only in YAML comments; the per-race id is the join. This
project's own `circuit_layouts` (51 rows, 13 circuits) is finer in places
(nine Monzas to F1DB's seven) and should keep its splits with a column naming
the F1DB layout each draws with.

What the outlines are not: geo-referenced, scaled, directed or elevated. They
cannot do true-scale comparison, corner-radius colouring or walking the lap in
metres. The rule for the site becomes two sentences, printed where a shape
appears: *the outline is F1DB's, for every layout ever raced; the measured
trace is OpenStreetMap's, where one exists and agrees with the published
length.* Both, not either. → **`AF-03`**.

Two other open geometry sources were checked and set aside: TUMFTM's
racetrack-database is LGPL-3.0 and derived from OpenStreetMap, so it inherits
ODbL's reach and adds nothing F1DB does not; bacinger's f1-circuits is MIT, 43
circuits, traced from Google Maps imagery, which raises a provenance question
this project would have to answer. Wikimedia Commons holds SVG circuit maps for
many venues under mixed per-file licences; F1DB's set is uniform and already
classified.

## The verdict board

| Ask | Verdict | Cost | In one line |
|---|---|---|---|
| A more exciting design language | Reshape | M | Keep Pit Wall. The flatness is uniform cards, equal-weight tiles, an accent spent on decoration, and 602 photographs advertised and not shown. `VD-25`–`VD-34`. |
| Track layouts | Build | M | `AF-03`. |
| Telemetry replays | Decline | — | Every lap-time source is FOM-owned or CC BY-NC-SA (OpenF1 now says so on its own site). Say so on the site (`PD-29`); draw the three lap-referenced charts the database permits (`PD-30`). |
| A current-season area | Build | M | `PD-28`, with `IA-17`, `IA-18`, `IA-19`. |
| Correct constructor colours | Build, narrowly | M | No admissible *data* source (`PD-31` upheld for `f1.db`). A presentation palette keyed by constructor-season, 2026 first then back to 2010, each hex sourced to the team's own brand material, a light and a dark value each (`AF-04`); the national convention stays for 1950–67. |
| Better tables, choosable fields | Reshape | M | `IA-08` first, then `IA-23` with `IX-27`; collapse constant columns (`VD-29`); default sorts (`VD-30`); sticky headers that stick (`IX-18`). |
| Natural-language search | Reshape | M | `IA-20`: widen the index, an intent grammar and a forty-question library now; generated SQL is a decision because the question has to leave the tab. |
| What an expert would add | Build | S each | Practice results, fastest laps and driver of the day are in F1DB and not here (`LV-03`); grid penalties, tyre allocations, title permutations, the qualifying-format history (`PD-35`, `WK-01`, `WK-03`). |

## Telemetry, once more

| Source | Has | Licence | Ship it? |
|---|---|---|---|
| Jolpica-F1 | lap times 1996– | CC BY-NC-SA 4.0 | No |
| FastF1 | laps, sectors, telemetry 2018– | FOM live-timing data | No |
| OpenF1 | telemetry, positions 2023– | CC BY-NC-SA 4.0, FOM data | No |
| F1DB | classification, qualifying, pit stops with lap numbers, practice | CC BY 4.0 | Yes, and already here |

Admissible today and undrawn: grid position against finish position with
retirements falling out at the lap they stopped, every race since 1950; stint
windows from pit-stop lap numbers, 610 of 614 races since 1994; gap to pole
from 26,756 qualifying rows. All three prerender as static SVG in `Figure.jsx`'s
convention. → `PD-30`.

## Constructor colours

`racingColours.js` is right that no livery may enter `f1.db`: F1DB has no
colour field, Wikidata's P465 is empty for every constructor sampled,
formula1.com's values are FOM copyright and uncheckable here. It is also right
that it already holds a presentation palette and that swapping the map is the
whole job. `AF-04` is a second map beside the first, keyed by constructor and
season: 2026 first, then back to 2010 (about 180 constructor-seasons); every
hex with its source in the file (press kit, brand guideline, launch release);
every entry a `{light, dark}` pair clearing 3:1 against the panel, which also
fixes the six of eight national swatches that fail today (`VD-27`); the colour
named as the team names it; never in the database. 1968–2009 is a declared gap
drawn in the neutral series palette until filled. Retire the accent bar on stat
tiles so rosso corsa and the interactive red stop measuring 1.002:1 (`VD-26`).

## Sequence

**Now** — defects, each S, plus the one M with the largest visual return:
`IA-17`, `AF-03`, `VD-26`, `VD-27`, `VD-25`, `VD-28`, `PD-19`+`PD-20`, with
`PD-02` kept.
**Next, visual** — `PD-28`, `AF-04`, `VD-34`, `PD-30`, `VD-32`, `VD-33`,
`VD-29`, `VD-30`, `IA-08`→`IA-23`+`IX-27`, `IX-18`, `IX-20`, `IX-26`, `IX-28`,
`IX-19`, `IX-24`+`PD-21`+`PD-22`, `PD-15`, `PD-16`, `VD-01`, `VD-03`.
**Next, the other asks** — `IA-20` (+`IA-21`, `IX-22`, `IX-23`), `PD-29`,
`PD-35`, `IA-22`, `IX-21`, `IX-25`.
**Declined** — telemetry replays; a ninth masthead item; a new visual identity;
livery colours inside `f1.db`.

## Assumptions to flag

Team colours in the review's mock are illustrative and labelled so; Audi and
Cadillac were left grey rather than guessed. Winners in the calendar strip
come from `race_entries`. The critics ran on a fresh build of `main` and the
live site, not on real users (`PD-Ø` still stands).
