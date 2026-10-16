import { Onward, Page } from '../components/Page.jsx'

import { ONWARD } from '../lib/wayfinding.js'
import { NAMES, NOT_FOUND_LEDE } from '../lib/site.js'
export default function NotFound() {
  return (
    <Page
      cite={false}
      title={NAMES.notFound().headline}
      documentName={NAMES.notFound().title}
      lede={NOT_FOUND_LEDE}
    >
      <Onward {...ONWARD.notFound()} />
    </Page>
  )
}
