import { chromium } from 'playwright'

const browser = await chromium.launch()
for (const width of [1280, 900, 700, 560, 480, 375]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.goto('http://localhost:4321/constructors/ferrari')
  await page.waitForSelector('.stats')
  const tiles = await page.evaluate(() => {
    const dl = document.querySelector('.stats')
    return [...dl.children].map((el) => {
      const dt = el.querySelector('dt')
      const dd = el.querySelector('dd')
      return {
        label: dt?.textContent,
        elTop: Math.round(el.getBoundingClientRect().top),
        ddTop: Math.round(dd.getBoundingClientRect().top),
        lines: Math.round(dt.getBoundingClientRect().height / parseFloat(getComputedStyle(dt).lineHeight)),
      }
    })
  })
  console.log('width', width, JSON.stringify(tiles))
  await page.close()
}
await browser.close()
