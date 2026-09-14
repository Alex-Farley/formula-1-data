/**
 * Team liveries, 2010 onwards - the second colour map, beside the national
 * convention in racingColours.js (AF-04).
 *
 * WHAT IS A FACT HERE AND WHAT IS NOT. racingColours.js is right that no
 * livery hex has a source this project can admit: there is no F1DB field,
 * Wikidata's P465 is empty for every constructor sampled, and formula1.com's
 * CSS values are FOM copyright that nothing here can check. What a source
 * CAN establish is which colour a team raced in a season and what the team
 * called it - "papaya", "Aston Martin Racing Green", "the historic
 * yellow-black livery". That is the fact each entry below carries, with the
 * page it was read from (`source`) and what that page states, in this
 * file's words (`says` - a paraphrase, never a quotation: the first draft
 * put quotation marks round wording the pages did not contain, and the
 * review caught 41 of them, so test/conventions.mjs now refuses a `says`
 * with a quotation mark in it). The team's own launch release or brand page
 * comes first, then formula1.com's launch coverage (source 3-7, facts-only)
 * and the Wikipedia car article - or, for a season no car article
 * describes, the per-season main-colour tables of Wikipedia's Formula One
 * sponsorship liveries article (source 8/11/17 either way). `named` is true only
 * where the cited page shows the name is the team's own term - papaya,
 * Tarocco orange, Rosso Scuderia, Aston Martin Racing Green, heritage
 * white, Titanium; everywhere else `name` is this file's description of
 * what the page describes, and the interface says so rather than claiming
 * the team said it. Nothing in this file enters f1.db.
 *
 * The hex is this palette's rendering of that named colour, not a
 * measurement. Each colour of a scheme carries its own `base`, and the
 * PRIMARY's base is what a mark draws - papaya is #ff8000 on every surface
 * and in both themes (AF-16). It used to be a value moved in lightness
 * until it cleared 3:1 on the surfaces it sits on, which is what turned
 * papaya into #d66c00, matte navy into a mid blue and Mercedes' black into
 * a grey. The maintainer's decision of 2026-09-14 is that the mark is
 * decorative: the team's name is always beside it, so the colour never
 * carries the information alone and WCAG 1.4.11's 3:1 does not reach it.
 * What replaces the shift is an edge rather than a move - styles/app.css
 * rings `.livery` in a colour mixed from the fill and the theme's ink, so
 * the ring is a darker edge of the fill's own hue on a papaya bar and the
 * outline of a white one on a white panel. It reads as an outlined bar
 * either way; what it never does is change the colour inside it. The eight
 * national colours keep VD-27's treatment: those are theme-switching
 * tokens, not values this file holds.
 *
 * `light` and `dark` survive for the one surface where the shift is still
 * owed - a chart series, where a line is told from its neighbour by colour
 * and the legend is the only key, so the colour is doing the work alone.
 * They are the primary's base moved in lightness until each clears 3:1
 * against --panel and --panel-sunk in light, --panel and --panel-raised in
 * dark, and the two ratios in the comment after each pair are the measured
 * minimums; test/conventions.mjs still measures every one of them. Nothing
 * but a chart series may wear the pair - a mark takes the base, through
 * liveryStyle() - and the accents never had a pair and never get one.
 *
 * A SCHEME PER SEASON (AF-15). Until 2026-09-14 an entry carried one
 * colour, and the file said so. A single principal colour cannot express
 * silver-and-teal or white-red-black, and the one it picked was often not
 * the one a fan pictures: Haas and Racing Bulls were the same `#f4f4f4`,
 * so the mark told them apart in neither theme. An entry now carries a
 * `scheme` - a primary and one or two accents, in that order - and the
 * primary is the colour the old entry held. One moved: Mercedes 2026's
 * black, from #16171a to the #111214 every other black here renders,
 * because one palette renders one name once - and it is drawn, on the nine
 * rounds Mercedes won in 2026. Every other primary, and so every other mark
 * on every page, is byte for byte what it was. Making the accents visible
 * is AF-17; rendering a colour as itself rather than contrast-shifted is
 * AF-16.
 *
 * `name` stays the entry's headline - what a caption calls the livery, and
 * usually the primary's own name - and the scheme, not the name, is where
 * the accents are. Haas 2026 is still "White" on the constructor page and
 * white, red and black in its scheme.
 *
 * WHOSE CHOICE EACH COLOUR IS. A scheme is what a reader recognises the
 * team by, which is not always what a page states, so every colour declares
 * both halves of its provenance:
 *   `named`    the team's own term for the colour - papaya, Rosso Scuderia,
 *              Titanium, Audi Red - rather than this file's description.
 *   `sourced`  the entry's cited pages state this colour. False marks a
 *              colour this project added because the team is recognised by
 *              it and no cited page names it - at present two, the red and
 *              silver Toro Rosso ran before its 2017 relaunch, which no page
 *              cited for that span names. The maintainer's decision of
 *              2026-09-14 is
 *              that recognisability wins here - nothing in this file enters
 *              f1.db, so these are presentation values and not database
 *              facts - and that no surface may present one as the team's
 *              official colour. `sourced: false` is what lets a surface
 *              keep that promise, and a colour may not be `named` without
 *              being `sourced`.
 * A mid-season change - McLaren's 2015 switch from silver to black at
 * Spain, Williams dropping red in 2020 - is still a fact the sources record
 * and this map does not: one scheme per constructor-season is what a row of
 * a standings table can show.
 *
 * WHAT IS NOT HERE, AND WHY. LIVERY_GAPS names every constructor-season from
 * 2010 that has race entries and no entry here, with the reason - in every
 * case, no classified source found that states the colour. A gap gets no
 * mark rather than a guess, which is the rule the database applies to a
 * missing figure. test/conventions.mjs holds the two lists to the database:
 * every 2010+ constructor-season is in exactly one of them.
 *
 * The list is currently empty (AF-09). AF-04 left five spans in it, twelve
 * constructor-seasons - Virgin, Marussia and Manor Marussia 2010-2015,
 * Sauber 2010-2011 and 2014, Force India 2016, Williams 2012-2013 - because
 * no car article states those colours, and they are filled from the article
 * that tabulates a main colour per season instead. Empty is a result, not
 * the absence of the rule: the check below still refuses a season in
 * neither list, so the next constructor-season nobody can source is
 * declared here rather than guessed.
 *
 * THE ERAS. colourForEntry() is the one call the pages make, and it routes:
 *   1950-1967   the national racing colour of the constructor's country
 *               (racingColours.js) - the convention that painted a car for
 *               the country that entered it, and the era this record most
 *               owns.
 *   1968-2009   nothing. Sponsor liveries displaced the convention and no
 *               source for this era has been read yet; a surface draws the
 *               neutral series palette or no mark. A declared gap, not an
 *               oversight (AF-04, scope decided 2026-09-13: 2010 onwards).
 *   2010-       this map, or nothing where LIVERY_GAPS says so.
 *
 * HOW A COLOUR REACHES THE PAGE. liveryStyle() returns one custom property,
 * --livery, carrying the primary's base for an element's inline style; the
 * `.livery` rules in styles/app.css paint it and derive the mark's edge
 * from it. One value serves both themes because the colour no longer moves
 * with the theme. A chart series is the exception: charts/LineChart.jsx and
 * charts/Figure.jsx set --livery-light and --livery-dark from the pair and
 * `.livery-series` picks one per theme, exactly as tokens.css does for
 * --racing-*. No component ever chooses a hex.
 */
