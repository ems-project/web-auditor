const args = require('yargs').argv
const pa11y = require('pa11y')
const { PuppeteerCrawler, Dataset } = require('crawlee')
const cliProgress = require('cli-progress')
const crypto = require('crypto')
const String = require('./Helpers/String')
const LinkAuditor = require('./Helpers/LinkAuditor')
const Header = require('./Helpers/Header')

const baseUrl = args._[0]
let datasetId = args._[1]
const ignoreSsl = args['ignore-ssl']
const waitUntil = args['wait-until']
const content = args.content
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
const origin = (new URL(baseUrl)).origin
const linkAuditor = new LinkAuditor(origin, content)
if (ignoreSsl) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0
}

const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
progressBar.start(1, 0)

const crawler = new PuppeteerCrawler({
  launchContext: {
    launchOptions: {
      ignoreHTTPSErrors: ignoreSsl
    }
  },
  preNavigationHooks: [
    async (crawlingContext, gotoOptions) => {
      gotoOptions.timeout = 20_000
      gotoOptions.navigationTimeoutSecs = 10
      if (waitUntil) {
        gotoOptions.waitUntil = waitUntil
      }
    }
  ],
  async requestHandler ({ request, page, enqueueLinks }) {
    const url = new URL(request.loadedUrl)
    const data = {
      url: request.loadedUrl,
      redirected: request.url !== request.loadedUrl,
      host: url.hostname,
      base_url: url.pathname,
      timestamp: String.getTimestamp(),
      is_web: true
    }
    try {
      const urlAudit = await linkAuditor.auditUrl(request.loadedUrl)
      for (const field in urlAudit) {
        if (['text', 'type'].includes(field)) {
          continue
        }
        data[field] = urlAudit[field]
      }
      data.meta_title = await page.title()
      if (Header.isHtmlMimetype(data.mimetype)) {
        data.title = await page.$('h1') ? await page.$eval('h1', el => el.textContent) : null
        data.locale = await page.$('html') ? await page.$eval('html', el => el.getAttribute('lang')) : null
        if (content) {
          const body = await page.$('body')
          data.content = await page.evaluate(el => el.textContent, body)
          data.content = data.content.replace(/\s{2,}/g, ' ').trim()
        }
        const hrefs = await page.$$eval('[href], [src]', links => links.filter(a => (a.href ?? a.src).length > 0).map(a => {
          const url = a.href ?? a.src
          const text = (a.innerText ?? '').trim()
          const type = a.tagName.toLowerCase()
          return {
            type,
            text,
            url
          }
        }))
        const auditUrls = await linkAuditor.auditUrls(hrefs.map(link => link.url))
        for (const auditIndex in auditUrls) {
          for (const hrefIndex in hrefs) {
            if (auditUrls[auditIndex].url !== hrefs[hrefIndex].url) {
              continue
            }
            for (const field in auditUrls[auditIndex]) {
              if (hrefs[hrefIndex][field] || !['url', 'status_code', 'message', 'mimetype', 'type', 'text'].includes(field)) {
                continue
              }
              hrefs[hrefIndex][field] = auditUrls[auditIndex][field]
            }
          }
        }
        data.links = hrefs
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
        const combinedIssues = audit.issues
        mobileAudit.issues.forEach(mobileIssue => {
          const existsInDesktop = audit.issues.some(desktopIssue =>
            desktopIssue.code === mobileIssue.code &&
              desktopIssue.context === mobileIssue.context &&
              desktopIssue.selector === mobileIssue.selector &&
              desktopIssue.message === mobileIssue.message
          )

          if (existsInDesktop) {
            return
          }
          combinedIssues.push({ ...mobileIssue, mobile: true })
        })
        combinedIssues.forEach((item) => {
          delete item.runner
          delete item.type
          delete item.typeCode
          delete item.runnerExtras
          item.mobile = (item.mobile === true)
        })
        data.pa11y = combinedIssues
        if (data.status_code === 200 && combinedIssues.length > 0) {
          totalIssuesCount += combinedIssues.length
          pagesWithIssuesCount++
        }
      }
    } catch (err) {
      data.status_code = data.status_code ?? 500
      data.error = err.message ?? 'This url encountered an unknown error'
    }
    await enqueueLinks({
      transformRequestFunction (req) {
        const url = new URL(req.url)
        if (url.origin !== origin) {
          return false
        }
        const shasum = crypto.createHash('sha1')
        shasum.update(`AuditHashSeed$${url.origin}${url.pathname}`)
        const hash = shasum.digest('hex')
        if (hashes.includes(hash)) {
          return false
        }
        hashes.push(hash)
        const auditUrl = linkAuditor.getFromCache(req.url)
        if (!auditUrl || (!auditUrl.mimetype && auditUrl.status_code < 400) || Header.isHtmlMimetype(auditUrl.mimetype)) {
          if (auditUrl.content) {
            delete auditUrl.content
          }
          return req
        }

        const data = {
          url: req.url,
          redirected: req.url !== req.loadedUrl,
          host: url.hostname,
          base_url: url.pathname,
          timestamp: String.getTimestamp(),
          is_web: true,
          status_code: auditUrl.status_code ?? 500,
          mimetype: auditUrl.mimetype ?? null
        }
        if (auditUrl.content) {
          data.content = auditUrl.content
          delete auditUrl.content
        }
        dataset.pushData(data)

        return false
      }
    })
    this.requestQueue.getInfo().then((info) => {
      progressBar.update(info.handledRequestCount)
      progressBar.setTotal(info.totalRequestCount)
    })
    page.close()
    return dataset.pushData(data)
  },
  async failedRequestHandler ({ request }) {
    const url = new URL(request.url)
    const curlAudit = await linkAuditor.auditUrl(request.url)
    const data = {
      url: request.url,
      redirected: request.url !== request.loadedUrl,
      host: url.hostname,
      base_url: url.pathname,
      timestamp: String.getTimestamp(),
      is_web: false,
      status_code: curlAudit.status_code ?? 500,
      mimetype: curlAudit.mimetype
    }
    return dataset.pushData(data)
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
  progressBar.stop()

  if (crawler.stats.state.requestsFinished > 1) {
    logSummaryReport(totalIssuesCount, pagesWithIssuesCount, baseUrl)
  }
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
