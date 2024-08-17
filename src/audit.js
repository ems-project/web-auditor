const args = require('yargs').argv
const pa11y = require('pa11y')
const { PuppeteerCrawler, Dataset } = require('crawlee')
const cliProgress = require('cli-progress')
const crypto = require('crypto')
const String = require('./Helpers/String')
const LinkAuditor = require('./Helpers/LinkAuditor')

const baseUrl = args._[0]
let datasetId = args._[1]
const ca = args.ca ?? undefined
const hashes = []
const referers = []
let dataset = null
const linkAuditor = new LinkAuditor(ca)
const statusByUrl = []
const friendlyHttpStatus = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  306: 'Unused',
  307: 'Temporary Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Required',
  413: 'Request Entry Too Large',
  414: 'Request-URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Requested Range Not Satisfiable',
  417: 'Expectation Failed',
  418: 'I\'m a teapot',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported'
}

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
        const hrefs = await page.$$eval('[href], [src]', links => links.filter(a => (a.href ?? a.src).length > 0).map(a => {
          const url = a.href ?? a.src
          let text = a.innerText
          if (text.length === 0) {
            text = url.split('/').filter(path => path !== '').pop()
          }
          return {
            text,
            url
          }
        }))
        const auditUrls = await linkAuditor.auditUrls(hrefs.map(link => link.url).filter(link => {
          const linkUrl = new URL(link)
          return linkUrl.host !== url.host || linkUrl.port !== url.port || linkUrl.protocol !== url.protocol
        }))
        for (const auditIndex in auditUrls) {
          for (const hrefIndex in hrefs) {
            if (auditUrls[auditIndex].url !== hrefs[hrefIndex].url) {
              continue
            }
            hrefs[hrefIndex] = Object.assign(auditUrls[auditIndex], hrefs[hrefIndex])
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
        combinedIssues.forEach((item) => {
          delete item.runner
          delete item.type
          delete item.typeCode
          delete item.runnerExtras
        })
        data.pa11y = combinedIssues
        if (status === 200 && combinedIssues.length > 0) {
          totalIssuesCount += combinedIssues.length
          pagesWithIssuesCount++
        }
      }
    } catch (err) {
      data.status_code = data.status_code ?? 500
      data.error = err.message ?? 'This url encountered an unknown error'
    } finally {
      await dataset.pushData(data)
      statusByUrl[data.url] = {
        status_code: data.status_code,
        message: data.error ?? friendlyHttpStatus[data.status_code] ?? ''
      }
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
    const curlStatus = await linkAuditor.auditUrls([request.url])
    const data = {
      url: request.url,
      redirected: request.url !== request.loadedUrl,
      host: url.hostname,
      base_url: url.pathname,
      timestamp: String.getTimestamp(),
      referer: referers[request.url] ?? null,
      is_web: false,
      status_code: curlStatus[0].status_code ?? 500
    }
    await dataset.pushData(data)
    statusByUrl[request.url] = {
      status_code: data.status_code,
      message: curlStatus[0].statusMessage ?? friendlyHttpStatus[data.status_code] ?? ''
    }
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
