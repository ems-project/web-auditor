'use strict'
const http = require('http')
const PORT = 8686

const path = require('path');
const fs = require('fs');
const mustache = require('mustache');

const args = require('yargs').argv
const baseUrl = args._[0]

let folderName = baseUrl
if (undefined === folderName) {
    folderName = 'default'
} else {
    folderName = folderName.replaceAll('/', '_').replaceAll(':', '')
}

const directoryPath = path.join(__dirname, '..', 'storage', 'datasets', folderName);

(async () => {
    if (fs.existsSync(directoryPath)) {
        const files = fs.readdirSync(directoryPath)

        if (files.length > 0) {
            let totalIssuesCount = 0,
                pagesWithIssues = 0
            let htmlList = ''

            for (const file of files) {
                const rawData = fs.readFileSync(path.join(directoryPath, file))
                let document = JSON.parse(rawData)

                if (document.status_code === 200 && document.pa11y.length > 0) {
                    totalIssuesCount += document.pa11y.length
                    pagesWithIssues++

                    htmlList += `<li><a href="${document.url}">${document.url}</a> (${document.pa11y.length} error${document.pa11y.length !== 1 ? 's' : ''})</li>`;
                }
            }
            const stats = `${totalIssuesCount} error${totalIssuesCount !== 1 ? 's' : ''} found on ${pagesWithIssues} page${pagesWithIssues !== 1 ? 's' : ''}:`
            createSummaryReportHTML(htmlList, stats, baseUrl)
        } else {
            console.error(`File not found in ${directoryPath}`)
        }
    } else {
        console.error(`${folderName} folder not found`)
    }
})();

function createSummaryReportHTML(htmlList,stats,baseUrl) {
    const summaryTemplate = './src/html/summary.html';
    const summaryTemplateContent = fs.readFileSync(summaryTemplate, 'utf8');

    if (!fs.existsSync('./storage/reports/')) {
        fs.mkdirSync('./storage/reports/', { recursive: true })
    }

    const noErrorMessage = `<span class="fs-2 me-2 lh-1">🥳</span> Yippee ki‐yay! No accessibility error found.`

    const summaryData = {
        url: baseUrl,
        color: htmlList.length ? 'danger': 'success',
        stats: htmlList.length ? stats : noErrorMessage,
        results: htmlList
    };

    const renderedTemplate = mustache.render(summaryTemplateContent, summaryData);

    const url = new URL(baseUrl);
    const hostname = url.hostname.replace(/[^a-zA-Z0-9]/g, '_')
    const reportPath = `./storage/reports/${hostname}-a11y.html`

    fs.writeFileSync(reportPath, renderedTemplate, 'utf8');
    console.log(`The summary report has been successfully generated: ${reportPath}`);

    fs.readFile(reportPath, function (err, html) {
        if (err) throw err

        http.createServer(function (request, response) {
            response.writeHeader(200, { 'Content-Type': 'text/html' })
            response.write(html)
            response.end()
        }).listen(PORT)

        console.log(`View the report locally: http://localhost:${PORT}`)
    })
}