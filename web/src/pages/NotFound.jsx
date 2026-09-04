import { Link } from 'react-router-dom'
import { Page } from '../components/Page.jsx'

export default function NotFound() {
  return (
    <Page title="Not here">
      <p className="muted">
        That page does not exist. <Link to="/">Start at the seasons</Link>, or ask the database
        directly on the <Link to="/console">SQL page</Link>.
      </p>
    </Page>
  )
}
