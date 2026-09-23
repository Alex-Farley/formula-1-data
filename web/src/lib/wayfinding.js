/**
 * Where a page sits, and where it leads — once, for both renderers.
 *
 * WHY THIS EXISTS
 *     The two halves of this site each held one half of the wayfinding and
 *     neither held the other's. scripts/prerender.js wrote a breadcrumb trail
 *     and no onward band; the app rendered an onward band on twenty-three
 *     pages and no trail at all. So orientation traded sideways the moment
 *     React replaced the static page, and the half a crawler, a model and a
 *     cold search arrival actually read was the half with no relational layer
 *     in it: "Keep going" appeared 0 times in 3,545 prerendered pages,
 *     /races/2026/13 carried no link to round 12 or 14, and /reference/eras
 *     and /reference/glossary had no inbound link anywhere in the build
 *     (IA-03 #170, IA-22 #159).
 *
 *     Writing the bands into prerender.js as well would have made two copies
 *     of every hint on the site, free to drift — which is the fault
 *     lib/commons.js, lib/format.js and queries/*.js each exist to prevent.
 *     So the routes out of a page live here, as data, and both renderers read
 *     them: the app spreads them into <Onward>, prerender.js prints them as
 *     the same markup.
 *
 * WHAT A PATH LOOKS LIKE
 *     The app's form, with a leading slash. prerender.js's href() strips it,
 *     so one string serves <Link to> and <a href> without a second spelling.
 *
 * A trail is [path, label] pairs, root first, the page itself last. Both
 * renderers draw the last one as the current page rather than as a link.
 */

/* --------------------------------------------------------------- trails */

/**
 * IA-22: the trail and the URL used to describe different hierarchies. A race
 * page is at /races/:year/:round and its trail read Home / Seasons / 2026 /
 * Italian Grand Prix — so /races, the index holding the other 1,149 rounds,
 * was unreachable from a race page by any trail in either renderer, and the
 * one segment a reader could check against the address bar disagreed with it.
 * The year still goes to the season, because that is the page that holds a
 * year of racing; what changed is that the section above it is now the
 * section the address says it is.
 */
const HOME = ['/', 'Home']

export const TRAIL = {
  seasons: () => [HOME, ['/seasons', 'Seasons']],
  season: (year) => [HOME, ['/seasons', 'Seasons'], [`/seasons/${year}`, String(year)]],
  races: () => [HOME, ['/races', 'Races']],
  race: (year, round, name) => [
    HOME,
    ['/races', 'Races'],
    [`/seasons/${year}`, String(year)],
    [`/races/${year}/${round}`, name],
  ],
  // IA-01: a level-two index, reached from /races, a race page and a circuit
  // page rather than from the masthead - but its address is its own, so its
  // trail is too (IA-22).
  grandsPrix: () => [HOME, ['/grands-prix', 'Grands Prix']],
  grandPrix: (id, name) => [HOME, ['/grands-prix', 'Grands Prix'], [`/grands-prix/${id}`, name]],
  drivers: () => [HOME, ['/drivers', 'Drivers']],
  driver: (id, name) => [HOME, ['/drivers', 'Drivers'], [`/drivers/${id}`, name]],
  constructors: () => [HOME, ['/constructors', 'Constructors']],
  constructor: (id, name) => [HOME, ['/constructors', 'Constructors'], [`/constructors/${id}`, name]],
  circuits: () => [HOME, ['/circuits', 'Circuits']],
  circuit: (id, name) => [HOME, ['/circuits', 'Circuits'], [`/circuits/${id}`, name]],
  cars: () => [HOME, ['/cars', 'Cars']],
  car: (id, name) => [HOME, ['/cars', 'Cars'], [`/cars/${id}`, name]],
  records: () => [HOME, ['/records', 'Records']],
  eras: () => [HOME, ['/reference/eras', 'Eras']],
  glossary: () => [HOME, ['/reference/glossary', 'Glossary']],
  data: () => [HOME, ['/data', 'Data']],
  sources: () => [HOME, ['/data', 'Data'], ['/data/sources', 'Sources']],
  quality: () => [HOME, ['/data', 'Data'], ['/data/quality', 'Data quality']],
  sql: () => [HOME, ['/data', 'Data'], ['/data/sql', 'SQL console']],
  compare: () => [HOME, ['/compare', 'Compare two drivers']],
  about: () => [HOME, ['/about', 'About']],
  changes: (title) => [HOME, ['/changes', title]],
  /* An id that resolves to nothing. The section above is real and is a link;
     the page itself is the miss, and says so rather than borrowing the
     section's name for a page the reader is not on. App-only — prerender.js
     writes a page for every id the database holds and none for any other. */
  missing: (to, label) => [HOME, [to, label], ['', 'Not found']],
}

