const args = require('yargs').argv
const pa11y = require('pa11y')
const { PuppeteerCrawler, Dataset } = require('crawlee')
const cliProgress = require('cli-progress')
const crypto = require('crypto')
const String = require('./Helpers/String')

const baseUrl = args._[0]
let datasetId = args._[1]
const hashes = []
let dataset = null

let pagesWithIssuesCount = 0
let totalIssuesCount = 0

if (undefined === baseUrl) {
  console.log('The argument website to test is mandatory')
  process.exit(-1)
}
if (undefined === datasetId) {
  datasetId = baseUrl.replaceAll('/', '_').replaceAll(':', '')
}

const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
progressBar.start(1, 0)

const crawler = new PuppeteerCrawler({
  preNavigationHooks: [
    async (crawlingContext, gotoOptions) => {
      gotoOptions.timeout = 20_000
      gotoOptions.navigationTimeoutSecs = 10
    }
  ],
  async requestHandler ({ request, page, enqueueLinks, log }) {
    const url = new URL(request.loadedUrl)
    const data = {
      url: request.loadedUrl,
      host: url.hostname,
      base_url: url.pathname,
      timestamp: String.getTimestamp()
    }
    try {
      data.meta_title = await page.title()
      data.title = await page.$('h1') ? await page.$eval('h1', el => el.textContent) : null
      data.locale = await page.$('html') ? await page.$eval('html', el => el.getAttribute('lang')) : null
      const response = page.waitForResponse(request.loadedUrl)
      const audit = await pa11y(request.loadedUrl, {
        browser: page.browser(),
        page
      })

      const headers = (await response).headers()

      let status = (await response).status()
      if (status === 304) {
        status = 200
      }
      data.status_code = status
      data.mimetype = headers['content-type']
      data.size = headers['content-length']
      data.pa11y = audit.issues.slice(0, 10)
      if (status === 200 && audit.issues.length > 0) {
        totalIssuesCount += audit.issues.length
        pagesWithIssuesCount++
      }
    } catch (err) {
      console.log(err)
    } finally {
      await dataset.pushData(data)
    }
    await enqueueLinks({
      transformRequestFunction (req) {
        const url = new URL(req.url)

        if (url.pathname.endsWith('.pdf')) return false
        if (url.pathname.endsWith('.doc')) return false
        if (url.pathname.endsWith('.docx')) return false
        if (url.pathname.endsWith('.xls')) return false
        if (url.pathname.endsWith('.xlsx')) return false
        if (url.pathname.endsWith('.zip')) return false
        if (url.pathname.endsWith('.xlsm')) return false
        if (url.pathname.endsWith('.xml')) return false
        if (url.pathname.endsWith('.odt')) return false
        if (url.pathname.endsWith('.dwg')) return false
        if (url.pathname.endsWith('.jpeg')) return false
        if (url.pathname.endsWith('.jpg')) return false
        if (url.pathname.endsWith('.png')) return false
        if (url.pathname.endsWith('.png')) return false
        if (url.pathname.endsWith('.xsd')) return false
        if (url.pathname.endsWith('.txt')) return false
        if (url.pathname.endsWith('.mp4')) return false

        const shasum = crypto.createHash('sha1')
        shasum.update(`AuditHashSeed$${url.origin}${url.pathname}`)
        const hash = shasum.digest('hex')
        if (hashes.includes(hash)) {
          return false
        }
        hashes.push(hash)

        return req
      }
    })
    this.requestQueue.getInfo().then((info) => {
      progressBar.update(info.handledRequestCount)
      progressBar.setTotal(info.totalRequestCount)
    })
  },
  async failedRequestHandler ({ request }) {
    console.log(request)
  },
  headless: true,
  maxConcurrency: 100
});

(async () => {
  dataset = await Dataset.open(datasetId)
  const info = await dataset.getInfo()
  if (info.itemCount !== 0) {
    await dataset.drop()
    dataset = await Dataset.open(datasetId)
  }
  await crawler.run([baseUrl])

  if (crawler.stats.state.requestsFinished > 1) {
    logSummaryReport(totalIssuesCount, pagesWithIssuesCount, baseUrl)
  }

  progressBar.stop()
})()

function logSummaryReport (totalIssuesCount, pagesWithIssuesCount, baseUrl) {
  console.log('\n------------------------------------------------------------')
  if (totalIssuesCount > 0) {
    console.log(`${totalIssuesCount} error${totalIssuesCount !== 1 ? 's' : ''} found on ${pagesWithIssuesCount} page${pagesWithIssuesCount > 0 ? 's' : ''}`)
    console.log(`Launch "node src/create.js ${baseUrl}" for detailed report`)
  } else {
    console.log('Yippee ki‐yay! No accessibility error found.')
  }
  console.log('------------------------------------------------------------\n')
}
