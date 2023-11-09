const args = require('yargs').argv
// const CoreApi = require('./CoreApi/CoreApi')
const pa11y = require('pa11y');
const { PuppeteerCrawler, Dataset } = require('crawlee');
const cliProgress = require('cli-progress');
// const coreApi = new CoreApi()
// const crypto = require('crypto')

// coreApi.login()

const baseUrl = args._[0]

if (undefined === baseUrl) {
    console.log('The argument website to test is mandatory')
    process.exit(-1)
}

const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
progressBar.start(1, 0)

const crawler = new PuppeteerCrawler({
    preNavigationHooks: [
        async (crawlingContext, gotoOptions) => {
            gotoOptions.timeout = 30_000;
            gotoOptions.navigationTimeoutSecs = 10;
        },
    ],
    async requestHandler({ request, page, enqueueLinks, log }) {
        const metaTitle = await page.title();
        const title = await page.$('h1') ? await page.$eval('h1', el => el.textContent) : null
        const locale = await page.$('html') ? await page.$eval('html', el => el.getAttribute('lang')) : null

        const response = page.waitForResponse(request.loadedUrl)
        const audit = await pa11y(request.loadedUrl, {
            browser: page.browser(),
            page: page,
        });

        const headers = (await response).headers();
        if (audit.issues.length > 0) {
            log.info(`${audit.issues.length} errors with page ${request.loadedUrl} : '${metaTitle}'`);
        }

        const url = new URL(request.loadedUrl)
        // const shasum = crypto.createHash('sha1')
        // shasum.update(`AuditHashSeed$${request.loadedUrl}`)
        // const ouuid = shasum.digest('hex')

        // Save results as JSON to ./storage/datasets/default
        await Dataset.pushData({
            title: title,
            meta_title: metaTitle,
            url: request.loadedUrl,
            pa11y: audit.issues,
            host: url.hostname,
            base_url: url.pathname,
            status_code: (await response).status(),
            mimetype: headers['content-type'],
            locale: locale,
            size: headers['content-length'],
        });

        await enqueueLinks({
            transformRequestFunction(req) {
                if (req.url.endsWith('.pdf')) return false;
                if (req.url.endsWith('.doc')) return false;
                if (req.url.endsWith('.docx')) return false;
                if (req.url.endsWith('.xls')) return false;
                if (req.url.endsWith('.xlsx')) return false;
                return req;
            },
        });
        this.requestQueue.getInfo().then((info) => {
            progressBar.update(info.handledRequestCount)
            progressBar.setTotal(info.totalRequestCount)
        })
    },
    async failedRequestHandler({ request }) {
        console.log(request)
    },
    headless: true,
});



(async () => {
    await crawler.run([baseUrl])
    process.exit(0)
})();


