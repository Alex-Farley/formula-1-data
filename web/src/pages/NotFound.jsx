import { Onward, Page } from '../components/Page.jsx'

export default function NotFound() {
  return (
    <Page
      title="No such page"
      lede="That address is not one this site has. Press / to search every driver, team, circuit, car, season and race at once — or pick up one of these."
    >
      <Onward
        title="Try one of these"
        items={[
          { to: '/', label: 'Overview', hint: 'The last race, the next one, and where everything lives.' },
          { to: '/seasons', label: 'Seasons', hint: 'Seventy-seven championships, newest first.' },
          { to: '/drivers', label: 'Drivers', hint: 'Every driver with a championship entry.' },
          { to: '/records', label: 'Records', hint: 'Most wins, most poles, every champion.' },
        ]}
      />
    </Page>
  )
}
