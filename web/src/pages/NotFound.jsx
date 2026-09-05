import { Link } from 'react-router-dom'
import { Page } from '../components/Page.jsx'

export default function NotFound() {
  return (
    <Page title="No such page" lede="That route is not one this site has.">
      <p>
        Try the <Link to="/">overview</Link>, or press <kbd>/</kbd> to search every driver, team,
        circuit, car, season and race at once.
      </p>
    </Page>
  )
}