import { COLOURS, canonicalCountry } from './racingColours.js'

/** The first season the national convention no longer describes the grid. */
export const SPONSOR_ERA = 1968
/** The first season this map covers. */
export const LIVERY_ERA = 2010

export const LIVERIES = [
  {
    constructor: 'ferrari', from: 2010, to: 2025, name: 'Rosso corsa',
    scheme: [
      { name: 'Rosso corsa', base: '#d40000', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
    ],
    light: '#d40000', dark: '#d40000', // 4.76 / 3.02
    source: [
      'https://en.wikipedia.org/wiki/Rosso_corsa',
      'https://en.wikipedia.org/wiki/Ferrari_SF-25',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The Rosso corsa article records that Ferrari kept the traditional red after sponsor liveries replaced national colours in 1968, the shade varying; the SF-25 article notes a darker shade of red for 2025; the sponsorship liveries article gives Ferrari red as its main colour through these seasons, with white and black beside it.',
  },
  {
    constructor: 'ferrari', from: 2026, to: 2026, name: 'Rosso Scuderia',
    scheme: [
      { name: 'Rosso Scuderia', base: '#e30016', named: true, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
    ],
    light: '#e30016', dark: '#e30016', // 4.23 / 3.40
    source: [
      'https://www.ferrari.com/en-EN/formula1/articles/ferrari-unveils-the-sf-26',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'Ferrari says red remains the dominant colour, calls the 2026 shade Rosso Scuderia, brighter and more intense, and notes the return to gloss paint after seven seasons of matte; the sponsorship liveries article gives Ferrari red for 2026, with black, white and blue beside it.',
  },
  {
    constructor: 'mclaren', from: 2010, to: 2014, name: 'Chrome',
    scheme: [
      { name: 'Chrome', base: '#c0c4c9', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
    ],
    light: '#818993', dark: '#c0c4c9', // 3.05 / 9.52
    source: [
      'https://en.wikipedia.org/wiki/McLaren_MP4-29',
      'https://www.formula1.com/en/latest/article/mclaren-liveries-through-the-years.3M1dkzZe78TyKvRN0ZAsht',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The silver-chrome scheme run since 1997; the MP4-29 article records a full chrome livery with black accents after Vodafone left; the sponsorship liveries article gives McLaren chrome as its main colour from 2007 to 2014, with red beside it to 2013 and black in 2014.',
  },
  {
    constructor: 'mclaren', from: 2015, to: 2016, name: 'Graphite grey',
    scheme: [
      { name: 'Graphite grey', base: '#3a3d42', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#3a3d42', dark: '#656a73', // 9.39 / 3.07
    source: [
      'https://en.wikipedia.org/wiki/McLaren_MP4-30',
      'https://www.formula1.com/en/latest/article/mclaren-liveries-through-the-years.3M1dkzZe78TyKvRN0ZAsht',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The MP4-30 was launched in black and silver chrome with red trim and ran black and red from Spain; formula1.com describes 2016 as a darker graphite grey with dayglo keylines; the sponsorship liveries article gives McLaren chrome and black for 2015 and dark grey for 2016, with red beside them.',
  },
  {
    constructor: 'mclaren', from: 2017, to: 2017, name: 'Tarocco orange',
    scheme: [
      { name: 'Tarocco orange', base: '#d95a13', named: true, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
    ],
    light: '#d95a13', dark: '#d95a13', // 3.33 / 4.31
    source: [
      'https://www.mclaren.com/racing/latest-news/mclarenracing/article/colour-by-numbers-6122243/',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'McLaren explains that for 2017 papaya became Tarocco, a darker pearl orange, with black and white elements added; the sponsorship liveries article gives McLaren orange and black for 2017, with white beside them.',
  },
  {
    constructor: 'mclaren', from: 2018, to: 2026, name: 'Papaya',
    scheme: [
      { name: 'Papaya', base: '#ff8000', named: true, sourced: true },
      { name: 'Anthracite', base: '#2e3033', named: false, sourced: true },
      { name: 'Blue', base: '#1f4fbf', named: false, sourced: true },
    ],
    light: '#d66c00', dark: '#ff8000', // 3.01 / 6.62
    source: [
      'https://www.mclaren.com/racing/formula-1/2018/car-launch/mclaren-and-papaya-2174925/',
      'https://www.mclaren.com/racing/formula-1/2026/mclaren-racing-reveal-livery-for-the-mclaren-mastercard-formula-1-teams-2026-challenger/',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'McLaren calls papaya orange the team traditional colour, first on the works cars in 1968 and returned to for 2018 on the fiftieth anniversary of that; its 2026 livery release describes the iconic papaya colour palette alongside anthracite and small hints of teal; the sponsorship liveries article gives McLaren orange for 2018 with blue and black beside it, and orange and black from 2024 to 2026.',
  },
  {
    constructor: 'mercedes', from: 2010, to: 2019, name: 'Silver',
    scheme: [
      { name: 'Silver', base: '#b5b9be', named: false, sourced: true },
      { name: 'Petronas green', base: '#0f9c94', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
    ],
    light: '#818891', dark: '#b5b9be', // 3.08 / 8.46
    source: [
      'https://en.wikipedia.org/wiki/Mercedes_MGP_W01',
      'https://en.wikipedia.org/wiki/Mercedes-AMG_F1_W11_EQ_Performance',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The W01 article records the silver livery unveiled at the Mercedes-Benz Museum in January 2010; the W11 article says black replaced the traditional silver of its predecessors in 2020; the sponsorship liveries article carries Mercedes silver as its main colour across these seasons, with black and green beside it in 2010, green in 2011 and green and black in 2013.',
  },
  {
    constructor: 'mercedes', from: 2020, to: 2021, name: 'Black',
    scheme: [
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'Petronas green', base: '#0f9c94', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://en.wikipedia.org/wiki/Mercedes-AMG_F1_W11_EQ_Performance',
      'https://en.wikipedia.org/wiki/Mercedes-AMG_F1_W13_E_Performance',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The W11 article records black as the primary colour from June 2020; the W13 article says the W11 and W12 were painted black; the sponsorship liveries article gives Mercedes black for 2020, with green and red beside it.',
  },
  {
    constructor: 'mercedes', from: 2022, to: 2022, name: 'Silver',
    scheme: [
      { name: 'Silver', base: '#b5b9be', named: false, sourced: true },
      { name: 'Petronas green', base: '#0f9c94', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
    ],
    light: '#818891', dark: '#b5b9be', // 3.08 / 8.46
    source: [
      'https://en.wikipedia.org/wiki/Mercedes-AMG_F1_W13_E_Performance',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The W13 article records the return of the traditional silver livery; the sponsorship liveries article gives Mercedes silver for 2022, and lists green among its colours in 2010, 2011, 2013, 2020, 2023 and 2026.',
  },
  {
    constructor: 'mercedes', from: 2023, to: 2025, name: 'Black',
    scheme: [
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'Silver', base: '#b5b9be', named: false, sourced: true },
      { name: 'Petronas green', base: '#0f9c94', named: false, sourced: true },
    ],
    light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://en.wikipedia.org/wiki/Mercedes-AMG_F1_W14_E_Performance',
      'https://en.wikipedia.org/wiki/Mercedes-AMG_F1_W15_E_Performance',
      'https://en.wikipedia.org/wiki/Mercedes-AMG_F1_W16_E_Performance',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The W14 article records a black livery of raw carbon and matte black paint to save weight; the W15 a mostly bare carbon and black livery with a silver nose and Petronas teal; the W16 a livery similar to the W15 with more silver on the nose; the sponsorship liveries article gives Mercedes black for 2023, with green and silver beside it.',
  },
  {
    constructor: 'mercedes', from: 2026, to: 2026, name: 'Black and silver',
    scheme: [
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'Silver', base: '#b5b9be', named: false, sourced: true },
      { name: 'Petronas green', base: '#0f9c94', named: false, sourced: true },
    ],
    light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://www.mercedesamgf1.com/news/mercedes-amg-f1-2026-challenger-w17-revealed',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'Mercedes describes a Petronas green line carrying the design from Mercedes silver into the deep black of the rest of the car; the sponsorship liveries article gives Mercedes silver and black for 2026, with green beside them.',
  },
  {
    constructor: 'red-bull', from: 2010, to: 2015, name: 'Dark blue',
    scheme: [
      { name: 'Dark blue', base: '#1b2a5e', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
      { name: 'Yellow', base: '#f5c400', named: false, sourced: true },
    ],
    light: '#1b2a5e', dark: '#4462c9', // 11.74 / 3.05
    source: [
      'https://www.redbullracing.com/int-en/cars/rb9',
      'https://en.wikipedia.org/wiki/Red_Bull_RB12',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'Red Bull Racing describes the RB9 in dark blue and purple; the RB12 article records the change from a glossy to a dark matte blue in 2016; the sponsorship liveries article carries Red Bull dark blue as its main colour to 2012 and dark blue and purple from 2013, with red and yellow beside them in every season from 2007.',
  },
  {
    constructor: 'red-bull', from: 2016, to: 2025, name: 'Matte navy',
    scheme: [
      { name: 'Matte navy', base: '#1c2648', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
      { name: 'Yellow', base: '#f5c400', named: false, sourced: true },
    ],
    light: '#1c2648', dark: '#4d66ba', // 12.73 / 3.12
    source: [
      'https://en.wikipedia.org/wiki/Red_Bull_RB12',
      'https://www.redbullracing.com/int-en/races/season-launch-2026/season-launch-2026-recap',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The RB12 article records the change to a dark matte blue for 2016; the 2026 launch recap describes that year as a return to the gloss finish of 2005; the sponsorship liveries article carries Red Bull navy blue as its main colour from 2016, with red and yellow beside it.',
  },
  {
    constructor: 'red-bull', from: 2026, to: 2026, name: 'Heritage white',
    scheme: [
      { name: 'Heritage white', base: '#f2f2f2', named: true, sourced: true },
      { name: 'Dark blue', base: '#1b2a5e', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#898989', dark: '#f2f2f2', // 3.01 / 14.90
    source: [
      'https://www.redbullracing.com/int-en/races/season-launch-2026/season-launch-2026-recap',
      'https://www.formula1.com/en/latest/article/first-look-red-bull-unveil-striking-new-livery-for-2026-f1-season.61MNwo6zMoxUtOAjS8JH0S',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'Red Bull Racing describes the RB22 livery as a heritage white base in gloss, inspired by the team debut livery of 2005; the sponsorship liveries article gives Red Bull dark blue for 2026, with red, yellow and black beside it.',
  },
  {
    constructor: 'renault', from: 2010, to: 2010, name: 'Yellow and black',
    scheme: [
      { name: 'Yellow', base: '#f5c400', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#a38300', dark: '#f5c400', // 3.11 / 10.15
    source: [
      'https://en.wikipedia.org/wiki/Renault_R30',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The R30 article records the return to the historic yellow and black livery after ING left, with red wing profiles for Total; the sponsorship liveries article gives Renault yellow and black for 2010, with red beside them.',
  },
  {
    constructor: 'renault', from: 2011, to: 2011, name: 'Black and gold',
    scheme: [
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'Gold', base: '#c9a227', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://en.wikipedia.org/wiki/Renault_in_Formula_One',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The Renault in Formula One article records the 2011 team, as Lotus Renault GP, in a black and gold livery last used when Renault and Lotus were partners in the 1980s; the sponsorship liveries article gives the 2011 team black, with gold and red beside it.',
  },
  {
    constructor: 'renault', from: 2016, to: 2020, name: 'Renault yellow',
    scheme: [
      { name: 'Renault yellow', base: '#f5c400', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'Grey', base: '#6f747b', named: false, sourced: true },
    ],
    light: '#a38300', dark: '#f5c400', // 3.11 / 10.15
    source: [
      'https://www.formula1.com/en/latest/article/renault-reveal-yellow-race-livery-for-2016.N7ReUJmKHRk2u4kQHjKo1',
      'https://www.formula1.com/en/latest/article/renault-launch-livery-ahead-of-australian-grand-prix-2020.5td91wEl8K76nvJBd7HdwM',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'formula1.com reports the 2016 race livery in Renault corporate yellow, a nod to the 1977 RS01, and the 2020 livery keeping the yellow and black the works team had run since 2016; the sponsorship liveries article gives Renault yellow for 2016 with black and grey beside it, yellow and black for 2017, and black with yellow and grey for 2018.',
  },
  {
    constructor: 'lotus-f1', from: 2012, to: 2015, name: 'Black and gold',
    scheme: [
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'Gold', base: '#c9a227', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://en.wikipedia.org/wiki/Lotus_F1_Team',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The Lotus F1 Team article records a black and gold livery inspired by Team Lotus in the John Player Special years, with more red in 2013; the sponsorship liveries article gives Lotus black for 2012 and 2015 with gold and red beside it, and black and red for 2013 and 2014 with gold beside them.',
  },
  {
    constructor: 'caterham', from: 2010, to: 2014, name: 'Green',
    scheme: [
      { name: 'Green', base: '#0b5a3a', named: false, sourced: true },
      { name: 'Gold', base: '#c9a227', named: false, sourced: true },
      { name: 'Yellow', base: '#f5c400', named: false, sourced: true },
    ],
    light: '#0b5a3a', dark: '#0f7a4f', // 7.12 / 3.11
    source: [
      'https://en.wikipedia.org/wiki/Lotus_T127',
      'https://www.formula1.com/en/latest/article/caterham-roll-out-striking-new-ct05-in-jerez.2FGEMkqR1yVSsgPyfmA83w',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The T127 article records the historic green and gold Lotus colours for 2010; formula1.com describes the 2014 CT05 in a bold metallic green with white, yellow and black; the sponsorship liveries article gives Caterham British racing green for 2012, with yellow and white beside it.',
  },
  {
    constructor: 'hrt', from: 2010, to: 2010, name: 'Dark grey',
    scheme: [
      { name: 'Dark grey', base: '#4b4e54', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
    ],
    light: '#4b4e54', dark: '#656a72', // 7.18 / 3.06
    source: [
      'https://en.wikipedia.org/wiki/Hispania_F110',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The F110 article records a dark grey livery with a white, yellow and red stripe along each sidepod; the sponsorship liveries article gives HRT dark grey for 2010, with red, white and orange beside it.',
  },
  {
    constructor: 'hrt', from: 2011, to: 2011, name: 'White',
    scheme: [
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
      { name: 'Grey', base: '#6f747b', named: false, sourced: true },
    ],
    light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://en.wikipedia.org/wiki/Hispania_F111',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The F111 article records a primarily white livery with red inserts bordered in black; the sponsorship liveries article gives HRT white for 2011, with red and grey beside it.',
  },
  {
    constructor: 'hrt', from: 2012, to: 2012, name: 'White and gold',
    scheme: [
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Gold', base: '#c9a227', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://en.wikipedia.org/wiki/HRT_F112',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The F112 article records a white, gold and red launch livery, the third change in three seasons, based on Force India 2008; the sponsorship liveries article carries HRT white as its main colour for 2011 and 2012, with red and gold beside it in 2012.',
  },
  {
    constructor: 'force-india', from: 2010, to: 2014, name: 'White, orange and green',
    scheme: [
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Orange', base: '#f26522', named: false, sourced: true },
      { name: 'Green', base: '#0f8a45', named: false, sourced: true },
    ],
    light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://en.wikipedia.org/wiki/Force_India_VJM02',
      'https://en.wikipedia.org/wiki/Force_India_VJM03',
      'https://en.wikipedia.org/wiki/Force_India_VJM07',
    ],
    says: 'The VJM02 article records a white base with green and orange for the Indian flag; the VJM03 article says that livery was retained with new graphics; the VJM07 article records orange, white and green with black replacing much of the white in 2014.',
  },
  {
    constructor: 'force-india', from: 2015, to: 2015, name: 'Silver',
    scheme: [
      { name: 'Silver', base: '#b5b9be', named: false, sourced: true },
      { name: 'Orange', base: '#f26522', named: false, sourced: true },
      { name: 'Green', base: '#0f8a45', named: false, sourced: true },
    ],
    light: '#818891', dark: '#b5b9be', // 3.08 / 8.46
    source: [
      'https://www.formula1.com/en/latest/headlines/2015/1/force-india-unveil-sleek-new-team-livery.html',
      'https://en.wikipedia.org/wiki/Force_India_VJM08',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'formula1.com reports the 2015 livery bringing in silver for the first time; the VJM08 article records the white removed and black, silver, orange and green retained; the sponsorship liveries article gives Force India black and silver as its main colours for 2015, with orange and green beside them.',
  },
  {
    // 2015 is named for the silver its launch coverage says arrived that
    // year. 2016 has no launch source of its own, only the article's
    // main-colour cell, which lists black first - so black is the
    // principal colour here, as first-listed is throughout this map.
    constructor: 'force-india', from: 2016, to: 2016, name: 'Black and silver',
    scheme: [
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'Silver', base: '#b5b9be', named: false, sourced: true },
      { name: 'Orange', base: '#f26522', named: false, sourced: true },
    ],
    light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The sponsorship liveries article gives Force India one row of main colours for 2015 and 2016, black and silver, with orange and green beside them.',
  },
  {
    constructor: 'force-india', from: 2017, to: 2018, name: 'BWT pink',
    scheme: [
      { name: 'BWT pink', base: '#f7a1cf', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
    ],
    light: '#ef439f', dark: '#f7a1cf', // 3.03 / 8.70
    source: [
      'https://en.wikipedia.org/wiki/Force_India_VJM10',
      'https://en.wikipedia.org/wiki/Force_India_VJM11',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The VJM10 article records the pink livery brought by water-treatment sponsor BWT; the VJM11 article records the pink kept on a white base and brighter than before; the sponsorship liveries article gives Force India pink for 2017 with grey, black and magenta beside it, and white and magenta for 2018.',
  },
  {
    constructor: 'racing-point', from: 2019, to: 2020, name: 'BWT pink',
    scheme: [
      { name: 'BWT pink', base: '#f7a1cf', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Blue', base: '#1f4fbf', named: false, sourced: true },
    ],
    light: '#ef439f', dark: '#f7a1cf', // 3.03 / 8.70
    source: [
      'https://www.formula1.com/en/latest/article/racing-point-reveal-their-2019-identity.6qr236jVQ3VJ3p2OzMkB4q',
      'https://www.formula1.com/en/latest/article/racing-point-reveal-2020-f1-car-and-title-sponsor-change.2YWK5q19JTEbR2sAOmNIsj',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'formula1.com reports the team sticking with the pink livery for 2019 and the same pink remaining on the RP20 for 2020; the sponsorship liveries article gives Racing Point pink and blue for 2019 with white, magenta and grey beside them, and pink for 2020 with white and magenta beside it.',
  },
  {
    constructor: 'aston-martin', from: 2021, to: 2026, name: 'Aston Martin Racing Green',
    scheme: [
      { name: 'Aston Martin Racing Green', base: '#00665e', named: true, sourced: true },
      { name: 'Lime green', base: '#b4e600', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
    ],
    light: '#00665e', dark: '#007a71', // 5.90 / 3.19
    source: [
      'https://www.astonmartinf1.com/en-GB/news/feature/aston-martin-racing-green-more-than-just-a-colour',
      'https://www.astonmartinf1.com/en-GB/news/announcement/revealed-2022-f1-car-in-aston-martin-racing-green',
      'https://www.astonmartinf1.com/en-GB/news/announcement/aston-martin-aramco-unveils-livery-for-2026-f1-academy-car',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The team names its colour Aston Martin Racing Green in a feature tracing it to British racing green and its return to Formula One in 2021; a 2022 announcement applies the 2021 Aston Martin Racing Green livery to the AMR22; the 2026 F1 Academy livery release says that car carries the signature Aston Martin Racing Green and mirrors the AMR26 livery; the sponsorship liveries article gives Aston Martin British racing green from 2021 to 2026, with magenta in 2021 and lime green, black and white beside it.',
  },
  {
    constructor: 'sauber', from: 2010, to: 2012, name: 'White',
    scheme: [
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Dark grey', base: '#4b4e54', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://en.wikipedia.org/wiki/Sauber_C32',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The C32 article records that the 2013 car switched from a white base to grey, which places the 2012 base as white; the sponsorship liveries article gives Sauber the same main colours - white and dark grey, with red beside them - in 2010, 2011 and 2012.',
  },
  {
    constructor: 'sauber', from: 2013, to: 2014, name: 'Grey',
    scheme: [
      { name: 'Grey', base: '#6f747b', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#6f747b', dark: '#6f747b', // 4.05 / 3.54
    source: [
      'https://en.wikipedia.org/wiki/Sauber_C32',
      'https://en.wikipedia.org/wiki/Sauber_Motorsport',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The C32 article records the change from a white base to a grey scheme with black, red and white on the sides; the Sauber Motorsport article calls 2013 grey like the early-1990s cars; the sponsorship liveries article gives 2013 and 2014 the same main colours, dark grey and white, with red and silver beside them.',
  },
  {
    constructor: 'sauber', from: 2015, to: 2016, name: 'Blue and yellow',
    scheme: [
      { name: 'Blue', base: '#1f4fbf', named: false, sourced: true },
      { name: 'Yellow', base: '#f5c400', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
    ],
    light: '#1f4fbf', dark: '#2a60dc', // 6.17 / 3.02
    source: [
      'https://www.formula1.com/en/latest/article/sauber-unveil-newly-liveried-c34.3zK6sncNj3fJGgFOHhsKCC',
      'https://en.wikipedia.org/wiki/Sauber_C35',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'formula1.com reports the C34 in a new blue and yellow scheme for Banco do Brasil; the C35 article records the livery unchanged for 2016; the sponsorship liveries article gives Sauber blue for 2015 and 2016, with yellow and white beside it.',
  },
  {
    constructor: 'sauber', from: 2017, to: 2017, name: 'Blue, white and gold',
    scheme: [
      { name: 'Blue', base: '#1f4fbf', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Gold', base: '#c9a227', named: false, sourced: true },
    ],
    light: '#1f4fbf', dark: '#2a60dc', // 6.17 / 3.02
    source: [
      'https://www.formula1.com/en/latest/article/sauber-reveal-new-car-in-anniversary-livery.2VFkeUUfp6ssswIcqI0iqs',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'formula1.com reports the C36 in blue, white and gold for the team twenty-fifth season; the sponsorship liveries article gives Sauber blue for 2017, with white and gold beside it.',
  },
  {
    constructor: 'sauber', from: 2018, to: 2018, name: 'White',
    scheme: [
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
      { name: 'Blue', base: '#1f4fbf', named: false, sourced: true },
    ],
    light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://www.formula1.com/en/latest/article/new-look-sauber-unveil-c37.1Vhc37qyZi24OM0UIuEO8m',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'formula1.com describes the C37 as mostly white with a large red area over the engine cover for Alfa Romeo; the sponsorship liveries article gives Sauber white for 2018, with red and blue beside it.',
  },
  {
    constructor: 'sauber', from: 2019, to: 2023, name: 'Alfa Romeo red',
    scheme: [
      { name: 'Alfa Romeo red', base: '#9a1a1f', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
    ],
    light: '#9a1a1f', dark: '#ce232a', // 7.11 / 3.10
    source: [
      'https://www.formula1.com/en/latest/article/alfa-romeo-reveal-2019-livery-in-barcelona.7a5rOZkmrT3k20lrNBCHYn',
      'https://www.formula1.com/en/latest/article/alfa-romeo-unveil-bold-new-livery-for-2022.3sCyQeW5SPD20W9AeIFD2D',
      'https://www.formula1.com/en/latest/article/first-look-kick-sauber-show-off-dazzling-livery-with-a-slew-of-changes-to.7tUcB0jd4VIdbGNbDmP1Pv',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'formula1.com reports the 2019 C38 in the red and white of 2018 with more red, the 2022 C42 in red and white, and describes the 2024 change as the end of the red and black of the Alfa Romeo years; the sponsorship liveries article gives Alfa Romeo white for 2019 with red and blue beside it, white and red for 2020, red and white for 2022 with black beside them, and red and black for 2023.',
  },
  {
    constructor: 'sauber', from: 2024, to: 2025, name: 'Fluorescent green',
    scheme: [
      { name: 'Fluorescent green', base: '#00e701', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
    ],
    light: '#009a01', dark: '#00e701', // 3.22 / 9.87
    source: [
      'https://www.formula1.com/en/latest/article/first-look-kick-sauber-show-off-dazzling-livery-with-a-slew-of-changes-to.7tUcB0jd4VIdbGNbDmP1Pv',
      'https://en.wikipedia.org/wiki/Kick_Sauber_C45',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'formula1.com reports the C44 in a new fluorescent green and black; the C45 article records the green and black of Stake retained for 2025; the sponsorship liveries article gives Sauber black for 2024 with green beside it, and black and green for 2025.',
  },
  {
    constructor: 'toro-rosso', from: 2010, to: 2016, name: 'Navy blue',
    scheme: [
      { name: 'Navy blue', base: '#0e1f4d', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: false },
      { name: 'Silver', base: '#b5b9be', named: false, sourced: false },
    ],
    light: '#0e1f4d', dark: '#3460da', // 13.68 / 3.04
    source: [
      'https://www.redbull.com/int-en/toro-rosso-2017-launch',
      'https://www.formula1.com/en/latest/article/new-look-toro-rosso-completes-17-launches-in-spain.3hVuD9kCoEUMOoyKWG4Yck',
    ],
    says: 'Red Bull and formula1.com describe the 2017 STR12 as the first major livery change in the team twelve seasons, a departure from its previous navy blue scheme.',
  },
  {
    constructor: 'toro-rosso', from: 2017, to: 2019, name: 'Royal blue',
    scheme: [
      { name: 'Royal blue', base: '#1f4fd0', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
      { name: 'Silver', base: '#b5b9be', named: false, sourced: true },
    ],
    light: '#1f4fd0', dark: '#2e5ee0', // 5.86 / 3.01
    source: [
      'https://www.redbull.com/int-en/toro-rosso-2017-launch',
      'https://www.formula1.com/en/latest/article/new-look-toro-rosso-completes-17-launches-in-spain.3hVuD9kCoEUMOoyKWG4Yck',
    ],
    says: 'Red Bull describes the STR12 in royal blue, scarlet and silver, the blue a shade lighter than Red Bull Racing own and metallic rather than matte.',
  },
  {
    constructor: 'alphatauri', from: 2020, to: 2023, name: 'Navy and white',
    scheme: [
      { name: 'Navy', base: '#1c2c4c', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#1c2c4c', dark: '#4268b4', // 11.94 / 3.07
    source: [
      'https://www.formula1.com/en/latest/article/alphatauri-reveal-striking-2020-livery-after-toro-rosso-rebrand.3zbnWCzu4AyTSLrBYOoReL',
      'https://www.formula1.com/en/latest/article/first-look-alphatauri-reveal-livery-for-2023-at04-at-glitzy-new-york-f1.lnlL0m6mx00T5YtQT3Eyf',
    ],
    says: 'formula1.com reports the AT01 in white and dark blue with a part-matte finish, and the 2023 AT04 in what it calls the team now traditional deep blue and white with red for ORLEN.',
  },
  {
    constructor: 'racing-bulls', from: 2024, to: 2024, name: 'Blue',
    scheme: [
      { name: 'Blue', base: '#2b4bd8', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#2b4bd8', dark: '#415ddc', // 5.83 / 3.04
    source: [
      'https://en.wikipedia.org/wiki/RB_VCARB_01',
    ],
    says: 'The VCARB 01 article records a predominantly blue livery with red pinstriping on white stripes and silver bull logos.',
  },
  {
    constructor: 'racing-bulls', from: 2025, to: 2026, name: 'White',
    scheme: [
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Blue', base: '#2b4bd8', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://www.visacashapprb.com/int-en/2026-car-reveal',
      'https://www.formula1.com/en/latest/article/first-look-racing-bulls-showcase-2026-livery-at-launch-event-in-detroit.ObKtbPEmmdtrnfMHw34pd',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The team describes the 2026 car as keeping the all-white look of 2025, sharpened, with blue accents through the chassis for Ford; the sponsorship liveries article gives Racing Bulls white for 2025 and 2026, with blue, red, yellow and black beside it.',
  },
  {
    constructor: 'virgin', from: 2010, to: 2012, name: 'Black and red',
    scheme: [
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
    ],
    light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The sponsorship liveries article gives Virgin Racing black and red as its main colours in 2010 and 2011, with white beside them, and the same black and red for Marussia in 2012.',
  },
  {
    constructor: 'virgin', from: 2013, to: 2014, name: 'Red and black',
    scheme: [
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
    ],
    light: '#d1262f', dark: '#d1262f', // 4.49 / 3.20
    source: [
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The sponsorship liveries article gives Marussia red and black as its main colours in 2013 and 2014, red listed before black, with white beside them.',
  },
  {
    constructor: 'virgin', from: 2015, to: 2015, name: 'Red and white',
    scheme: [
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
    ],
    light: '#d1262f', dark: '#d1262f', // 4.49 / 3.20
    source: [
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The sponsorship liveries article gives Manor Marussia red and white as its main colours in 2015, with black and blue beside them.',
  },
  {
    constructor: 'virgin', from: 2016, to: 2016, name: 'Red, white and blue',
    scheme: [
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Blue', base: '#1f4fbf', named: false, sourced: true },
    ],
    light: '#d1262f', dark: '#d1262f', // 4.49 / 3.20
    source: [
      'https://en.wikipedia.org/wiki/Manor_MRT05',
      'https://www.formula1.com/en/latest/article/manor-mrt05-breaks-cover-in-barcelona.51AN2McfVTb6Rl38ceHEPm',
    ],
    says: 'The MRT05 article records Manor Racing in a predominantly red and blue livery with flashes of white after the rebrand under Stephen Fitzpatrick.',
  },
  {
    constructor: 'williams', from: 2010, to: 2013, name: 'Dark blue',
    scheme: [
      { name: 'Dark blue', base: '#0a1f5c', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#0a1f5c', dark: '#2b5ce8', // 13.26 / 3.02
    source: [
      'https://en.wikipedia.org/wiki/Williams_FW33',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The FW33 article records the 2011 livery adding white, silver and red to the existing dark blue, in a design inspired by the Rothmans cars; the sponsorship liveries article gives Williams blue in 2010, blue and white in 2011, and dark blue in 2012 and 2013 with white and red beside it.',
  },
  {
    constructor: 'williams', from: 2014, to: 2018, name: 'Martini white',
    scheme: [
      { name: 'Martini white', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Dark blue', base: '#0a1f5c', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://en.wikipedia.org/wiki/Williams_FW36',
      'https://en.wikipedia.org/wiki/Williams_FW41',
    ],
    says: 'The FW36 article records the Martini scheme of white with dark blue, sky blue and red stripes; the FW41 article calls it the fifth and last Williams in Martini colours.',
  },
  {
    constructor: 'williams', from: 2019, to: 2020, name: 'White and blue',
    scheme: [
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Dark blue', base: '#0a1f5c', named: false, sourced: true },
      { name: 'Light blue', base: '#4aa8e0', named: false, sourced: true },
    ],
    light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://www.formula1.com/en/latest/article/williams-show-off-dramatic-new-look-for-2019.pTkktRq2kBUsICx7MHr6v',
      'https://www.formula1.com/en/latest/article.first-look-williams-reveal-striking-new-livery-ahead-of-2020-season-opener.4EiLjnHqlMgA4VCbteqVDx.html',
    ],
    says: 'formula1.com reports the 2019 livery as a white base with blue for ROKiT, and the revised 2020 livery as predominantly white with bands of navy and baby blue and no red.',
  },
  {
    constructor: 'williams', from: 2021, to: 2025, name: 'Williams blue',
    scheme: [
      { name: 'Williams blue', base: '#0f3fa8', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Yellow', base: '#f5c400', named: false, sourced: true },
    ],
    light: '#0f3fa8', dark: '#1e5eeb', // 7.87 / 3.06
    source: [
      'https://www.williamsf1.com/articles/d655080b-9ab9-405d-9e7c-0d6a34aae4d0/williams-racing-unveils-livery-for-the-2021-season',
      'https://www.williamsf1.com/articles/23331a30-bbce-4e5f-b372-1a46f250fe2a/williams-racing-unveils-all-new-fw44',
      'https://www.williamsf1.com/articles/8576c1c3-5ef0-44f3-bc6f-7e2b0073599f/atlassian-williams-racing-unveils-its-2025-formula-1-livery-and-celebrates-new-title-partner',
    ],
    says: 'Williams describes the 2021 livery as blues with white and yellow accents inspired by its 1980s and 1990s cars, the 2022 FW44 as keeping the shades of blue synonymous with the team, and the 2025 FW47 as a gradient from traditional Williams navy to Atlassian blue.',
  },
  {
    constructor: 'williams', from: 2026, to: 2026, name: 'Gloss blue',
    scheme: [
      { name: 'Gloss blue', base: '#1350e0', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#1350e0', dark: '#205dec', // 5.56 / 3.05
    source: [
      'https://www.williamsf1.com/articles/5363520c-1e22-4d62-a568-7f1c7b6ff529/atlassian-williams-f1-team-reveals-bold-new-racing-livery-for-2026',
    ],
    says: 'Williams describes the FW48 lead colour as a vibrant gloss blue, with a sweep of black and a red and white keyline.',
  },
  {
    constructor: 'haas', from: 2016, to: 2018, name: 'Grey and red',
    scheme: [
      { name: 'Machine grey', base: '#8a8e94', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
    ],
    light: '#85898f', dark: '#8a8e94', // 3.03 / 5.07
    source: [
      'https://www.haasf1team.com/news/introducing-vf-16',
      'https://www.formula1.com/en/latest/article/gallery-how-the-haas-liveries-have-evolved-since-2016.USOtK89bvI2Ofk1QicYfR',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'Haas describes the VF-16 in dark grey, light grey and red drawn from Haas Automation machine tools; formula1.com traces the same scheme through 2018; the sponsorship liveries article gives Haas white and black for 2016 with red beside them, dark grey and black for 2017, and black and white for 2018 with grey and red beside them.',
  },
  {
    constructor: 'haas', from: 2019, to: 2019, name: 'Black and gold',
    scheme: [
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'Gold', base: '#c9a227', named: false, sourced: true },
    ],
    light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://www.formula1.com/en/latest/article/haas-unveil-new-black-and-gold-f1-livery-for-2019.3fIfnfT5NoMoLcuitzNJrt',
    ],
    says: 'formula1.com reports the VF-19 unveiled in black and gold for title sponsor Rich Energy.',
  },
  {
    constructor: 'haas', from: 2020, to: 2020, name: 'Grey and red',
    scheme: [
      { name: 'Machine grey', base: '#8a8e94', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
    ],
    light: '#85898f', dark: '#8a8e94', // 3.03 / 5.07
    source: [
      'https://www.formula1.com/en/latest/article/haas-first-to-reveal-2020-f1-car-with-return-to-familiar-livery.DAWhMU78RpQP9tj0kZWAv',
    ],
    says: 'formula1.com reports the VF-20 returning to red, grey, black and white, the Haas Automation colours.',
  },
  {
    constructor: 'haas', from: 2021, to: 2022, name: 'White',
    scheme: [
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
      { name: 'Blue', base: '#1f4fbf', named: false, sourced: true },
    ],
    light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://www.formula1.com/en/latest/article/first-look-haas-reveal-fresh-new-livery-for-schumacher-and-mazepins-f1.18aYd0xdt2TInJj1pdrJcV',
      'https://en.wikipedia.org/wiki/Haas_VF-22',
    ],
    says: 'formula1.com reports the VF-21 in a predominantly white livery with red and blue; the VF-22 article records the same base with red replacing the Russian-flag stripe after Uralkali was removed.',
  },
  {
    constructor: 'haas', from: 2023, to: 2024, name: 'Black',
    scheme: [
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://en.wikipedia.org/wiki/Haas_VF-23',
      'https://en.wikipedia.org/wiki/Haas_VF-25',
      'https://www.formula1.com/en/latest/article/first-look-haas-showcase-new-look-for-2024-challenger-as-livery-is-revealed.4uuvyV9CsnczMsfStIvPsj',
    ],
    says: 'The VF-23 article records the first predominantly dark Haas scheme, in black with red and white; formula1.com describes the VF-24 as an evolution of it; the VF-25 article describes its predecessor as carbon-based before 2025 brought more white.',
  },
  {
    constructor: 'haas', from: 2025, to: 2025, name: 'White',
    scheme: [
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
    ],
    light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://en.wikipedia.org/wiki/Haas_VF-25',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'The VF-25 article records a larger presence of white after the carbon-based VF-24; the sponsorship liveries article gives Haas black and white for 2025, with red beside them.',
  },
  {
    constructor: 'haas', from: 2026, to: 2026, name: 'White',
    scheme: [
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
      { name: 'Red', base: '#d1262f', named: false, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
    ],
    light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://www.haasf1team.com/news/tgr-haas-f1-team-reveals-vf-26-design-livery',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'Haas describes the VF-26 in a new white livery with red accents for TGR Haas F1 Team; the sponsorship liveries article gives Haas white for 2026, with red and black beside it.',
  },
  {
    constructor: 'alpine', from: 2021, to: 2026, name: 'Alpine blue',
    scheme: [
      { name: 'Alpine blue', base: '#2060e0', named: false, sourced: true },
      { name: 'BWT pink', base: '#f7a1cf', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
    ],
    light: '#2060e0', dark: '#2060e0', // 4.74 / 3.03
    source: [
      'https://media.alpinecars.com/alpine-f1-team-launches-2021-campaign/',
      'https://media.alpinecars.com/bwt-alpine-f1-team-reveals-striking-a522-to-the-world-as-new-chapter-begins-in-formula-1/',
      'https://media.alpinecars.com/driving-pink-change-bwt-alpine-formula-one-team-unveils-the-a526-livery-as-formula-one-enters-a-new-era/?lang=eng',
    ],
    says: 'Alpine describes the 2021 A521 in the blue, white and red of its motorsport heritage, the 2022 A522 as predominantly blue with pink for BWT, and the 2026 A526 as its traditional blue with BWT pink.',
  },
  {
    constructor: 'audi', from: 2026, to: 2026, name: 'Titanium',
    scheme: [
      { name: 'Titanium', base: '#a9abae', named: true, sourced: true },
      { name: 'Audi Red', base: '#cc0033', named: true, sourced: true },
      { name: 'Black', base: '#111214', named: false, sourced: true },
    ],
    light: '#84878b', dark: '#a9abae', // 3.11 / 7.25
    source: [
      'https://www.audi-mediacenter.com/en/press-releases/premiere-in-berlin-audi-revolut-f1-team-officially-unveiled-16997',
      'https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries',
    ],
    says: 'Audi names Titanium and the newly introduced Audi Red as the colours of the livery, and says Titanium references its motorsport tradition; the sponsorship liveries article gives Audi silver, red and black for 2026.',
  },
  {
    constructor: 'cadillac', from: 2026, to: 2026, name: 'Black and white',
    scheme: [
      { name: 'Black', base: '#111214', named: false, sourced: true },
      { name: 'White', base: '#f4f4f4', named: false, sourced: true },
    ],
    light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://www.cadillacf1team.com/news/cadillac-formula-1-r-team-reveals-historic-first-livery',
      'https://www.formula1.com/en/latest/article/cadillac-explain-why-they-decided-on-a-split-black-and-white-livery-for.1ZLWVrXOK1BQCoxNaw12iW',
    ],
    says: 'Cadillac describes a split black and white livery, black for the team attitude and white as the racing colour of America.',
  },
]

/**
 * Constructor-seasons from 2010 with race entries and no livery above. Each
 * is a fact nobody here holds yet; filling one means finding the source and
 * moving the span into LIVERIES, and test/conventions.mjs fails a span that
 * is in both lists or in neither.
 *
 * Empty since AF-09 sourced the last five spans AF-04 left. The list and
 * its check stay: the next constructor-season nobody can source is declared
 * here rather than guessed.
 */
export const LIVERY_GAPS = []

/**
 * True in a season some row of which could carry a colour - before 1968 or
 * from 2010 - and false in the declared gap between, where a table draws no
 * mark and no spacer.
 */
export const inColourEra = (year) => {
  const y = Number(year)
  return Number.isFinite(y) && (y < SPONSOR_ERA || y >= LIVERY_ERA)
}

/** A livery's primary colour: the first of its scheme. */
export const liveryPrimary = (livery) => livery.scheme[0]

/** A livery's accents: the rest of its scheme, in order. Often empty. */
export const liveryAccents = (livery) => livery.scheme.slice(1)

/** The livery entry for a constructor in a season, or null. */
export function liveryFor(constructorId, year) {
  if (!constructorId || !Number.isFinite(year)) return null
  return LIVERIES.find((l) => l.constructor === constructorId && year >= l.from && year <= l.to) ?? null
}

/** True where LIVERY_GAPS declares this constructor-season unfilled. */
export const isDeclaredGap = (constructorId, year) =>
  LIVERY_GAPS.some((g) => g.constructor === constructorId && year >= g.from && year <= g.to)

/**
 * The inline style that carries a colour to an element the `.livery` rules
 * paint: one custom property, --livery, holding the primary's base. One
 * value serves both themes - the mark draws the colour itself (AF-16) - and
 * app.css derives the mark's edge from it, so a white livery on a white
 * panel is outlined rather than moved. A national colour is already a
 * theme-switching token and passes through as one.
 */
export const liveryStyle = (livery) => (livery ? { '--livery': liveryPrimary(livery).base } : undefined)

/**
 * The colour a constructor raced in a season, routed by era (see the
 * header), as { kind, name, named, base, light, dark, source, style, title,
 * claim } or null.
 *   team    the constructor's name, for the title; the id stands in without it
 *   kind    'livery' or 'national'
 *   named   true where `name` is the team's own term (see the header)
 *   base    the colour itself, which is what a mark draws (AF-16)
 *   light   the pair a CHART SERIES wears, and nothing else: the base moved
 *   dark    until it clears 3:1 in that theme, because a series is told from
 *           its neighbour by colour alone. A mark takes `style`, never these
 *   scheme  the primary and its accents, each { name, base, named, sourced };
 *           a national colour is a scheme of one
 *   claim   "as the team names it" or "as its sources describe it" - the
 *           clause every surface appends, so no surface says the first
 *           where only the second is true
 *   title   the sentence a tooltip says, naming the claim being made
 */
export function colourForEntry({ constructorId, country, year, team }) {
  const y = Number(year)
  if (!Number.isFinite(y)) return null
  if (y < SPONSOR_ERA) {
    const entry = COLOURS[canonicalCountry(country)]
    if (!entry) return null
    const css = `var(--${entry.token})`
    return {
      kind: 'national',
      name: entry.name,
      named: false,
      scheme: [{ name: entry.name, base: css, named: false, sourced: true }],
      base: css,
      light: css,
      dark: css,
      source: null,
      style: { '--livery': css },
      claim: 'the convention, not the team\'s own livery',
      title: `${entry.name} — the racing colour of ${canonicalCountry(country)}, the convention that painted a car for the country that entered it`,
    }
  }
  if (y < LIVERY_ERA) return null
  const livery = liveryFor(constructorId, y)
  if (!livery) return null
  const who = team ?? constructorId
  const claim = liveryClaim(livery)
  return {
    kind: 'livery',
    name: livery.name,
    named: liveryPrimary(livery).named === true,
    scheme: livery.scheme,
    base: liveryPrimary(livery).base,
    light: livery.light,
    dark: livery.dark,
    source: livery.source,
    style: liveryStyle(livery),
    claim,
    title: `${livery.name} — the colour ${who} raced in ${y}, ${claim}`,
  }
}

/** The clause that says whose word the primary's name is: the team's, or this file's reading of its sources. */
export const liveryClaim = (livery) =>
  liveryPrimary(livery).named === true ? 'as the team names it' : 'as its sources describe it'

/** The host a source was read from, for a caption: "mclaren.com", "en.wikipedia.org". */
export const sourceHost = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * The colour a calendar round's winning constructor raced in, for the mark
 * under a round in the season strip (components/Outline.jsx and
 * scripts/prerender.js draw the same bar from this): null for a round not
 * yet run, a round with no recorded winner, or a season with no colour.
 */
export const winnerColour = (round, year) =>
  round.status === 'completed' && round.winning_team_id
    ? colourForEntry({
        constructorId: round.winning_team_id,
        country: round.winning_team_country,
        year,
        team: round.winning_team,
      })
    : null
