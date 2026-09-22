import { Onward, Page } from '../components/Page.jsx'

import { ONWARD } from '../lib/wayfinding.js'
export default function NotFound() {
  return (
    <Page
      cite={false}
      title="No such page"
      lede="That address is not one this site has. Press / to search every driver, team, circuit, car, season and race at once — or pick up one of these."
    >
      <Onward {...ONWARD.notFound()} />
    </Page>
  )
}
