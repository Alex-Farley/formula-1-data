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
 * the ring is the fill carried towards that ink - darker than a papaya bar
 * in light and lighter than it in dark, the fill being one value and the
 * ink two - and the outline of a white bar on a white panel. It reads as
 * an outlined bar in either theme; what it never does is change the colour
 * inside it. The eight national colours keep VD-27's treatment: those are
 * theme-switching tokens, not values this file holds.
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
 * because one palette renders one name once. Every other primary was byte
 * for byte what it had been. Making the accents visible is AF-17; rendering
 * a colour as itself rather than contrast-shifted is AF-16; which colour
 * leads a mark is AF-45, below.
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
 * WHICH COLOUR LEADS A MARK (AF-45, AF-46). The scheme's order is the car's:
 * its primary is what the cited pages say the car mostly was. That is not
 * always the colour a reader recognises the team by - Red Bull's 2026 car
 * is heritage white and the team is navy; Mercedes' cars were silver or
 * black and the team is Petronas green. RECOGNITION holds one colour per
 * constructor, for all its seasons, and it is this project's reading - the
 * maintainer's calls of 2026-09-17 - which no cited page states. A mark
 * (liveryPair) draws two colours: that recognition colour, lifted to the
 * front of the season's scheme, and the next colour still standing. Where a
 * season's scheme has no colour near the recognition colour - McLaren
 * before its papaya, Williams in its older blues - the season's sourced
 * primary leads unchanged, because a papaya mark on a chrome car would
 * assert a livery no source supports. The band on a constructor's or a
 * driver's page is not a mark: it draws the season's whole scheme in the
 * car's order and says what the car raced in. So a 2014 Mercedes mark is
 * teal while the band names that livery Silver, and the two sentences - the
 * mark's "recognised by", the band's "raced in" - are what keep both true.
 * A CHART SERIES follows the MARK, not the band (AF-57). Its `light`/`dark`
 * pair renders the pair's lead, so the Mercedes line on the title-race
 * chart is the teal of the mark in the standings table beside it, and not
 * the black of the car. AF-45 gave every mark a recognition-led lead and
 * left the chart pair on the primary, which drew the same team in two
 * colours on one page; test/conventions.mjs now holds the pair to the lead,
 * so the two cannot part again.
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
 * HOW A COLOUR REACHES THE PAGE. Two custom properties on an element's
 * inline style: --livery, the leading colour's base, and --livery-scheme,
 * the rest as hard gradient stops (AF-17), absent for a single colour. A
 * band takes liveryStyle() - the primary and the whole scheme - and a mark
 * takes pairStyle() - the recognition-led pair (AF-46). The `.livery` rules
 * in styles/app.css paint the first, draw the second over it and derive the
 * edge from the first. One value each serves both themes because
 * the colour no longer moves with the theme. A chart series is the exception: charts/LineChart.jsx and
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
    light: '#0f9991', dark: '#0f9c94', // 3.02 / 4.93, Petronas green
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
    light: '#0f9991', dark: '#0f9c94', // 3.02 / 4.93, Petronas green
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
    light: '#0f9991', dark: '#0f9c94', // 3.02 / 4.93, Petronas green
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
    light: '#0f9991', dark: '#0f9c94', // 3.02 / 4.93, Petronas green
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
    light: '#0f9991', dark: '#0f9c94', // 3.02 / 4.93, Petronas green
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
    light: '#1b2a5e', dark: '#4462c9', // 11.74 / 3.05, dark blue
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
    light: '#2b4bd8', dark: '#415ddc', // 5.83 / 3.04, blue
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
    light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17, white
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

