const args = require('yargs').argv
const CoreApi = require('./CoreApi/CoreApi')
const pa11y = require('pa11y');
const { PuppeteerCrawler, Dataset } = require('crawlee');
const cliProgress = require('cli-progress');
const coreApi = new CoreApi()


coreApi.login()

const baseUrl = args._[0]

if (undefined === baseUrl) {
    console.log('The argument website to test is mandatory')
    process.exit(-1)
}

const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
progressBar.start(1, 0)

const crawler = new PuppeteerCrawler({
    async requestHandler({ request, page, enqueueLinks, log }) {
        const title = await page.title();
        const audit = await pa11y(request.loadedUrl, {
            browser: page.browser(),
            page: page,
        });
        if (audit.issues.length > 0) {
            log.info(`${audit.issues.length} errors with page ${request.loadedUrl} : '${title}'`);
        }

        // Save results as JSON to ./storage/datasets/default
        await Dataset.pushData({ title, url: request.loadedUrl });

        await enqueueLinks();
        this.requestQueue.getInfo().then((info) => {
            progressBar.update(info.handledRequestCount)
            progressBar.setTotal(info.totalRequestCount)
        })
    },
    headless: true,
});



(async () => {
    await crawler.run([baseUrl])
    process.exit(0)
})();


