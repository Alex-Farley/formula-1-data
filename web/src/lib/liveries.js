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
 * page it was read from (`source`) and the words it was read in (`says`):
 * the team's own launch release or brand page first, then formula1.com's
 * launch coverage (source 3-7, facts-only) and the Wikipedia car article
 * (source 8/11/17). Nothing in this file enters f1.db.
 *
 * The hex is this palette's rendering of that named colour, not a
 * measurement. `base` is the rendering; `light` and `dark` are the base
 * moved in lightness until each clears 3:1 against the surfaces it sits on -
 * --panel and --panel-sunk in light, --panel and --panel-raised in dark -
 * which is why a white livery is a mid grey on a white panel and a black one
 * a pale grey on the timing screen. VD-27 did the same to the eight national
 * colours, and test/conventions.mjs measures every pair here the same way.
 * The two ratios in the comment after each pair are the measured minimums.
 *
 * ONE COLOUR PER SEASON. A livery has several; the entry carries the
 * principal one, and the name says when the team painted two ("Black and
 * gold", "Red, white and blue"). A mid-season change - McLaren's 2015 switch
 * from silver to black at Spain, Williams dropping red in 2020 - is a fact
 * the sources record and this map does not: one colour per constructor-
 * season is what a row of a standings table can show.
 *
 * WHAT IS NOT HERE, AND WHY. LIVERY_GAPS names every constructor-season from
 * 2010 that has race entries and no entry here, with the reason - in every
 * case, no classified source found that states the colour. A gap gets no
 * mark rather than a guess, which is the rule the database applies to a
 * missing figure. test/units.mjs holds the two lists to the database: every
 * 2010+ constructor-season is in exactly one of them.
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
 * HOW A PAIR REACHES THE PAGE. liveryStyle() returns two custom properties,
 * --livery-light and --livery-dark, for an element's inline style; the
 * `.livery` rules in styles/app.css pick one per theme, exactly as
 * tokens.css does for --racing-*. No component ever chooses a hex, and no
 * element carries one hex for both themes.
 */
import { COLOURS, canonicalCountry } from './racingColours.js'

/** The first season the national convention no longer describes the grid. */
export const SPONSOR_ERA = 1968
/** The first season this map covers. */
export const LIVERY_ERA = 2010

export const LIVERIES = [
  {
    constructor: 'ferrari', from: 2010, to: 2025, name: 'Rosso corsa',
    base: '#d40000', light: '#d40000', dark: '#d40000', // 4.76 / 3.02
    source: [
      'https://en.wikipedia.org/wiki/Rosso_corsa',
      'https://en.wikipedia.org/wiki/Ferrari_SF-25',
    ],
    says: 'Ferrari "has always kept the traditional red" since sponsor liveries replaced national colours in 1968; the SF-25 "featured a darker shade of red".',
  },
  {
    constructor: 'ferrari', from: 2026, to: 2026, name: 'Rosso Scuderia',
    base: '#e30016', light: '#e30016', dark: '#e30016', // 4.23 / 3.40
    source: [
      'https://www.ferrari.com/en-EN/formula1/articles/ferrari-unveils-the-sf-26',
    ],
    says: '"Red remains the dominant colour"; "the 2026 Rosso Scuderia colour is brighter and more intense", in gloss after seven seasons of matte.',
  },
  {
    constructor: 'mclaren', from: 2010, to: 2014, name: 'Chrome',
    base: '#c0c4c9', light: '#818993', dark: '#c0c4c9', // 3.05 / 9.52
    source: [
      'https://en.wikipedia.org/wiki/McLaren_MP4-29',
      'https://www.formula1.com/en/latest/article/mclaren-liveries-through-the-years.3M1dkzZe78TyKvRN0ZAsht',
    ],
    says: 'The silver-chrome scheme run since 1997; the MP4-29 "ran with a full chrome livery and black accents".',
  },
  {
    constructor: 'mclaren', from: 2015, to: 2016, name: 'Graphite grey',
    base: '#3a3d42', light: '#3a3d42', dark: '#656a73', // 9.39 / 3.07
    source: [
      'https://en.wikipedia.org/wiki/McLaren_MP4-30',
      'https://www.formula1.com/en/latest/article/mclaren-liveries-through-the-years.3M1dkzZe78TyKvRN0ZAsht',
    ],
    says: 'The MP4-30 was launched "with a black and silver chrome livery with red trim" and ran "dominant black and red" from Spain; 2016 was "a darker graphite-grey".',
  },
  {
    constructor: 'mclaren', from: 2017, to: 2017, name: 'Tarocco orange',
    base: '#d95a13', light: '#d95a13', dark: '#d95a13', // 3.33 / 4.31
    source: [
      'https://www.mclaren.com/racing/latest-news/mclarenracing/article/colour-by-numbers-6122243/',
    ],
    says: '"For 2017, we merely updated the tone - Papaya became Tarocco, a dark, pearl orange".',
  },
  {
    constructor: 'mclaren', from: 2018, to: 2026, name: 'Papaya',
    base: '#ff8000', light: '#d66c00', dark: '#ff8000', // 3.01 / 6.62
    source: [
      'https://www.mclaren.com/racing/formula-1/2018/car-launch/mclaren-and-papaya-2174925/',
      'https://www.mclaren.com/racing/formula-1/2026/mcl40-launch/',
    ],
    says: 'The MCL33 "revives the original colours of McLaren - papaya orange and dark blue"; the 2026 MCL40 keeps "the iconic papaya colour palette".',
  },
  {
    constructor: 'mercedes', from: 2010, to: 2019, name: 'Silver',
    base: '#b5b9be', light: '#818891', dark: '#b5b9be', // 3.08 / 8.46
    source: [
      'https://en.wikipedia.org/wiki/Mercedes_MGP_W01',
      'https://en.wikipedia.org/wiki/Mercedes-AMG_F1_W11_EQ_Performance',
    ],
    says: '"The team\'s silver livery was officially unveiled" in 2010; the W11 took black "instead of the traditional silver that was present on its predecessors".',
  },
  {
    constructor: 'mercedes', from: 2020, to: 2021, name: 'Black',
    base: '#111214', light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://en.wikipedia.org/wiki/Mercedes-AMG_F1_W11_EQ_Performance',
      'https://en.wikipedia.org/wiki/Mercedes-AMG_F1_W13_E_Performance',
    ],
    says: 'The W11 "would feature black as the primary colour"; "the W11 and W12 were painted black".',
  },
  {
    constructor: 'mercedes', from: 2022, to: 2022, name: 'Silver',
    base: '#b5b9be', light: '#818891', dark: '#b5b9be', // 3.08 / 8.46
    source: [
      'https://en.wikipedia.org/wiki/Mercedes-AMG_F1_W13_E_Performance',
    ],
    says: '"The W13 saw the return of the traditional silver livery".',
  },
  {
    constructor: 'mercedes', from: 2023, to: 2025, name: 'Black',
    base: '#111214', light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://en.wikipedia.org/wiki/Mercedes-AMG_F1_W14_E_Performance',
      'https://en.wikipedia.org/wiki/Mercedes-AMG_F1_W15_E_Performance',
      'https://en.wikipedia.org/wiki/Mercedes-AMG_F1_W16_E_Performance',
    ],
    says: 'The W14 "was revealed to have a black livery"; the W15 "a mostly bare carbon fibre and black livery"; the W16 "similar to the W15\'s".',
  },
  {
    constructor: 'mercedes', from: 2026, to: 2026, name: 'Black and silver',
    base: '#16171a', light: '#16171a', dark: '#656a78', // 15.43 / 3.09
    source: [
      'https://www.mercedesamgf1.com/news/mercedes-amg-f1-2026-challenger-w17-revealed',
    ],
    says: 'A Petronas green line "harmonising the transition from iconic Mercedes silver to the team\'s deep black".',
  },
  {
    constructor: 'red-bull', from: 2010, to: 2015, name: 'Dark blue',
    base: '#1b2a5e', light: '#1b2a5e', dark: '#4462c9', // 11.74 / 3.05
    source: [
      'https://www.redbullracing.com/int-en/cars/rb9',
      'https://en.wikipedia.org/wiki/Red_Bull_RB12',
    ],
    says: 'The RB9\'s "basic colors ... are dark blue and purple"; in 2016 "the blue tone was changed from a glossy into a dark matte tone".',
  },
  {
    constructor: 'red-bull', from: 2016, to: 2025, name: 'Matte navy',
    base: '#1c2648', light: '#1c2648', dark: '#4d66ba', // 12.73 / 3.12
    source: [
      'https://en.wikipedia.org/wiki/Red_Bull_RB12',
      'https://www.redbullracing.com/int-en/races/season-launch-2026/season-launch-2026-recap',
    ],
    says: 'Matte from 2016; the 2026 launch marked "a return to the gloss finish first seen when the Team made its debut back in 2005".',
  },
  {
    constructor: 'red-bull', from: 2026, to: 2026, name: 'Heritage white',
    base: '#f2f2f2', light: '#898989', dark: '#f2f2f2', // 3.01 / 14.90
    source: [
      'https://www.redbullracing.com/int-en/races/season-launch-2026/season-launch-2026-recap',
      'https://www.formula1.com/en/latest/article/first-look-red-bull-unveil-striking-new-livery-for-2026-f1-season.61MNwo6zMoxUtOAjS8JH0S',
    ],
    says: 'The RB22 "features a heritage white base", in gloss.',
  },
  {
    constructor: 'renault', from: 2010, to: 2010, name: 'Yellow and black',
    base: '#f5c400', light: '#a38300', dark: '#f5c400', // 3.11 / 10.15
    source: [
      'https://en.wikipedia.org/wiki/Renault_R30',
    ],
    says: 'The R30 "returned to the historic yellow-black livery" after ING left.',
  },
  {
    constructor: 'renault', from: 2011, to: 2011, name: 'Black and gold',
    base: '#111214', light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://en.wikipedia.org/wiki/Renault_in_Formula_One',
    ],
    says: 'As Lotus Renault GP: a "black and gold livery that was last used when Renault and Lotus joined forces in the 1980s".',
  },
  {
    constructor: 'renault', from: 2016, to: 2020, name: 'Renault yellow',
    base: '#f5c400', light: '#a38300', dark: '#f5c400', // 3.11 / 10.15
    source: [
      'https://www.formula1.com/en/latest/article/renault-reveal-yellow-race-livery-for-2016.N7ReUJmKHRk2u4kQHjKo1',
      'https://www.formula1.com/en/latest/article/renault-launch-livery-ahead-of-australian-grand-prix-2020.5td91wEl8K76nvJBd7HdwM',
    ],
    says: '2016: "Renault\'s corporate colour of yellow"; 2020: a livery "that retained the yellow and black with which they have become synonymous since they returned ... in 2016".',
  },
  {
    constructor: 'lotus-f1', from: 2012, to: 2015, name: 'Black and gold',
    base: '#111214', light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://en.wikipedia.org/wiki/Lotus_F1_Team',
    ],
    says: 'The team "competed in a black-and-gold livery inspired by that of Team Lotus".',
  },
  {
    constructor: 'caterham', from: 2010, to: 2014, name: 'Green',
    base: '#0b5a3a', light: '#0b5a3a', dark: '#0f7a4f', // 7.12 / 3.11
    source: [
      'https://en.wikipedia.org/wiki/Lotus_T127',
      'https://www.formula1.com/en/latest/article/caterham-roll-out-striking-new-ct05-in-jerez.2FGEMkqR1yVSsgPyfmA83w',
    ],
    says: 'The 2010 T127 "liveried in dark green with yellow"; the 2014 CT05 "a bold metallic green set off with flashes of white, yellow and black".',
  },
  {
    constructor: 'hrt', from: 2010, to: 2010, name: 'Dark grey',
    base: '#4b4e54', light: '#4b4e54', dark: '#656a72', // 7.18 / 3.06
    source: [
      'https://en.wikipedia.org/wiki/Hispania_F110',
    ],
    says: '"The F110 was liveried in dark grey, with a white, yellow and red stripe running down each sidepod".',
  },
  {
    constructor: 'hrt', from: 2011, to: 2011, name: 'White',
    base: '#f4f4f4', light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://en.wikipedia.org/wiki/Hispania_F111',
    ],
    says: '"The livery is primarily white with red inserts bordered in black".',
  },
  {
    constructor: 'hrt', from: 2012, to: 2012, name: 'White and gold',
    base: '#f4f4f4', light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://en.wikipedia.org/wiki/HRT_F112',
    ],
    says: '"Launched with a white, gold and red livery, their third livery change in as many years".',
  },
  {
    constructor: 'force-india', from: 2010, to: 2014, name: 'White, orange and green',
    base: '#f4f4f4', light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://en.wikipedia.org/wiki/Force_India_VJM03',
      'https://en.wikipedia.org/wiki/Force_India_VJM07',
    ],
    says: 'The VJM03 kept its predecessor\'s "white base paint with green and orange"; the VJM07 "was painted in the Indian flag colors of orange, white and green".',
  },
  {
    constructor: 'force-india', from: 2015, to: 2015, name: 'Silver',
    base: '#b5b9be', light: '#818891', dark: '#b5b9be', // 3.08 / 8.46
    source: [
      'https://www.formula1.com/en/latest/headlines/2015/1/force-india-unveil-sleek-new-team-livery.html',
      'https://en.wikipedia.org/wiki/Force_India_VJM08',
    ],
    says: '"The new livery incorporates silver for the first time", the white removed, black, orange and green retained.',
  },
  {
    constructor: 'force-india', from: 2017, to: 2018, name: 'BWT pink',
    base: '#f7a1cf', light: '#ef439f', dark: '#f7a1cf', // 3.03 / 8.70
    source: [
      'https://en.wikipedia.org/wiki/Force_India_VJM10',
      'https://en.wikipedia.org/wiki/Force_India_VJM11',
    ],
    says: 'The VJM10 gained "a striking pink livery"; the VJM11 "an updated pink livery for 2018".',
  },
  {
    constructor: 'racing-point', from: 2019, to: 2020, name: 'BWT pink',
    base: '#f7a1cf', light: '#ef439f', dark: '#f7a1cf', // 3.03 / 8.70
    source: [
      'https://www.formula1.com/en/latest/article/racing-point-reveal-their-2019-identity.6qr236jVQ3VJ3p2OzMkB4q',
      'https://www.formula1.com/en/latest/article/racing-point-reveal-2020-f1-car-and-title-sponsor-change.2YWK5q19JTEbR2sAOmNIsj',
    ],
    says: '2019: the team "opting to stick with their pink livery"; 2020: "that emphatic colour remains on the 2020 challenger".',
  },
  {
    constructor: 'aston-martin', from: 2021, to: 2026, name: 'Aston Martin Racing Green',
    base: '#00665e', light: '#00665e', dark: '#007a71', // 5.90 / 3.19
    source: [
      'https://www.astonmartinf1.com/en-GB/news/feature/aston-martin-racing-green-more-than-just-a-colour',
      'https://www.astonmartinf1.com/en-GB/news/announcement/aston-martin-aramco-launches-season-with-livery-reveal',
    ],
    says: 'The AMR21 "was painted in 2021 Aston Martin Racing Green"; the 2026 design "features the signature Aston Martin Racing Green".',
  },
  {
    constructor: 'sauber', from: 2012, to: 2012, name: 'White',
    base: '#f4f4f4', light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://en.wikipedia.org/wiki/Sauber_C32',
    ],
    says: 'The 2013 car\'s "white base was switched to a grey colour scheme" - the 2012 base was white.',
  },
  {
    constructor: 'sauber', from: 2013, to: 2013, name: 'Grey',
    base: '#6f747b', light: '#6f747b', dark: '#6f747b', // 4.05 / 3.54
    source: [
      'https://en.wikipedia.org/wiki/Sauber_C32',
      'https://en.wikipedia.org/wiki/Sauber_Motorsport',
    ],
    says: '"The white base was switched to a grey colour scheme with a black, red and white accents on the sides".',
  },
  {
    constructor: 'sauber', from: 2015, to: 2016, name: 'Blue and yellow',
    base: '#1f4fbf', light: '#1f4fbf', dark: '#2a60dc', // 6.17 / 3.02
    source: [
      'https://www.formula1.com/en/latest/article/sauber-unveil-newly-liveried-c34.3zK6sncNj3fJGgFOHhsKCC',
      'https://en.wikipedia.org/wiki/Sauber_C35',
    ],
    says: 'The C34\'s "bold new blue and yellow livery"; on the C35 "the livery remained unchanged".',
  },
  {
    constructor: 'sauber', from: 2017, to: 2017, name: 'Blue, white and gold',
    base: '#1f4fbf', light: '#1f4fbf', dark: '#2a60dc', // 6.17 / 3.02
    source: [
      'https://www.formula1.com/en/latest/article/sauber-reveal-new-car-in-anniversary-livery.2VFkeUUfp6ssswIcqI0iqs',
    ],
    says: 'The C36 "ran in a blue, white and gold livery" for the team\'s 25th season.',
  },
  {
    constructor: 'sauber', from: 2018, to: 2018, name: 'White',
    base: '#f4f4f4', light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://www.formula1.com/en/latest/article/new-look-sauber-unveil-c37.1Vhc37qyZi24OM0UIuEO8m',
    ],
    says: 'The C37 "is mostly white and has a large racing red area in the upper two thirds of the engine cover".',
  },
  {
    constructor: 'sauber', from: 2019, to: 2023, name: 'Alfa Romeo red',
    base: '#9a1a1f', light: '#9a1a1f', dark: '#ce232a', // 7.11 / 3.10
    source: [
      'https://www.formula1.com/en/latest/article/alfa-romeo-reveal-2019-livery-in-barcelona.7a5rOZkmrT3k20lrNBCHYn',
      'https://www.formula1.com/en/latest/article/alfa-romeo-unveil-bold-new-livery-for-2022.3sCyQeW5SPD20W9AeIFD2D',
      'https://www.formula1.com/en/latest/article/first-look-kick-sauber-show-off-dazzling-livery-with-a-slew-of-changes-to.7tUcB0jd4VIdbGNbDmP1Pv',
    ],
    says: '2019 "red and white colours ... the red is certainly more prevalent"; 2022 "red and white livery"; 2024 "gone is the red and black design used under the team\'s Alfa Romeo partnership".',
  },
  {
    constructor: 'sauber', from: 2024, to: 2025, name: 'Fluorescent green',
    base: '#00e701', light: '#009a01', dark: '#00e701', // 3.22 / 9.87
    source: [
      'https://www.formula1.com/en/latest/article/first-look-kick-sauber-show-off-dazzling-livery-with-a-slew-of-changes-to.7tUcB0jd4VIdbGNbDmP1Pv',
      'https://en.wikipedia.org/wiki/Kick_Sauber_C45',
    ],
    says: 'The C44 "sports a dazzling new fluorescent green and black livery"; the C45 "retains the green and black colors".',
  },
  {
    constructor: 'toro-rosso', from: 2010, to: 2016, name: 'Navy blue',
    base: '#0e1f4d', light: '#0e1f4d', dark: '#3460da', // 13.68 / 3.04
    source: [
      'https://www.redbull.com/int-en/toro-rosso-2017-launch',
    ],
    says: 'The 2017 change was "a bold departure from the team\'s previous navy blue scheme", the first in twelve seasons.',
  },
  {
    constructor: 'toro-rosso', from: 2017, to: 2019, name: 'Royal blue',
    base: '#1f4fd0', light: '#1f4fd0', dark: '#2e5ee0', // 5.86 / 3.01
    source: [
      'https://www.redbull.com/int-en/toro-rosso-2017-launch',
      'https://www.formula1.com/en/latest/article/new-look-toro-rosso-completes-17-launches-in-spain.3hVuD9kCoEUMOoyKWG4Yck',
    ],
    says: '"The striking royal blue, scarlet, and silver of the STR12"; "the blue was actually a shade lighter than the standard Red Bull shade".',
  },
  {
    constructor: 'alphatauri', from: 2020, to: 2023, name: 'Navy and white',
    base: '#1c2c4c', light: '#1c2c4c', dark: '#4268b4', // 11.94 / 3.07
    source: [
      'https://www.formula1.com/en/latest/article/alphatauri-reveal-striking-2020-livery-after-toro-rosso-rebrand.3zbnWCzu4AyTSLrBYOoReL',
      'https://www.formula1.com/en/latest/article/first-look-alphatauri-reveal-livery-for-2023-at04-at-glitzy-new-york-f1.lnlL0m6mx00T5YtQT3Eyf',
    ],
    says: '2020: "white and dark blue"; 2023: "a now traditional deep blue and white colour scheme".',
  },
  {
    constructor: 'racing-bulls', from: 2024, to: 2024, name: 'Blue',
    base: '#2b4bd8', light: '#2b4bd8', dark: '#415ddc', // 5.83 / 3.04
    source: [
      'https://en.wikipedia.org/wiki/RB_VCARB_01',
    ],
    says: '"The VCARB 01\'s livery was predominantly painted in blue with red pinstriping overlaid on the white stripes".',
  },
  {
    constructor: 'racing-bulls', from: 2025, to: 2026, name: 'White',
    base: '#f4f4f4', light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://www.visacashapprb.com/int-en/2026-car-reveal',
      'https://www.formula1.com/en/latest/article/first-look-racing-bulls-showcase-2026-livery-at-launch-event-in-detroit.ObKtbPEmmdtrnfMHw34pd',
    ],
    says: '"The all-white look from 2025 was retained and sharpened this year, with clean blue accents".',
  },
  {
    constructor: 'virgin', from: 2016, to: 2016, name: 'Red, white and blue',
    base: '#d1262f', light: '#d1262f', dark: '#d1262f', // 4.49 / 3.20
    source: [
      'https://en.wikipedia.org/wiki/Manor_MRT05',
      'https://www.formula1.com/en/latest/article/manor-mrt05-breaks-cover-in-barcelona.51AN2McfVTb6Rl38ceHEPm',
    ],
    says: 'Manor Racing "had a predominantly red and blue livery with flashes of white" after the rebrand under Fitzpatrick.',
  },
  {
    constructor: 'williams', from: 2010, to: 2011, name: 'Dark blue',
    base: '#0a1f5c', light: '#0a1f5c', dark: '#2b5ce8', // 13.26 / 3.02
    source: [
      'https://en.wikipedia.org/wiki/Williams_FW33',
    ],
    says: 'The 2011 livery added "white, silver and red to the existing dark blue".',
  },
  {
    constructor: 'williams', from: 2014, to: 2018, name: 'Martini white',
    base: '#f4f4f4', light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://en.wikipedia.org/wiki/Williams_FW36',
      'https://en.wikipedia.org/wiki/Williams_FW41',
    ],
    says: 'The Martini scheme, "white background with dark blue, sky blue and red stripes"; the FW41 was "the fifth and final Williams car featuring a Martini livery".',
  },
  {
    constructor: 'williams', from: 2019, to: 2020, name: 'White and blue',
    base: '#f4f4f4', light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://www.formula1.com/en/latest/article/williams-show-off-dramatic-new-look-for-2019.pTkktRq2kBUsICx7MHr6v',
      'https://www.formula1.com/en/latest/article.first-look-williams-reveal-striking-new-livery-ahead-of-2020-season-opener.4EiLjnHqlMgA4VCbteqVDx.html',
    ],
    says: '2019: "a white base paint and unique flourish blue livery"; 2020: "predominantly white livery with bands of navy and baby blue".',
  },
  {
    constructor: 'williams', from: 2021, to: 2025, name: 'Williams blue',
    base: '#0f3fa8', light: '#0f3fa8', dark: '#1e5eeb', // 7.87 / 3.06
    source: [
      'https://www.williamsf1.com/articles/d655080b-9ab9-405d-9e7c-0d6a34aae4d0/williams-racing-unveils-livery-for-the-2021-season',
      'https://www.williamsf1.com/articles/23331a30-bbce-4e5f-b372-1a46f250fe2a/williams-racing-unveils-all-new-fw44',
      'https://www.williamsf1.com/articles/8576c1c3-5ef0-44f3-bc6f-7e2b0073599f/atlassian-williams-racing-unveils-its-2025-formula-1-livery-and-celebrates-new-title-partner',
    ],
    says: '2021 "combining blues, white and yellow accents"; 2022 retains "the shades of blue that have been synonymous with Williams Racing"; 2025 "a gradient that transitions from traditional Williams navy at the front to Atlassian\'s signature blue".',
  },
  {
    constructor: 'williams', from: 2026, to: 2026, name: 'Gloss blue',
    base: '#1350e0', light: '#1350e0', dark: '#205dec', // 5.56 / 3.05
    source: [
      'https://www.williamsf1.com/articles/5363520c-1e22-4d62-a568-7f1c7b6ff529/atlassian-williams-f1-team-reveals-bold-new-racing-livery-for-2026',
    ],
    says: '"The FW48\'s lead colour is a vibrant gloss blue".',
  },
  {
    constructor: 'haas', from: 2016, to: 2018, name: 'Grey and red',
    base: '#8a8e94', light: '#85898f', dark: '#8a8e94', // 3.03 / 5.07
    source: [
      'https://www.haasf1team.com/news/introducing-vf-16',
      'https://www.formula1.com/en/latest/article/gallery-how-the-haas-liveries-have-evolved-since-2016.USOtK89bvI2Ofk1QicYfR',
    ],
    says: '"The dark gray, light gray and red-toned livery of the VF-16 was derived from Haas Automation\'s machine tool lineage"; kept through 2018.',
  },
  {
    constructor: 'haas', from: 2019, to: 2019, name: 'Black and gold',
    base: '#111214', light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://www.formula1.com/en/latest/article/haas-unveil-new-black-and-gold-f1-livery-for-2019.3fIfnfT5NoMoLcuitzNJrt',
    ],
    says: '"The VF-19 was unveiled in black and gold" for title sponsor Rich Energy.',
  },
  {
    constructor: 'haas', from: 2020, to: 2020, name: 'Grey and red',
    base: '#8a8e94', light: '#85898f', dark: '#8a8e94', // 3.03 / 5.07
    source: [
      'https://www.formula1.com/en/latest/article/haas-first-to-reveal-2020-f1-car-with-return-to-familiar-livery.DAWhMU78RpQP9tj0kZWAv',
    ],
    says: '"A return to the red, grey, black and white for Haas in 2020".',
  },
  {
    constructor: 'haas', from: 2021, to: 2022, name: 'White',
    base: '#f4f4f4', light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://www.formula1.com/en/latest/article/first-look-haas-reveal-fresh-new-livery-for-schumacher-and-mazepins-f1.18aYd0xdt2TInJj1pdrJcV',
      'https://en.wikipedia.org/wiki/Haas_VF-22',
    ],
    says: '2021 "a new predominantly white livery"; 2022 the same, "with the colour red replacing the Russian flag stripe".',
  },
  {
    constructor: 'haas', from: 2023, to: 2024, name: 'Black',
    base: '#111214', light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://www.haasf1team.com/news/moneygram-haas-f1-team-unveils-sleek-new-livery-2023',
      'https://www.formula1.com/en/latest/article/first-look-haas-showcase-new-look-for-2024-challenger-as-livery-is-revealed.4uuvyV9CsnczMsfStIvPsj',
    ],
    says: '2023 "black is now the livery\'s primary colour"; 2024 "an evolution of last year\'s predominately black livery".',
  },
  {
    constructor: 'haas', from: 2025, to: 2025, name: 'White',
    base: '#f4f4f4', light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://en.wikipedia.org/wiki/Haas_VF-25',
    ],
    says: '"Following the predecessor focusing on a more carbon-based livery, the VF-25 features a larger presence of white colouring".',
  },
  {
    constructor: 'haas', from: 2026, to: 2026, name: 'White',
    base: '#f4f4f4', light: '#898989', dark: '#f4f4f4', // 3.01 / 15.17
    source: [
      'https://www.haasf1team.com/news/tgr-haas-f1-team-reveals-vf-26-design-livery',
    ],
    says: '"A new-look white livery with red accents" for TGR Haas F1 Team.',
  },
  {
    constructor: 'alpine', from: 2021, to: 2026, name: 'Alpine blue',
    base: '#2060e0', light: '#2060e0', dark: '#2060e0', // 4.74 / 3.03
    source: [
      'https://media.alpinecars.com/alpine-f1-team-launches-2021-campaign/',
      'https://media.alpinecars.com/bwt-alpine-f1-team-reveals-striking-a522-to-the-world-as-new-chapter-begins-in-formula-1/',
      'https://media.alpinecars.com/driving-pink-change-bwt-alpine-formula-one-team-unveils-the-a526-livery-as-formula-one-enters-a-new-era/?lang=eng',
    ],
    says: '2021 blue, white and red "synonymous with Alpine\'s motorsport heritage"; from 2022 "predominantly blue but features pink highlights" for BWT; 2026 "Alpine\'s traditional blue with BWT\'s signature PINK".',
  },
  {
    constructor: 'audi', from: 2026, to: 2026, name: 'Titanium',
    base: '#a9abae', light: '#84878b', dark: '#a9abae', // 3.11 / 7.25
    source: [
      'https://www.audi-mediacenter.com/en/press-releases/premiere-in-berlin-audi-revolut-f1-team-officially-unveiled-16997',
    ],
    says: '"Titanium, Carbon Black and the newly introduced Audi Red"; "the color Titanium references the company\'s motorsport tradition".',
  },
  {
    constructor: 'cadillac', from: 2026, to: 2026, name: 'Black and white',
    base: '#111214', light: '#111214', dark: '#636974', // 16.13 / 3.02
    source: [
      'https://www.cadillacf1team.com/news/cadillac-formula-1-r-team-reveals-historic-first-livery',
      'https://www.formula1.com/en/latest/article/cadillac-explain-why-they-decided-on-a-split-black-and-white-livery-for.1ZLWVrXOK1BQCoxNaw12iW',
    ],
    says: 'A "split black-and-white livery": "black represents the team\'s bold attitude, while white ... is the actual racing colour of America".',
  },
]

