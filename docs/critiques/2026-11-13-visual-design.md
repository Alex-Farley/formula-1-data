# Visual critique: lapledger.org, 2026-11-13

**Outcome (the maintainer, on the design review page, 2026-11-13).** Approved
as mockups and filed: P01, P03, P04, P08, P10, P11, P12 and P13 (VD-108 to
VD-115), with their mockups in `2026-11-13-visual-design/`. Sent back for a
second version: P02, P05, P07 and P09 ("labels handled more gracefully") and
P06 ("the idea works, but the styling is very boring"); all five second
versions were approved on 2026-11-14 and filed as VD-121 (P09v2, which sets
the shared annotation pattern), VD-122 (P06v2, with the rule that a team-mate
from the same team takes that team's second livery colour), VD-123 (P02v2),
VD-124 (P05v2, IX-50 declined in its favour) and VD-125 (P07v2). Of the defects with no
mockup, all were filed: 1 to 3 as one tidy batch (VD-116), 4 (VD-117), 8
(VD-119), 9 (VD-118) and 11 (VD-120). Items 5 to 7 are carried by the revised
charts, 10 by P13 and AF-98, and 12 by IA-30. The `proposals.json`, `shots/`
and `mockups/` named below were the critic's working folder; only the approved
mockups are kept.

Built from main at 9c548a8, served locally and driven with Playwright Chromium. The pages:

- home;
- /races/2026/20 and /races/1985/2;
- /drivers/norris and /drivers/clark;
- /constructors/ferrari and /constructors/mclaren;
- /seasons/2026 and /seasons/1976;
- /circuits/monza;
- /records and /records/most-consecutive-wins;
- /compare.

Each page was captured at 400 and 1440 px in both themes, as full pages first and then as regions. It is judged against `docs/design-system.md` (version A) and `.claude/critique/visual-direction.md`. Thirteen proposals follow, each with a before and after at both widths: `proposals.json`, `shots/` and `mockups/`. Every mockup is a static sketch that links the site's built CSS (and so `tokens.css`) and uses figures read from `f1.db`. Team colour appears only where `lib/liveries.js` holds it, and no chart mixes liveries with the accent (D-61). Nothing has been filed.

## The three that matter most

1. **The charts show data but make no point.** The site already has the right number of charts in the right places. Every one of them stops at "here is the data": no chart has a title that states a finding, and not one carries an annotation beyond a single max label. Each leaves the reader to find the story the page's own lede has already told. 1976's title chart does not mark the Nürburgring. Ferrari's chart does not mark a title. The grid-to-flag chart draws Verstappen's 21st-to-2nd in the same grey as everyone else. Adding one house pattern, an annotation register with a finding title, kicker, on-chart labels and end labels, to §3 Figure under §8 turns five charts into journalism at S size each: P02, P04, P05, P07 and P09. Nothing queued does this, and it is the cheapest route to the "data journalism" brief. *Ambition; drove the site.*
2. **The first screens show the reference furniture before the story.** On home, a fan first meets "Qualifying rows 27,149" and "Standings rows 34,771" (P01). The race page puts its winner in a tile beside "Entries 22" (P03). A record page opens on a sentence set at hero size and a field list of Category, Family, Unit and Key (P12). In each case the page's point is in the data and absent from the opening. *Ambition with a defect in it (home's hero figure is the generated-page "big number" the direction warns of); drove the site.*
3. **Team colour is sourced, careful and almost unused where it could carry identity.** The livery work (the scheme per season, the light and dark pairs, D-61) is the most distinctive asset the site has. Most of it surfaces only as a 10 × 16 px mark beside a name, a single-colour band under a constructor's lede, and the dots of two charts. The ribbon (P08), the podium (P03, P01) and standings bars (P10) use what the data already holds. *Ambition; read the source (`lib/liveries.js`) and drove the site.*

## What is well made, so the fixes keep it

