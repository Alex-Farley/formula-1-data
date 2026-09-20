import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

async function statStrip(url) {
  await page.goto(url)
  await page.waitForSelector('.stats', { timeout: 5000 }).catch(() => {})
  return await page.evaluate(() => {
    const dl = document.querySelector('.stats')
    if (!dl) return null
    const tiles = [...dl.children].map((el) => {
      const dt = el.querySelector('dt')
      const dd = el.querySelector('dd')
      return {
        label: dt?.textContent,
        elTop: Math.round(el.getBoundingClientRect().top),
        elTopRaw: el.getBoundingClientRect().top,
        ddTop: Math.round(dd.getBoundingClientRect().top),
        ddTopRaw: dd.getBoundingClientRect().top,
        lines: Math.round(dt.getBoundingClientRect().height / parseFloat(getComputedStyle(dt).lineHeight)),
      }
    })
    return tiles
  })
}

for (const url of ['http://localhost:4321/constructors/ferrari', 'http://localhost:4321/drivers/beppe-gabbiani']) {
  console.log('===', url)
  console.log(JSON.stringify(await statStrip(url), null, 2))
}

await browser.close()
