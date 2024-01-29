const args = require('yargs').argv
const pa11y = require('pa11y');
const { PuppeteerCrawler, Dataset } = require('crawlee');
const cliProgress = require('cli-progress');
const crypto = require('crypto')
const String = require("./Helpers/String");

const baseUrl = args._[0]
let datasetId = args._[1]
const hashes = []

const pagesWithIssues = []
let totalIssuesCount = 0

if (undefined === baseUrl) {
    console.log('The argument website to test is mandatory')
    process.exit(-1)
}
if (undefined === datasetId) {
    datasetId = baseUrl.replaceAll('/', '_').replaceAll(':', '')
}

const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
progressBar.start(1, 0)

const crawler = new PuppeteerCrawler({
    preNavigationHooks: [
        async (crawlingContext, gotoOptions) => {
            gotoOptions.timeout = 20_000;
            gotoOptions.navigationTimeoutSecs = 10;
        },
    ],
    async requestHandler({ request, page, enqueueLinks, log }) {
        try {
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
            let status = (await response).status()
            if (304 === status) {
                status = 200
            }
            const dataset = await Dataset.open(datasetId);
            await dataset.pushData({
                title: title,
                meta_title: metaTitle,
                url: request.loadedUrl,
                pa11y: audit.issues.slice(0, 10),
                host: url.hostname,
                base_url: url.pathname,
                status_code: status,
                mimetype: headers['content-type'],
                locale: locale,
                size: headers['content-length'],
                timestamp: String.getTimestamp(),
            });
            if (status === 200 && audit.issues.length > 0) {
                totalIssuesCount += audit.issues.length
                pagesWithIssues.push({
                    url: request.loadedUrl,
                    issueCount: audit.issues.length
                });
            }
            await enqueueLinks({
                transformRequestFunction(req) {
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
                },
            });
            this.requestQueue.getInfo().then((info) => {
                progressBar.update(info.handledRequestCount)
                progressBar.setTotal(info.totalRequestCount)
            })
        } catch (err) {
            console.log(err)
        }
    },
    async failedRequestHandler({ request }) {
        console.log(request)
    },
    headless: true,
    maxConcurrency: 100,
});

(async () => {
    await crawler.run([baseUrl])

    if(crawler.stats.state.requestsFinished > 1) {
        logSummaryReport(totalIssuesCount)
        createSummaryReportHTML(totalIssuesCount,baseUrl)
    }

    progressBar.stop()
})();

function logSummaryReport(totalIssuesCount) {
    console.log("\n------------------------------------------------------------")
    if (totalIssuesCount > 0) {
        console.log(`${totalIssuesCount} error${totalIssuesCount !== 1 ? 's' : ''} found on ${pagesWithIssues.length} page${pagesWithIssues.length !== 1 ? 's' : ''}:`)
        pagesWithIssues.forEach((item) => {
            console.log(`- ${item.url} (${item.issueCount} error${item.issueCount !== 1 ? 's' : ''})`)
        });
    } else {
        console.log("Yippee ki‐yay! No accessibility error found.")
    }
    console.log("------------------------------------------------------------\n")
}
function createSummaryReportHTML(totalIssuesCount,baseUrl) {
    const fs = require('fs')

    if (!fs.existsSync('./storage/reports/')) {
        fs.mkdirSync('./storage/reports/', { recursive: true })
    }
    const url = new URL(baseUrl);
    const hostname = url.hostname.replace(/[^a-zA-Z0-9]/g, '_')
    const reportPath = `./storage/reports/${hostname}-accessibility-report.html`

    const boxClasses = 'p-3 rounded-3 shadow border border-2 '
    let htmlList = ''
    pagesWithIssues.forEach(item => {
        htmlList += `<li><a href="${item.url}">${item.url}</a> (${item.issueCount} error${item.issueCount !== 1 ? 's' : ''})</li>`;
    });
    const htmlContent = `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Accessibility Report</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN" crossorigin="anonymous">
            </head>
            <body>
                <div class="container-lg">
                    <div class="d-flex align-items-center justify-content-between mb-3">
                        <h1 class="my-3">Accessibility Report</h1>
                        ${baseUrl}
                    </div>
                    ${totalIssuesCount > 0 ?
                        `<div class="${boxClasses} border-danger">
                            <p>${totalIssuesCount} error${totalIssuesCount !== 1 ? 's' : ''} found on ${pagesWithIssues.length} page${pagesWithIssues.length !== 1 ? 's' : ''}:</p>
                            <ul class="mb-0">
                                ${htmlList}
                            </ul>
                        </div>` :
                        `<div class="${boxClasses} border-success">
                            <p class="d-flex align-items-center mb-0">
                                <span class="fs-2 me-2 lh-1">🥳</span> Yippee ki‐yay! No accessibility error found.
                            </p>
                        </div>`
                    }
                </div>
            </body>
        </html>
    `;
    fs.writeFileSync(reportPath, htmlContent)
    console.log(`HTML report here: ${reportPath}`)
}