/**
 * Constructor-seasons from 2010 with race entries and no livery above. Each
 * is a fact nobody here holds yet; filling one means finding the source and
 * moving the span into LIVERIES, and test/units.mjs fails a span that is in
 * both or in neither.
 */
export const LIVERY_GAPS = [
  { constructor: 'virgin', from: 2010, to: 2015, why: 'Virgin Racing, Marussia and Manor Marussia: no classified source states the livery colours.' },
  { constructor: 'sauber', from: 2010, to: 2011, why: 'The C29 ran a near-blank livery; no classified source states the colours of the C29 or C30.' },
  { constructor: 'sauber', from: 2014, to: 2014, why: 'No classified source states the C33\'s colours; the C32\'s grey is not shown to have carried over.' },
  { constructor: 'force-india', from: 2016, to: 2016, why: 'No classified source states the VJM09\'s colours; the VJM08\'s silver is not shown to have carried over.' },
  { constructor: 'williams', from: 2012, to: 2013, why: 'The FW34 and FW35 articles name sponsors and a Rothmans inspiration but not the colours.' },
]

/** The livery entry for a constructor in a season, or null. */
export function liveryFor(constructorId, year) {
  if (!constructorId || !Number.isFinite(year)) return null
  return LIVERIES.find((l) => l.constructor === constructorId && year >= l.from && year <= l.to) ?? null
}

