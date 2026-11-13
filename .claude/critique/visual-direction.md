# The visual direction

Read by `visual-design-critic` after `.claude/CRITIQUE-BRIEF.md`, and by
anyone building a page who wants to know what the author is aiming at. It
is orientation, not a rule: the rules are `docs/design-system.md`. Written
2026-11-13 (VD-107), when the author found the site "a bit dry and boring,
with some pretty basic graphs and tables".

## The direction

**Mostly data journalism, with some of a broadcast's energy.** A Lap Ledger
page should read like a well-edited sports-data feature: it has a point,
it says it in the title, the chart makes the point before the table
proves it, and the type and colour carry a voice. From the broadcast side
it takes team colour, a number set large when the number is the story, and
contrast; not its motion graphics, sponsor clutter or chrome.

The facts stay as they are. Everything here changes how a fact is shown,
never what it is, and NULL is still an em dash.

## The references, and what to take from each

| Reference | Take | Leave |
|---|---|---|
| **The Athletic** | A sports voice in the headline and standfirst; photography with a crop that means something; one strong colour per story | Paywall chrome, card grids of stories |
| **FiveThirtyEight** (as it was) | Annotated charts: the line labelled at its end, the moment that matters called out on the chart; a house chart style recognisable at a glance | Forecast-model complexity a reader cannot check |
| **The Pudding** | A page built around one question; small multiples; a chart that rewards a second look | Scroll-jacking; anything that hides the value until the reader performs |
| **NYT Upshot** | Story-led titles ("Verstappen's run was longer than anyone's since…"); direct labels, no legends; restraint everywhere but the one mark that matters | A tone too grave for sport |
| **Broadcast F1 graphics** | Team colour as the identity of a row or series; a big numeral for a margin, a gap or a count; high contrast; a tight, confident label face | Motion for its own sake, gradients, glow, sponsor-style lockups |

## What a bolder chart looks like here

The site draws line charts, bar and column charts, dot plots, sparklines,
grid and stint strips, and circuit outlines (`web/src/charts/`). Each can
go further without a new library:

- **A title that states the finding**, generated from the data the way a
  race's standfirst is, above a short label saying what is plotted.
- **Annotation on the chart.** The record, the title-deciding round, the
  first win: marked and named in place, in the label register, with the
  value printed. One to three per chart, never a legend to decode.
- **Direct labels.** A line ends in its driver's or team's name; a bar
  carries its value. A legend is a last resort.
- **Team colour with a meaning.** Series in the team's sourced colour
  (`lib/liveries.js`, 2010 on; racing colours, 1950–1967), others in ink,
  the accent on the one stated value (`[D-61]`).
- **Small multiples** where one chart would overplot: a driver's seasons,
  the circuits a driver won at, a constructor's eras.
- **A big-number moment.** Where the page's figure is the story (a
  championship margin, a winning streak, a record), set it large, with the
  sentence that gives it meaning beside it. Once per page at most.
- **Considered motion.** One authored transition on arrival, at most,
  and none under `prefers-reduced-motion` (§7's floor).
- **The table as a designed object.** The leader marked in the row, team
  colour as a thin rule or mark beside the name, figures in tabular numerals,
  sparklines where a career has a shape.

## What a page with character looks like here

- It opens on its point: a sentence, a number or a picture that only this
  page could have, before the reference furniture.
- Type with more than one voice: a reading face for prose, the label face
  for data, a display setting for the one headline.
- Photography and outlines used as content, cropped and sized with intent.
- One strong colour region per page, owned by the subject's team or era,
  not spread thin across every element.
- Browser defaults themed from the palette: selection, focus ring, scrollbar
  and caret are the cheapest signs a page was built rather than assembled.

## Signs of a generated page

Find them and name them; each is a finding:

- A grid of identical cards (icon, heading, text) standing in for content.
- The big-number hero template: a large figure with nothing that makes it
  this page's figure.
- Eyebrow labels over every heading; numbered section markers; gradient
  text; glass panels; a thick coloured left border as decoration.
- One face, one weight and one case for every voice.
- A palette that could belong to any product: a stock blue, grey on white.
- A sparkline or ring standing in for a figure the reader needed to read.
- Monospace as a "technical" costume rather than for machine text.

## What a bolder design may not cost

- **The floors** in `docs/design-system.md` §7: contrast, keyboard, reduced
  motion, colour never the only cue. A mark in team colour always sits
  beside a printed name or value.
- **The three constraints** in the brief: no lap timing, the geometry file
  kept separate, no colour no source holds.
- **One attribution rule** for every Commons image (`CommonsImage`,
  `CommonsCredit`).
- **The static page and the app agree** (`docs/design-system.md` principle
  4): a direction has to be drawable by `web/scripts/prerender.js` too.

## Credits

The "signs of a generated page" list and the notes on colour by role
distil ideas from Impeccable's critique, colour and craft references
(github.com/pbakaus/impeccable, Copyright 2025 Paul Bakaus, Apache-2.0).
The chart rules draw on Mathews-Tom/armory's chart-clarity skill (MIT) and
Anthropic's knowledge-work-plugins data-visualization skill (Apache-2.0).
Everything is restated in this project's words. Nothing from those
projects is installed, run or fetched.