/* ------------------------------------------------- what a page leads to */

/**
 * The rows an onward band is chosen from, picked the same way in both halves.
 *
 * Each of these was a line inside a page component. prerender.js has the same
 * rows in scope — it runs the pages' own queries (PD-02) — so the choice is
 * made here rather than made twice.
 */

/** The team a driver raced for last. RESULTS is newest first. */
export const lastTeamOf = (results) => results.find((row) => row.constructor_id) ?? null

/** The season a driver won most in; ties break on podiums, then on recency. */
export const bestSeasonOf = (bySeason) =>
  [...bySeason].sort((a, b) => (b.wins ?? 0) - (a.wins ?? 0) || (b.podiums ?? 0) - (a.podiums ?? 0) || b.year - a.year)[0] ??
  null

/** A constructor's most successful design; ties break on races entered. */
export const bestDesignOf = (designs) =>
  [...designs].sort((a, b) => (b.wins ?? 0) - (a.wins ?? 0) || (b.races ?? 0) - (a.races ?? 0))[0] ?? null

/** A car's first win, or failing that the last race it entered. ENTRIES is newest first. */
export const firstWinOf = (entries) => [...entries].reverse().find((entry) => entry.finish_position === 1) ?? null

/** A constructor's last season in the championship. BY_SEASON runs oldest first. */
export const lastSeasonOf = (bySeason) => bySeason[bySeason.length - 1] ?? null

/** The most recent race actually run at a circuit. RACES is newest first. */
export const lastRunOf = (races) => races.find((race) => race.status === 'completed') ?? null

/** The race worth offering from a car's page: its first win, else its last entry. */
export const notableRaceOf = (entries) => firstWinOf(entries) ?? entries[entries.length - 1] ?? null

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/**
 * Every onward band on the site, as {title?, items}. An item is
 * {to, label, hint}; a null is dropped by whoever draws it, so a band can be
 * written as the page reads and still come out with the two to four routes a
 * page actually has.
 */
