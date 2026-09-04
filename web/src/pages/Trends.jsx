import { useQuery } from '../useQuery.js'
import { Page } from '../components/Page.jsx'
import { Result } from '../components/State.jsx'
import Figure from '../charts/Figure.jsx'
import LineChart from '../charts/LineChart.jsx'
import ColumnChart from '../charts/ColumnChart.jsx'
import BarChart from '../charts/BarChart.jsx'
import DotPlot from '../charts/DotPlot.jsx'
import { fmt } from '../charts/scales.js'

const CALENDAR = `SELECT year, rounds FROM seasons ORDER BY year`

const POLE_TO_WIN = `
SELECT (year/10)*10 AS decade,
       SUM(races) AS races,
       SUM(pole_converted) AS converted,
       ROUND(SUM(pole_converted) * 100.0 / SUM(races)) AS pct
FROM v_pole_to_win
GROUP BY decade
ORDER BY decade`

const POWER = `
SELECT full_name, from_year, power_bhp, aspiration, wins
FROM cars
WHERE power_bhp IS NOT NULL
ORDER BY from_year, full_name`

const MARGINS = `
SELECT year, champion, runner_up, margin
FROM v_champions
WHERE margin IS NOT NULL
ORDER BY margin, year
LIMIT 12`

export default function Trends() {
  const calendar = useQuery(CALENDAR)
  const poleToWin = useQuery(POLE_TO_WIN)
  const power = useQuery(POWER)
  const margins = useQuery(MARGINS)

  return (
    <Page
      title="Trends"
      lede="Four questions the race records can answer on their own. Every chart is a query against f1.db running in this tab, and every one of them has a table underneath it — the shape is the point, but the numbers should never be locked inside a hover."
    >
      <Result state={calendar} what="Loading the database">
        {(data) => (
          <Figure
            title="The season got longer"
            subtitle="Rounds on the championship calendar, 1950–2026"
            note="1950 ran seven races; 2026 schedules 23. The last point is the calendar as published — twelve of those rounds have been run."
            table={{ data, labels: { rounds: 'Rounds' } }}
          >
            {(width) => (
              <LineChart
                width={width}
                data={data.rows}
                x={(r) => r.year}
                y={(r) => r.rounds}
                formatX={(v) => String(Math.round(v))}
                formatY={(v) => fmt(v)}
                label="Rounds"
              />
            )}
          </Figure>
        )}
      </Result>

      <Result state={poleToWin} what="Loading the database">
        {(data) => (
          <Figure
            title="Pole matters more than it used to"
            subtitle="Share of races won from pole position, by decade"
            note="Every one of the 1,161 championship races carries a pole and a winner, so this is the whole population rather than a sample. The 2020s are still in progress."
            table={{
              data,
              columns: ['decade', 'races', 'converted', 'pct'],
              labels: { pct: 'Won from pole (%)', converted: 'Won from pole' },
            }}
          >
            {(width) => (
              <ColumnChart
                width={width}
                data={data.rows}
                x={(r) => `${r.decade}s`}
                y={(r) => r.pct}
                formatY={(v) => `${v}%`}
                label="Won from pole"
              />
            )}
          </Figure>
        )}
      </Result>

      <Result state={power} what="Loading the database">
        {(data) => (
          <Figure
            title="Power, across seventy years of landmark cars"
            subtitle="Engine output of the 29 cars in the register, by the year each first raced"
            note="These are landmark chassis, not a survey of the field, so this shows the sport's development through the cars the register happens to hold rather than measuring it. Worth knowing before reading a turbo era into the shape: the register's highest figure is 1,000 bhp, shared by the W11 and the RB19, and its only two pre-hybrid turbo cars are the Renault RS01 at 510 bhp and the already boost-limited MP4/4 at 675. The qualifying-boost engines of the mid-1980s, usually quoted far higher, are simply not in it — the spike is missing rather than flattened."
            table={{
              data,
              columns: ['full_name', 'from_year', 'power_bhp', 'aspiration', 'wins'],
              labels: { full_name: 'Car', from_year: 'From', power_bhp: 'Power (bhp)' },
            }}
          >
            {(width) => (
              <DotPlot
                width={width}
                data={data.rows}
                x={(r) => r.from_year}
                y={(r) => r.power_bhp}
                name={(r) => r.full_name}
                formatX={(v) => String(Math.round(v))}
                formatY={(v) => fmt(v)}
                label="Power in bhp"
              />
            )}
          </Figure>
        )}
      </Result>

      <Result state={margins} what="Loading the database">
        {(data) => (
          <Figure
            title="The championships that came down to nothing"
            subtitle="The twelve smallest title margins, in points"
            note="Points are not comparable across eras — a win was worth 8 points in 1958 and 25 today, and for years only your best results counted. Half a point separated Lauda and Prost in 1984 because Monaco was stopped in the rain and paid half."
            table={{
              data,
              columns: ['year', 'champion', 'runner_up', 'margin'],
              labels: { runner_up: 'Runner-up', margin: 'Margin (points)' },
            }}
          >
            {(width) => (
              <BarChart
                width={width}
                data={data.rows}
                x={(r) => `${r.year}  ${r.champion}`}
                y={(r) => r.margin}
                labelWidth={Math.min(220, Math.max(140, width * 0.32))}
                formatValue={(v) => fmt(v, Number.isInteger(v) ? 0 : 1)}
                label="Title margin"
              />
            )}
          </Figure>
        )}
      </Result>
    </Page>
  )
}
