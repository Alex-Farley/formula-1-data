import { Onward, Page } from '../components/Page.jsx'

import { ONWARD } from '../lib/wayfinding.js'
import { NAMES } from '../lib/site.js'
export default function NotFound() {
  return (
    <Page
      cite={false}
      title={NAMES.notFound().headline}
      documentName={NAMES.notFound().title}
      lede="That address is not one this site has. Press / to search every driver, team, circuit, car, season and race at once — or pick up one of these."
    >
      <Onward {...ONWARD.notFound()} />
    </Page>
  )
}