export const ONWARD = {
  home: ({ latest }) => ({
    title: 'Popular ways in',
    items: [
      {
        to: latest ? `/seasons/${latest.year}` : '/seasons',
        label: `The ${latest ? latest.year : 'latest'} season`,
        hint: 'Calendar, title race and final standings.',
      },
      { to: '/records', label: 'Records', hint: 'Most wins, most poles, champions, grand slams.' },
      { to: '/data/sql', label: 'SQL console', hint: 'Ask the database your own question.' },
      {
        to: '/reference/eras',
        label: 'Eras and rules',
        hint: 'How the rules changed, and the words they are written in.',
      },
    ],
  }),

  seasons: () => ({
    items: [
      { to: '/races', label: 'Every race', hint: 'All 1,000-plus rounds in one filterable list.' },
      { to: '/records', label: 'Records', hint: 'Champions, most wins, most poles, grand slams.' },
      {
        to: '/reference/eras',
        label: 'Eras and rules',
        hint: 'Why a 1955 points total cannot be compared with a 2025 one.',
      },
    ],
  }),

  season: ({ season, year, neighbours }) => ({
    items: [
      season.drivers_champion
        ? {
            to: `/drivers/${season.drivers_champion}`,
            label: season.champion,
            hint: `The champion's full career, ${year} and everything either side of it.`,
          }
        : null,
      season.constructors_champion
        ? {
            to: `/constructors/${season.constructors_champion}`,
            label: season.constructors_champion_name,
            hint: 'The winning constructor, its cars and its record.',
          }
        : null,
      neighbours.next
        ? { to: `/seasons/${neighbours.next}`, label: `The ${neighbours.next} season`, hint: 'What happened next.' }
        : null,
      season.drivers_champion
        ? null
        : { to: '/races', label: 'Every race', hint: 'The rounds of this season beside all the others.' },
      { to: '/seasons', label: 'All seasons', hint: 'Seventy-seven championships, compared in one table.' },
    ],
  }),

  // IA-01: "By Grand Prix" is the band's first route, because the race list
  // is where a reader looking for the British Grand Prix arrives. Records
  // gave up its place: it is in the masthead, and this is a way in nothing
  // else on the page offers.
  races: () => ({
    items: [
      { to: '/grands-prix', label: 'By Grand Prix', hint: 'Every edition of each event, and every circuit it has used.' },
      { to: '/seasons', label: 'Seasons', hint: 'The same races, grouped into championships.' },
      { to: '/circuits', label: 'Circuits', hint: 'The venues these races were held at.' },
      { to: '/reference/glossary', label: 'Glossary', hint: 'What the words on a classification mean.' },
    ],
  }),

  grandsPrix: () => ({
    items: [
      { to: '/races', label: 'Every race', hint: 'Each edition as one round among all the others.' },
      { to: '/circuits', label: 'Circuits', hint: 'The venues, and the events each has held.' },
      { to: '/seasons', label: 'Seasons', hint: 'The calendars these events made up.' },
    ],
  }),

  grandPrix: ({ editions, winners }) => {
    const latest = lastRunOf(editions)
    return {
      items: [
        latest
          ? {
              to: `/races/${latest.year}/${latest.round}`,
              label: `${latest.year} ${latest.name_used}`,
              hint: 'The latest edition run, in full.',
            }
          : null,
        winners[0]
          ? {
              to: `/drivers/${winners[0].driver_id}`,
              label: winners[0].driver,
              // Level with someone is not "more than anyone", and where the
              // record is shared the band says so.
              hint: `Has won it ${plural(winners[0].wins, 'time', 'times')} — ${
                winners[1]?.wins === winners[0].wins ? 'a record shared with others' : 'more than anyone'
              }.`,
            }
          : null,
        { to: '/grands-prix', label: 'All Grands Prix', hint: 'Every event, by how often it has been held.' },
      ],
    }
  },

  race: ({ race, year, winners, neighbours }) => ({
    items: [
      race.circuit_id
        ? {
            to: `/circuits/${race.circuit_id}`,
            label: race.circuit,
            hint: 'The venue, its layouts and every race held there.',
          }
        : null,
      { to: `/seasons/${year}`, label: `The ${year} season`, hint: 'Calendar, title race and final standings.' },
      winners[0]?.driver_id
        ? {
            to: `/drivers/${winners[0].driver_id}`,
            label: winners[0].driver ?? 'The winner',
            hint: 'Their full career, race by race.',
          }
        : null,
      neighbours.next
        ? { to: `/races/${neighbours.next}`, label: 'The next race', hint: 'Where the championship went from here.' }
        : null,
    ],
  }),

  drivers: () => ({
    items: [
      { to: '/records', label: 'Records', hint: 'Most wins, most poles, every champion.' },
      { to: '/constructors', label: 'Constructors', hint: 'The teams these drivers drove for.' },
      { to: '/seasons', label: 'Seasons', hint: 'Championship tables year by year.' },
      { to: '/compare', label: 'Compare two drivers', hint: 'Two careers side by side, and how they fared as team-mates.' },
    ],
  }),

  driver: ({ results, bySeason }) => {
    const lastTeam = lastTeamOf(results)
    const bestSeason = bestSeasonOf(bySeason)
    return {
      items: [
      lastTeam
        ? {
            to: `/constructors/${lastTeam.constructor_id}`,
            label: lastTeam.constructor,
            hint: 'The team, its cars and everyone else who drove for it.',
          }
        : null,
      bestSeason
        ? {
            to: `/seasons/${bestSeason.year}`,
            label: `The ${bestSeason.year} season`,
            hint: bestSeason.wins
              ? `Their best year here — ${plural(bestSeason.wins, 'win', 'wins')} from ${bestSeason.entries} entries.`
              : 'The championship they were part of, round by round.',
          }
        : null,
        { to: '/records', label: 'Records', hint: 'Where this career sits against everyone else.' },
        { to: '/drivers', label: 'All drivers', hint: 'Filter the register by nationality or era.' },
      ],
    }
  },

  constructors: () => ({
    items: [
      { to: '/cars', label: 'Cars', hint: 'The chassis these teams built, with specifications.' },
      { to: '/records', label: 'Records', hint: 'Most wins by constructor, and every title.' },
      { to: '/drivers', label: 'Drivers', hint: 'Who drove for them.' },
    ],
  }),

  constructor: ({ constructor, designs, bySeason }) => {
    const bestCar = bestDesignOf(designs)
    const lastSeason = lastSeasonOf(bySeason)
    return {
      items: [
      bestCar
        ? {
            to: `/cars/${bestCar.id}`,
            label: bestCar.name,
            hint: bestCar.wins
              ? `Their most successful design — ${plural(bestCar.wins, 'win', 'wins')}.`
              : 'Specification, entries and results.',
          }
        : null,
      lastSeason
        ? {
            to: `/seasons/${lastSeason.year}`,
            label: `The ${lastSeason.year} season`,
            hint: constructor.active ? 'The championship as it stands.' : 'Their last season in the championship.',
          }
        : null,
        { to: '/records', label: 'Records', hint: 'Most wins by constructor, and every title.' },
        { to: '/constructors', label: 'All constructors', hint: 'The other 149, filterable by country and era.' },
      ],
    }
  },

  circuits: () => ({
    items: [
      { to: '/races', label: 'Every race', hint: 'What was run at each of these venues.' },
      {
        to: '/reference/eras',
        label: 'Eras and rules',
        hint: 'The safety work that redrew many of these circuits.',
      },
    ],
  }),

  circuit: ({ races, winners }) => {
    const latest = lastRunOf(races)
    return {
      items: [
      latest
        ? {
            to: `/races/${latest.year}/${latest.round}`,
            label: `${latest.year} ${latest.name_used}`,
            hint: 'The most recent race held here, in full.',
          }
        : null,
      winners[0]
        ? {
            to: `/drivers/${winners[0].driver_id}`,
            label: winners[0].driver,
            hint: `Has won here ${plural(winners[0].wins, 'time', 'times')} — more than anyone.`,
          }
        : null,
        { to: '/circuits', label: 'All circuits', hint: 'Eighty venues, by races held.' },
      ],
    }
  },

  cars: () => ({
    items: [
      { to: '/constructors', label: 'Constructors', hint: 'The teams that built and ran them.' },
      {
        to: '/reference/eras',
        label: 'Eras and rules',
        hint: 'The regulations these cars were designed around.',
      },
      { to: '/records', label: 'Records', hint: 'What the fastest of them actually won.' },
    ],
  }),

  car: ({ chassis, car, entries }) => {
    const firstWin = firstWinOf(entries)
    const notableRace = notableRaceOf(entries)
    return {
      items: [
      chassis.constructor_id
        ? {
            to: `/constructors/${chassis.constructor_id}`,
            label: chassis.constructor,
            hint: 'The team that built it, and everything else it made.',
          }
        : null,
      notableRace
        ? {
            to: `/races/${notableRace.year}/${notableRace.round}`,
            label: `${notableRace.year} ${notableRace.name_used}`,
            hint: firstWin ? 'Its first win, in full.' : 'A race it entered, in full.',
          }
        : null,
      car?.supersedes_id
        ? { to: `/cars/${car.supersedes_id}`, label: 'The car before it', hint: 'What this design replaced.' }
        : null,
        { to: '/cars', label: 'All cars', hint: '1,153 chassis, filterable by team and era.' },
      ],
    }
  },

  records: ({ driverWins }) => ({
    items: [
      driverWins[0]
        ? {
            to: `/drivers/${driverWins[0].driver_id}`,
            label: driverWins[0].full_name,
            hint: `${driverWins[0].wins} wins — the most of anyone.`,
          }
        : null,
      { to: '/seasons', label: 'Seasons', hint: 'How each of those championships was actually won.' },
      {
        to: '/data/sql',
        label: 'Ask your own question',
        hint: 'The SQL console, for the leaderboard that is not on this page.',
      },
    ],
  }),

  eras: () => ({
    items: [
      { to: '/cars', label: 'Cars', hint: 'The designs these rules produced.' },
      { to: '/seasons', label: 'Seasons', hint: 'The championships they were raced under.' },
      { to: '/reference/glossary', label: 'Glossary', hint: 'The vocabulary the rules are written in.' },
    ],
  }),

  glossary: () => ({
    items: [
      { to: '/reference/eras', label: 'Eras and rules', hint: 'Where most of this vocabulary comes from.' },
      { to: '/races', label: 'Races', hint: 'See the terms in use on a classification.' },
      { to: '/data/quality', label: 'Data quality', hint: 'What “verified” and “reference” mean here.' },
    ],
  }),

  data: () => ({
    items: [
      {
        to: '/data/quality',
        label: 'Data quality',
        hint: 'The ladder, the gaps, the disagreements, the coverage.',
      },
      { to: '/data/sources', label: 'Sources and licences', hint: 'Who says so, and what you may reuse.' },
      { to: '/data/sql', label: 'SQL console', hint: 'Pull the rows you need straight out of the database.' },
    ],
  }),

  quality: () => ({
    items: [
      { to: '/data/sources', label: 'Sources and licences', hint: 'Who says so, and what you may reuse.' },
      { to: '/data/sql', label: 'SQL console', hint: 'Interrogate any of this yourself.' },
      { to: '/records', label: 'Records', hint: 'The figures these checks are protecting.' },
    ],
  }),

  sources: () => ({
    items: [
      { to: '/data/quality', label: 'Data quality', hint: 'How far to trust each figure, and what is missing.' },
      { to: '/data/sql', label: 'SQL console', hint: 'Pull the rows you need straight out of the database.' },
      {
        to: '/data',
        label: 'Data',
        hint: 'The database itself: the files, the version, and how far to trust it.',
      },
    ],
  }),

  compare: () => ({
    items: [
      { to: '/drivers', label: 'All drivers', hint: 'Filter the register by nationality or era.' },
      { to: '/records', label: 'Records', hint: 'Most wins, most poles, every champion.' },
      { to: '/seasons', label: 'Seasons', hint: 'Championship tables year by year.' },
    ],
  }),

  sql: () => ({
    items: [
      {
        to: '/data/quality',
        label: 'Data quality',
        hint: 'What the confidence column means before you quote a row.',
      },
      { to: '/data/sources', label: 'Sources and licences', hint: 'What you may do with what you pull out.' },
      { to: '/records', label: 'Records', hint: 'The leaderboards already written for you.' },
    ],
  }),

  about: () => ({
    items: [
      { to: '/data', label: 'Data', hint: 'The file itself, what it holds, and what you may do with it.' },
      { to: '/data/quality', label: 'Data quality', hint: 'The ladder, every gap, every disagreement.' },
      {
        to: '/data/sources',
        label: 'Sources and licences',
        hint: 'Who says so, and what each licence cost or bought.',
      },
    ],
  }),

  changes: ({ latest }) => ({
    items: [
      latest
        ? {
            to: `/races/${latest.year}/${latest.round}`,
            label: latest.name_used,
            hint: 'The most recent race this database holds the classification of.',
          }
        : null,
      {
        to: '/data/quality',
        label: 'Data quality',
        hint: 'The disagreements and the gaps counted above, one by one.',
      },
      { to: '/data', label: 'Data', hint: 'The whole database as one file, and how to query it.' },
    ],
  }),

  notFound: () => ({
    title: 'Try one of these',
    items: [
      { to: '/', label: 'Overview', hint: 'The last race, the next one, and where everything lives.' },
      { to: '/seasons', label: 'Seasons', hint: 'Seventy-seven championships, newest first.' },
      { to: '/drivers', label: 'Drivers', hint: 'Every driver with a championship entry.' },
      { to: '/records', label: 'Records', hint: 'Most wins, most poles, every champion.' },
    ],
  }),
}

/* ---------------------------------------------------- the step sideways */

/**
 * The neighbours on either side, as {previous, next} links.
 *
 * queries/race.js and queries/season.js each return a `previous`/`next` pair
 * of addresses; these put the labels on them. IA-03: the static page carried
 * neither, so /races/2026/13 held no link to round 12 or 14 for anyone
 * reading it before the database opened.
 */
export const raceSteps = (neighbours) => ({
  previous: neighbours.previous ? { to: `/races/${neighbours.previous}`, label: 'Previous race' } : null,
  next: neighbours.next ? { to: `/races/${neighbours.next}`, label: 'Next race' } : null,
})

export const seasonSteps = (neighbours) => ({
  previous: neighbours.previous
    ? { to: `/seasons/${neighbours.previous}`, label: `${neighbours.previous} season` }
    : null,
  next: neighbours.next ? { to: `/seasons/${neighbours.next}`, label: `${neighbours.next} season` } : null,
})
