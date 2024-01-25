const args = require('yargs').argv
const pa11y = require('pa11y')
const { PuppeteerCrawler, Dataset } = require('crawlee')
const cliProgress = require('cli-progress')
const crypto = require('crypto')
const String = require('./Helpers/String')

const baseUrl = args._[0]
let datasetId = args._[1]
const hashes = []
let errorCounter = 0
const pagesInError = []
const pagesCounter = []

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
    try {
      const metaTitle = await page.title()
      const title = await page.$('h1') ? await page.$eval('h1', el => el.textContent) : null
      const locale = await page.$('html') ? await page.$eval('html', el => el.getAttribute('lang')) : null

      const response = page.waitForResponse(request.loadedUrl)
      const audit = await pa11y(request.loadedUrl, {
        browser: page.browser(),
        page
      })

      const headers = (await response).headers()
      if (audit.issues.length > 0) {
        log.info(`${audit.issues.length} errors with page ${request.loadedUrl} : '${metaTitle}'`)
      }

      const url = new URL(request.loadedUrl)
      let status = (await response).status()
      if (status === 304) {
        status = 200
      }
      const dataset = await Dataset.open(datasetId)
      if (audit.issues.length > 0) {
        errorCounter += audit.issues.length
        pagesInError.push(request.loadedUrl)
        pagesCounter.push(audit.issues.length)
      }
      await dataset.pushData({
        title,
        meta_title: metaTitle,
        url: request.loadedUrl,
        pa11y: audit.issues.slice(0, 10),
        host: url.hostname,
        base_url: url.pathname,
        status_code: status,
        mimetype: headers['content-type'],
        locale,
        size: headers['content-length'],
        timestamp: String.getTimestamp()
      })
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
    } catch (err) {
      console.log(err)
    }
  },
  async failedRequestHandler ({ request }) {
    console.log(request)
  },
  headless: true,
  maxConcurrency: 100
});

(async () => {
  await crawler.run([baseUrl])
  console.log('-------------------------------------------------------------------------------------')
  if (errorCounter === 0) {
    console.log('Hooray! No accessibility error found.')
  } else {
    console.log(`${errorCounter} errors found on ${pagesInError.length} pages.`)
    for (let i = 0; i < pagesInError.length && i < 50; ++i) {
      console.log(`- ${pagesInError[i]} (${pagesCounter[i]} errors)`)
    }
    if (pagesInError.length > 50) {
      console.log('...')
    }
  }
  console.log('-------------------------------------------------------------------------------------')
  progressBar.stop()
})()