/**
 * The colour each constructor is recognised by, for every season it raced
 * (AF-45) - one fact per team, not per season, and this project's reading:
 * no cited page states which colour a team is recognised by. The
 * maintainer's calls of 2026-09-17 moved three (Mercedes from black, Red
 * Bull from heritage white, Racing Bulls from white) and confirmed two that
 * do not move (Audi's Titanium, Haas's white); the other six are their 2026
 * sourced primary, which test/conventions.mjs holds them to.
 *
 * `name` and `base` are the colour as this file already renders it in some
 * season's scheme; what a mark draws is the matching colour of the season
 * in hand (liveryPair), never this hex, so Red Bull 2016-2025 leads with its
 * own matte navy and not with 2026's dark blue beside it.
 *
 * `chosen` marks a team whose recognition colour is itself this project's
 * pick rather than one a maintainer named - Racing Bulls' blue, which its
 * scheme carries but nobody called its colour. Its tooltip makes the one
 * claim that is true, and borrows no source.
 *
 * A constructor not listed - every team that has left the grid - has no
 * recognition colour, and its marks lead with each season's primary.
 */
export const RECOGNITION = {
  mercedes: { name: 'Petronas green', base: '#0f9c94' },
  'red-bull': { name: 'Dark blue', base: '#1b2a5e' },
  'racing-bulls': { name: 'Blue', base: '#2b4bd8', chosen: true },
  audi: { name: 'Titanium', base: '#a9abae' },
  haas: { name: 'White', base: '#f4f4f4' },
  ferrari: { name: 'Rosso Scuderia', base: '#e30016' },
  mclaren: { name: 'Papaya', base: '#ff8000' },
  'aston-martin': { name: 'Aston Martin Racing Green', base: '#00665e' },
  williams: { name: 'Gloss blue', base: '#1350e0' },
  alpine: { name: 'Alpine blue', base: '#2060e0' },
  cadillac: { name: 'Black', base: '#111214' },
}

/**
 * How near a season's colour must be to the recognition colour to count as
 * it, in CIE L*a*b* delta E 1976. Nearest colour rather than exact hex,
 * because the palette renders each season's shade: Red Bull's 2016-2025
 * matte navy is 12.1 from its dark blue, and McLaren's 2017 Tarocco - the
 * darker pearl papaya McLaren says it became - is 19.9 from papaya. The
 * nearest miss is Williams' 2021-2025 blue at 22.4, which leads anyway as
 * that season's primary; nothing else in the eleven teams' schemes is
 * nearer than 37.
 */
export const RECOGNITION_MATCH = 21

/**
 * The least delta E an accent must stand from the lead to be drawn beside
 * it: two near-identical bands would read as one colour and spend the
 * second band on nothing.
 */
export const ACCENT_APART = 10

