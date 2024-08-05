const args = require('yargs').argv
const pa11y = require('pa11y')
const { PuppeteerCrawler, Dataset } = require('crawlee')
const cliProgress = require('cli-progress')
const crypto = require('crypto')
const String = require('./Helpers/String')

const baseUrl = args._[0]
let datasetId = args._[1]
const hashes = []
const referers = []
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
      redirected: request.url !== request.loadedUrl,
      host: url.hostname,
      base_url: url.pathname,
      timestamp: String.getTimestamp(),
      referer: referers[request.url] ?? null,
      is_web: true
    }
    try {
      const response = await page.goto(request.loadedUrl)
      const headers = response.headers()

      let status = (await response).status()
      if (status === 304) {
        status = 200
      }
      data.status_code = status
      data.mimetype = headers['content-type']
      data.size = headers['content-length']
      if (data.size) {
        data.size = parseInt(data.size)
      }

      data.meta_title = await page.title()
      if (data.mimetype.startsWith('text/html')) {
        data.title = await page.$('h1') ? await page.$eval('h1', el => el.textContent) : null
        data.locale = await page.$('html') ? await page.$eval('html', el => el.getAttribute('lang')) : null
        const audit = await pa11y(request.loadedUrl, {
          browser: page.browser(),
          page
        })
        const mobileAudit = await pa11y(request.loadedUrl, {
          browser: page.browser(),
          page,
          viewport: {
            width: 375,
            height: 640,
            deviceScaleFactor: 2,
            isMobile: true
          }
        })
        const combinedIssues = audit.issues.slice()

        mobileAudit.issues.forEach(mobileIssue => {
          const existsInDesktop = audit.issues.some(desktopIssue =>
            desktopIssue.code === mobileIssue.code &&
              desktopIssue.context === mobileIssue.context &&
              desktopIssue.selector === mobileIssue.selector &&
              desktopIssue.message === mobileIssue.message
          )

          if (!existsInDesktop) {
            combinedIssues.push({ ...mobileIssue, flag: 'mobile' })
          }
        })
        data.pa11y = combinedIssues.slice(0, 10)
        if (status === 200 && combinedIssues.length > 0) {
          totalIssuesCount += combinedIssues.length
          pagesWithIssuesCount++
        }
      }
    } catch (err) {
      data.error = err.message ?? 'This url encountered an unknown error'
    } finally {
      await dataset.pushData(data)
    }
    await enqueueLinks({
      transformRequestFunction (req) {
        const url = new URL(req.url)
        const shasum = crypto.createHash('sha1')
        shasum.update(`AuditHashSeed$${url.origin}${url.pathname}`)
        const hash = shasum.digest('hex')
        if (hashes.includes(hash)) {
          return false
        }
        hashes.push(hash)
        if (!referers.includes(req.url)) {
          referers[req.url] = request.loadedUrl
        }

        return req
      }
    })
    this.requestQueue.getInfo().then((info) => {
      progressBar.update(info.handledRequestCount)
      progressBar.setTotal(info.totalRequestCount)
    })
  },
  async failedRequestHandler ({ request }) {
    const url = new URL(request.url)
    const data = {
      url: request.url,
      redirected: request.url !== request.loadedUrl,
      host: url.hostname,
      base_url: url.pathname,
      timestamp: String.getTimestamp(),
      referer: referers[request.url] ?? null,
      is_web: false
    }
    await dataset.pushData(data)
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