/** True where LIVERY_GAPS declares this constructor-season unfilled. */
export const isDeclaredGap = (constructorId, year) =>
  LIVERY_GAPS.some((g) => g.constructor === constructorId && year >= g.from && year <= g.to)

/**
 * The inline style that carries a {light, dark} pair to an element the
 * `.livery` rules paint. A national colour is already a theme-switching
 * token, so both properties point at it.
 */
export const liveryStyle = (colour) =>
  colour ? { '--livery-light': colour.light, '--livery-dark': colour.dark } : undefined

/**
 * The colour a constructor raced in a season, routed by era (see the
 * header), as { kind, name, light, dark, source, style, title } or null.
 *   team    the constructor's name, for the title; the id stands in without it
 *   kind    'livery' or 'national'
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
      light: css,
      dark: css,
      source: null,
      style: { '--livery-light': css, '--livery-dark': css },
      title: `${entry.name} — the racing colour of ${canonicalCountry(country)}, the convention that painted a car for the country that entered it`,
    }
  }
  if (y < LIVERY_ERA) return null
  const livery = liveryFor(constructorId, y)
  if (!livery) return null
  const who = team ?? constructorId
  return {
    kind: 'livery',
    name: livery.name,
    light: livery.light,
    dark: livery.dark,
    source: livery.source,
    style: liveryStyle(livery),
    title: `${livery.name} — the colour ${who} raced in ${y}, as the team names it`,
  }
}

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