- **The season calendar strip** (/seasons/*): 23 F1DB outlines, each with its winner's livery rule, run, next and to come. This is the most characterful element on the site and the model for the rest. Keep it exactly.
- **The type system.** Saira Condensed for display, Saira for text and labels, tabular figures in every column (22 `tabular-nums` rules), nothing under 11 px, and monospace kept for machine text. It reads as one voice at every size checked. The VD-91 label register removed the generated look the October review found.
- **The paper-and-ink palette** in both themes. Dark is genuinely a second instrument: the warm `#100c0a` ground, the lifted racing colours and the liveries all hold their contrast. Light and dark side by side show no inversion artefacts (contact shots in `../raw/`, and `../raw/dark-P05.png` and `dark-P10.png` for mockups in dark).
- **The rules-not-boxes discipline** (VD-93). Tiles, cards and doors under a rule on the paper. The frame is kept for figures and tables only.
- **The reference density at 1440** (VD-95). Classification rows at about 24.5 px scan like Basketball-Reference without losing the 24 px target.
- **D-61 in practice.** The records leaderboards (ink plus one accent on the holder) and the constructors bar chart (liveries, hollow where unsourced, no accent) are both correct and legible.
- **Grid to flag, Where winners start and the stint figure** are distinctive chart types few F1 sites have. They need emphasis, not replacing.
- **Monza's "Race by race" chips** by decade, with livery marks: dense, legible, and they reward a second look.

## Defects and drift with no mockup

Each is tagged and placed, and carries its evidence.

1. **Home: "Where winners start at Las Vegas Strip Circuit" draws a 100 px figure in a 1,232 px frame** (1440, both themes; measured). Three dots sit top-left in a box that is mostly empty. The figure should take the drawing's width, as a lead chart takes the slot, or scale the grid up to a minimum. *Defect, S; drove the site.*
2. **/seasons/2026: the calendar table overflows its box by 55 px at 1440**, so *Fastest lap* is clipped behind the fade on a desktop. It is a page's subject table, so IX-45's "a table that fits its box" (provisional) should reach it: `.wraps` on Grand Prix, Circuit and Winner. That would also be IX-45's second page, which is what §8 needs to promote it. *Defect, S; measured.*
3. **/seasons/2026: a stray sentence**, "Traced from OpenStreetMap: 6.323 km against 6.201 km published here (+1.96%). © OpenStreetMap contributors, ODbL-1.0.", sits at body size under the timetable in *The next round*, belonging to no box. It is text that belongs to the outline card. *Drift against §3 the text-width rule, kind 2 (built, VD-78/VD-80/VD-86); drove the site.*
4. **Ferrari's two win totals.** The Ferrari page's Wins tile and *Every win* say 251, while /records' "Most Grand Prix wins by a constructor" and the constructors chart say 250. The difference is the 1956 Argentine Grand Prix, a shared Ferrari win (Fangio/Musso) that the tile counts per entry and the chart counts once, "to the car", a rule the Ferrari chart's own note states. Two numbers for one fact on adjacent pages. *Defect; queried the database. Content or data owns the fix; filed here because it shows.*
5. **Tied maxima get one label.** Ferrari's wins chart labels "15" on 2002 only, though 2004 also has 15. The same logic sits in `charts/columnChart.js` for every constructor. *Defect, S; fixed in P07's sketch.*
6. **End labels collide on converging lines.** /seasons/1976 shows "69" and hides Lauda's 68. /seasons/2026 shows 390 and 279 and hides Russell's 262. The direct label is the chart's main cue. *Defect, S; fixed in P09.*
7. **Driver championship chart:** the "P11" tick sits on "2019" at the bottom-left at 1440 (Norris, Clark). IX-50 has the phone half. *Defect, S; fixed in P05.*
8. **The disagreement box heading** ("Two sources disagree about this career") is an `h2` set by `.disagreement h2` at `--size-4` in the condensed display face: a 13.5 px condensed bold heading, the smallest display setting on the site and tight at low DPI. §2's role table gives an h2 `--size-7`. Either declare a box-heading role in the label register or set it as one. *Drift against §2 Type, role table (built), or an undeclared role; read the CSS.*
9. **No browser default is themed.** The built CSS has no `::selection`, `accent-color`, `scrollbar-color` or `caret-color`. The visual direction names these as "the cheapest signs a page was built rather than assembled". About an hour: selection in `--accent-wash`, `accent-color: var(--accent)` on the toggle and form controls, and a warm scrollbar. *Ambition, S; read the CSS.*
10. **Records phone layout** (fixed in P13) and **records "Championships" table**. The latter's *How it is derived* column prints SQL-flavoured prose ("seasons.drivers_champion whose drivers.died falls before…") at full width in a fan-facing table. *Defect; AF-98 owns the explanations.*
11. **Livery collisions in one chart.** On /records' constructors chart, Red Bull's navy and Williams' blue sit in adjacent bars and are nearly the same at a glance. In 2026 Racing Bulls, Alpine and Williams are three close blues. Names are always beside them, so this does not breach the floor. A sort or a one-pixel outline per bar would help. *Taste or ambition, S.*
12. **The phone masthead** takes about 130 px (wordmark, search, toggle, two rows of eight links) before the h1. *Defect at 400; IA-30 owns it.*

Examined and cleared:

- the grid and edges at 1440 and 400 on driver, race and circuit (they land on the system's lines);
- tabular figures in every numeric column;
- dark-theme contrast on every chart checked;
- §3 Figure's frame, note band and numbers disclosure on every figure (consistent);
- the tile strip's subgrid baselines (they hold);
- the photo strip's columns (four, two and one).

## The proposals, and why each

**Home.**

- **P01** replaces the database's inventory with the season. It moves home's hero from "Rounds run 20 of 23" to the leader's 111-point margin, because the hero rule forbids a name and the margin is the season's figure. It keeps the podium beyond the three-day results window.
- **P02** is the smallest test of the annotation register: three labels and a title on a chart already there. Its 2026 split into 20 run and 3 to come also corrects what the red bar currently says.

**Race.**

- **P03** gives a race page the broadcast podium the site already owns. It is the podium's second page, so §8 promotes it.
- **P04** is the clearest case for emphasis by ink weight under D-61 rule 2. The winner stays the one accented value, and the race's story is drawn in full ink.

**Driver.**

- **P05** turns the lead chart into a career (line, labels, two annotations) and absorbs IX-50.
- **P06** draws the comparison the team-mates table exists for. It is the one new chart type here, and the one most likely to be shared.

**Constructor.**

- **P07** puts titles on the chart (a shape cue, not colour), fixes the tie defect and points at the drought.
- **P08** makes the livery history visible. It should be the same component as VD-104 (c)'s season plates.

**Season.**

- **P09** is the model annotated chart: 1976's story told on its own lines, end labels instead of a legend, and the season page's first big number (the 1-point margin), all from race_entries and standings.
- **P10** is the standings-table instance of VD-105 and VD-106. It is better built as part of those items than separately.

**Records.**

- **P11** splits records.value into number and context, which fixes the uneven cards, and brings the runner-up gap from the method prose onto the card.
- **P12** gives a record page a point: the number, the ten races as outlines, and the ranked runs. It carries PD-61 and VD-104 (a).
- **P13** is a straight phone defect fix, borrowing the reach chart's own narrow layout.

**One extension serves five proposals.** P02, P04, P05, P07 and P09 all need the same three parts: a finding title over a kicker, annotations in the label register with a panel halo, and end labels with collision nudging. Built once in `charts/` and drawn by both renderers, the register makes each of those five an S. Its rules should go in §3 Figure under §8:

- one to three annotations per chart;
- the value always printed;
- never the only cue;
- the title generated from data, as the race standfirst is.

**Circuit, not mocked up.** Monza's aerial photograph is a 290 px thumbnail beside its outline. AF-96 (the track drawn over the aerial) is the right ambition and should also enlarge the photograph to the header's seven columns. I would not mock AF-96 without the geometry registration it needs. **/compare** opens empty, two selects with no default pair (IX-43 owns the pickers). A default comparison, such as the two drivers at the top of the current standings, would make it a page and not a form.

## The provisional components: promote, merge or drop

| Component | Verdict |
|---|---|
| Opening slot on home (VD-92) | Promote; keep the outline beside P01's plate |
| A string with no break (AF-110) | Promote; it is a rule and already site-wide |
| Weather line (AF-142) | Keep provisional; one page by nature. Well made |
| Reach chart (AF-132) | Promote: season pages and home's results state are two pages |
| Starting grid, dot strip, chips (AF-133) | Promote the chips. Fix the grid's sizing (defect 1) before promoting the grid |
| Stint figure and pit wave (AF-134) | Keep; one page |
| Table that fits its box (IX-45) | Extend to the season calendar (defect 2), then promote on that second page |
| Reference density (VD-95) | Promote |
| *How it is derived* disclosure (AF-131) | Promote; the record cards use the same pattern |
| Row mark (DA-46) | Keep |
| Index (VD-93) | Promote as a home-only component, declared |
| Site footer (IA-31) | Promote; it is on every page |
| Season cycle (AF-135, AF-156, AF-143) | Promote the podium via P03. Keep the weekend lap and forecast provisional |
| Livery mark in prose (VD-45) | Promote |

## What I did not examine

- Interaction, cold-load and handover behaviour, beyond noting that the static home (build day) and the app (reader's day) show different season states, which is by design.
- Widths of 320 and 768 (I captured 400 and 1440 as asked).
- Car, era, Grand Prix and /data pages.
- Favicon and wordmark at their smallest sizes.
- Reduced motion.
- Mockups in dark beyond P05 and P10. All mockups use the light and dark livery pairs and theme tokens, so they should hold.
- Accessibility tooling: no axe run on the mockups.