const toLab = (hex) => {
  const lin = [1, 3, 5].map((i) => {
    const s = parseInt(hex.slice(i, i + 2), 16) / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const [r, g, b] = lin
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

/** CIE76 delta E between two #rrggbb colours. */
export function deltaE(a, b) {
  const [p, q] = [toLab(a), toLab(b)]
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

/**
 * The two colours a mark draws for a livery entry, as { lead, accent,
 * recognised } - the one shared derivation every mark reads (AF-46), so the
 * table marks, the calendar strip and the prerenderer cannot each work it
 * out differently. `lead` and `accent` are colours of the entry's own
 * scheme, unchanged; `accent` is null where nothing in the scheme stands
 * ACCENT_APART from the lead.
 *
 *   recognised  true where the lead is the constructor's RECOGNITION colour,
 *               found in this season's scheme within RECOGNITION_MATCH; false
 *               where the team has no recognition colour or this season does
 *               not carry it, and the season's sourced primary leads.
 *
 * The accent is not chosen: it is the scheme in its own order with the lead
 * taken out, first colour standing. So the only new fact AF-45 added is the
 * recognition colour, and AF-17's third colour is still recorded here and
 * still drawn on the band - a mark draws two of three on purpose (AF-46).
 */
export function liveryPair(livery) {
  const { scheme } = livery
  const wanted = RECOGNITION[livery.constructor]
  let lead = scheme[0]
  let recognised = false
  if (wanted) {
    const nearest = scheme
      .map((colour) => ({ colour, d: deltaE(colour.base, wanted.base) }))
      .sort((a, b) => a.d - b.d)[0]
    if (nearest.d <= RECOGNITION_MATCH) {
      lead = nearest.colour
      recognised = true
    }
  }
  const accent = scheme.find((colour) => colour !== lead && deltaE(colour.base, lead.base) >= ACCENT_APART) ?? null
  return { lead, accent, recognised }
}

/**
 * A scheme's accents split by whether a cited page states them.
 *
 * The header's promise, made reachable by a surface. `sourced: false` marks
 * a colour this project added because a team is recognised by it and no
 * cited page for that span names it - at present the red and silver Toro
 * Rosso ran before its 2017 relaunch - and the maintainer's decision of
 * 2026-09-14 is that no surface may present one as the team's own. A
 * surface that prints accent names has to tell them apart to keep that, so
 * the split lives here rather than in each surface's own filter: AF-17 was
 * the first surface ever to print an accent name at all, and it printed
 * both kinds under a sentence saying the sources describe them.
 *
 * `chosen` is still DRAWN - the band carries every colour of the scheme,
 * and a mark may take one as its accent - it is only never NAMED without
 * the clause that says whose reading it is.
 */
export function accentsBySource(scheme) {
  const accents = Array.isArray(scheme) ? scheme.slice(1) : []
  return {
    sourced: accents.filter((colour) => colour.sourced),
    chosen: accents.filter((colour) => !colour.sourced),
  }
}

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
 * paint: --livery, holding the primary's base, and --livery-scheme, the
 * whole scheme beneath it where there is more than one colour (AF-17). One
 * value each serves both themes - the mark draws the colour itself (AF-16)
 * - and app.css derives the mark's edge from the primary, so a white livery
 * on a white panel is outlined rather than moved. A national colour is
 * already a theme-switching token and passes through as one.
 */
export const liveryStyle = (livery) => (livery ? markStyle(liveryPrimary(livery).base, livery.scheme) : undefined)

/**
 * How much of a band the primary takes. A livery is its main colour with the
 * rest beside it, not equal thirds: Ferrari in three equal bands is a third
 * red, and the thing a reader recognises at a glance is the red.
 */
const PRIMARY_SHARE = 0.58

/** How much of a mark its lead takes: 62 / 38, as decided on AF-46. */
const LEAD_SHARE = 0.62

/**
 * A scheme as hard gradient stops, or null for a scheme of one.
 *
 * AF-15 sourced a primary and up to two accents for every team and only the
 * primary was ever drawn, so two teams whose schemes differ drew the same
 * mark - which is what test/conventions.mjs said in as many words, pointing
 * at this item. The stops are hard, never blended: a blend would invent a
 * colour no source states, which is the whole objection this file's header
 * raises about hexes.
 *
 * One direction, `to bottom`, for every surface that draws it - the mark
 * beside a name is tall and thin, the band on a constructor's page is wide
 * and short, and one value has to serve both or the property would have to
 * be computed per surface and could fall out of step with itself.
 *
 * A scheme of one - every national colour, and a livery nobody sourced an
 * accent for - returns null, so `.livery` falls back to `none` and the mark
 * stays the flat fill AF-16 left it as.
 */
export const schemeGradient = (scheme) => stops(scheme, PRIMARY_SHARE)

function stops(scheme, first) {
  if (!Array.isArray(scheme) || scheme.length < 2) return null
  const accents = scheme.slice(1)
  const share = (1 - first) / accents.length
  const pc = (n) => `${(n * 100).toFixed(2)}%`
  let at = first
  const stops = [`${scheme[0].base} 0 ${pc(at)}`]
  for (const colour of accents) {
    // The last stop is pinned to 100% rather than to the accumulated share,
    // so a rounded percentage cannot leave a hairline of the element's own
    // background showing along the bottom edge.
    const next = colour === accents[accents.length - 1] ? 1 : at + share
    stops.push(`${colour.base} ${pc(at)} ${pc(next)}`)
    at = next
  }
  return `linear-gradient(to bottom, ${stops.join(', ')})`
}

/**
 * The custom properties a mark reads: --livery, the colour itself, which is
 * what AF-16 decided a mark draws and what app.css mixes the edge from; and
 * --livery-scheme, the rest of the scheme beneath it, absent for a scheme of
 * one. Every surface takes this one object - the marks in the tables, the
 * band on a constructor's page, the winner's bar in the season strip, and
 * (through markStyleAttr) the static copy the prerenderer writes.
 */
export function markStyle(base, scheme) {
  const gradient = schemeGradient(scheme)
  return gradient ? { '--livery': base, '--livery-scheme': gradient } : { '--livery': base }
}

/**
 * The custom properties a MARK reads (AF-46): --livery, the pair's lead,
 * which app.css also mixes the ring from, and --livery-scheme, the lead and
 * the accent at 62 / 38 in the one direction every gradient here runs.
 * Without an accent, the lead alone.
 */
export function pairStyle({ lead, accent }) {
  return accent
    ? { '--livery': lead.base, '--livery-scheme': stops([lead, accent], LEAD_SHARE) }
    : { '--livery': lead.base }
}

/**
 * A colour entry's `mark` - pairStyle()'s properties - as a style
 * attribute, for scripts/prerender.js. The
 * static mark and the app's are one function's output rather than two
 * writings of it: the prerenderer used to spell out `--livery:` itself, and
 * a second property added here would have reached the app alone.
 */
export const markStyleAttr = (colour) =>
  Object.entries(colour.mark)
    .map(([property, value]) => `${property}:${value}`)
    .join(';')

/**
 * The colour a constructor raced in a season, routed by era (see the
 * header), as { kind, name, named, base, light, dark, source, style, pair,
 * mark, title, claim } or null.
 *
 * Two readers, two claims. The BAND (LiveryScheme) takes `name`, `named`,
 * `scheme`, `style` and `claim`, which are all about what the car raced in.
 * A MARK takes `mark` and `title`, which are about the pair it draws - led,
 * where the season carries it, by the colour the team is recognised by.
 *   team    the constructor's name, for the title; the id stands in without it
 *   kind    'livery' or 'national'
 *   named   true where `name` is the team's own term (see the header)
 *   base    the primary itself, unmoved (AF-16); a mark draws `mark`
 *   light   the pair a CHART SERIES wears, and nothing else: the PAIR'S LEAD
 *   dark    moved until it clears 3:1 in that theme, because a series is told
 *           from its neighbour by colour alone. The lead, not the primary
 *           (AF-57): a chart and a mark are the same team on the same page,
 *           so they lead with the same colour. A mark takes `mark`, never
 *           these - it draws the lead's base unmoved
 *   scheme  the primary and its accents, each { name, base, named, sourced };
 *           a national colour is a scheme of one
 *   style   the custom properties the band draws: the primary itself, and
 *           the scheme beneath it where there is more than one colour (AF-17)
 *   pair    liveryPair(): the lead and accent a mark draws (AF-46)
 *   mark    pairStyle() of that pair: the properties every mark is handed
 *   claim   "as the team names it" or "as its sources describe it", about
 *           the primary - the clause the band's sentence appends, so no
 *           surface says the first where only the second is true
 *   title   the sentence a mark's tooltip says, naming the claims being
 *           made about what it draws (markTitle)
 */
export function colourForEntry({ constructorId, country, year, team }) {
  const y = Number(year)
  if (!Number.isFinite(y)) return null
  if (y < SPONSOR_ERA) return nationalEntry(country)
  if (y < LIVERY_ERA) return null
  const livery = liveryFor(constructorId, y)
  if (!livery) return null
  const who = team ?? constructorId
  const claim = liveryClaim(livery)
  const pair = liveryPair(livery)
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
    pair,
    mark: pairStyle(pair),
    claim,
    title: markTitle(livery, pair, who, y),
  }
}

/**
 * What a mark's tooltip says (AF-45). Two provenance facts, kept apart:
 * that the lead is the colour a team is RECOGNISED by is this site's
 * reading, which no cited page states; that the colour is IN that season's
 * livery, and whose name for it this is, is what the sources establish. A
 * tooltip carrying only the second would present the project's choice as
 * the team's word, and one carrying only the first would drop a sourced
 * fact - so a recognised lead says both. Where the colour is itself this
 * project's pick (RECOGNITION's `chosen`, or an accent no page states), the
 * second clause is not available and the tooltip makes the first alone.
 *
 * A mark led by the season's primary - a team with no recognition colour,
 * or a season that did not carry it - draws what the car raced in, and says
 * so in the sentence the band uses.
 */
function markTitle(livery, { lead, recognised }, who, year) {
  if (!recognised) return `${livery.name} — the colour ${who} raced in ${year}, ${liveryClaim(livery)}`
  const reading = `${lead.name} — the colour ${who} is recognised by, which is this site's reading rather than a source's`
  if (RECOGNITION[livery.constructor].chosen || !lead.sourced) return reading
  const named = lead.named ? "and the name is the team's own" : 'as its sources describe it'
  return `${reading}; the ${year} livery carries it, ${named}`
}

/**
 * The colour of the team a driver finished a season with, and the tooltip
 * that says so (AF-47). `raced` is that driver's constructors in the season,
 * latest first - queries/season.js DRIVER_TEAMS for one season's grid,
 * queries/driver.js SEASON_TEAMS for one driver's career, grouped the same
 * way. One mark per row: a driver who changed teams mid-season wears the one
 * they finished with, and the tooltip names the earlier ones. The season
 * standings and the driver page both read this, so the two cannot answer the
 * same question differently.
 */
export function lastTeamColour(raced, year) {
  const last = raced?.[0]
  if (!last) return { colour: null, title: undefined }
  const colour = colourForEntry({ constructorId: last.constructor_id, country: last.country, year, team: last.constructor })
  const also =
    raced.length > 1 ? ` (earlier in the season: ${raced.slice(1).map((t) => t.constructor).join(', ')})` : ''
  return { colour, title: colour ? `${colour.title}${also}` : undefined }
}

/**
 * The national convention as a colour entry, in the same shape colourForEntry
 * returns.
 *
 * It is the pre-1968 branch of that function, lifted out because the
 * CONSTRUCTOR page names a team's country colour whatever season the team
 * last raced - it is the aside for everyone the livery map has no row for,
 * and the sentence beside it says which convention it is showing. One
 * construction, so the two surfaces cannot describe the same colour
 * differently.
 *
 * A scheme of one: the convention painted a car one colour, and inventing an
 * accent for it would be inventing a fact.
 */
export function nationalEntry(country) {
  const canonical = canonicalCountry(country)
  const entry = COLOURS[canonical]
  if (!entry) return null
  const css = `var(--${entry.token})`
  const scheme = [{ name: entry.name, base: css, named: false, sourced: true }]
  return {
    kind: 'national',
    name: entry.name,
    named: false,
    scheme,
    base: css,
    light: css,
    dark: css,
    source: null,
    style: { '--livery': css },
    pair: { lead: scheme[0], accent: null, recognised: false },
    mark: { '--livery': css },
    claim: 'the convention, not the team\'s own livery',
    title: `${entry.name} — the racing colour of ${canonical}, the convention that painted a car for the country that entered it`,
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
 * The winning constructor's colour, for the mark under a calendar round in
 * the season strip (components/Outline.jsx and scripts/prerender.js draw the
 * same bar from this, through `mark`): null for a round not yet run, a
 * round with no recorded winner, or a season with no colour. The strip is a
 * mark, so it leads with the recognition colour; it is three pixels tall and
 * draws the lead alone (app.css).
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
