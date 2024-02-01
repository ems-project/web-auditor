'use strict'
const http = require('http')
const PORT = 8686

const path = require('path');
const fs = require('fs');
const mustache = require('mustache');
const yaml = require('js-yaml');

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
        const errorTypes = {}

        if (files.length > 0) {
            let totalIssuesCount = 0,
                pagesWithIssues = 0
            let errorsByPage = ''

            files.forEach((file, index) => {
                const rawData = fs.readFileSync(path.join(directoryPath, file))
                let document = JSON.parse(rawData)

                if (document.status_code === 200 && document.pa11y.length > 0) {
                    totalIssuesCount += document.pa11y.length
                    pagesWithIssues++

                    document.pa11y.forEach(issue => {
                        const code = issue.code;
                        errorTypes[code] ? errorTypes[code]++ : errorTypes[code] = 1
                    })

                    errorsByPage += errorByPageItem(document,index)
                }
            });
            const stats = getStats(totalIssuesCount,pagesWithIssues);
            createSummaryReportHTML(baseUrl,stats,errorTypes,errorsByPage)
        } else {
            console.error(`File not found in ${directoryPath}`)
        }
    } else {
        console.error(`${folderName} folder not found`)
    }
})();

function errorByPageItem(document,index) {
    const collapseLink =  `<a class="me-3 btn btn-sm btn-light border-secondary" data-bs-toggle="collapse" href="#collapse-${index}" role="button" aria-expanded="false" aria-controls="collapse-${index}">Details</a>`;
    const pageLink = `<a href="${document.url}" target="_blank">${document.url}</a>`;
    const errorsByPageCount = `<span class="ms-auto badge bg-danger">${document.pa11y.length}</span>`;

    let detailsContent = '';

    document.pa11y.forEach(issue => {
        const technique = parseErrorCode(issue.code);
        detailsContent += `<div class="card rounded-0 mt-3">
            <div class="card-body py-1"><strong>${technique.label}</strong> - <span class="help-text">${issue.message}</span></div>
            <div class="card-footer"><pre class="bg-light mb-0">${htmlEntities(issue.context)}</pre></div>
        </div>`
    });

    return `
        <li class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">${collapseLink} ${pageLink} ${errorsByPageCount}</div>
            <div class="collapse" id="collapse-${index}">
                <ul class="list-unstyled">
                    <li>${detailsContent}</li>
                </ul>
            </div>
        </li>`;
}
function getStats(totalIssuesCount,pagesWithIssues) {
    if(totalIssuesCount > 0) {
        return `<p><strong>${totalIssuesCount}</strong> error${totalIssuesCount !== 1 ? 's' : ''} found on <strong>${pagesWithIssues}</strong> page${pagesWithIssues !== 1 ? 's' : ''}</p>`
    } else {
        return `<p class="d-flex align-items-center mb-0"><span class="fs-2 me-2 lh-1">🥳</span> Yippee ki‐yay! No accessibility error found.</p>`
    }
}
function parseErrorCode(errorCode) {
    const errorCodeSplit = errorCode.split('.');

    return {
        code: errorCodeSplit[4],
        label: getTranslation('en', 'accessibility.techniques.'+errorCodeSplit[4])
    };
}
function createSummaryReportHTML(baseUrl,stats,errorTypes,errorsByPage) {
    const summaryTemplate = './src/Render/templates/summary.html';
    const summaryTemplateContent = fs.readFileSync(summaryTemplate, 'utf8');

    if (!fs.existsSync('./storage/reports/')) {
        fs.mkdirSync('./storage/reports/', { recursive: true })
    }

    let errorList = '';
    for (const errorCode in errorTypes) {
        const errorCount = errorTypes[errorCode];

        const technique = parseErrorCode(errorCode);

        errorList += `<li class="list-group-item d-flex justify-content-between align-items-center">
            <a class="tex-decoration-none" href="https://www.w3.org/TR/WCAG20-TECHS/${technique.code}" target="_blank">
                ${technique.code}
            </a><i class="bi bi-arrow-bar-right mx-2" aria-hidden="true"></i>${technique.label}
            <span class="ms-auto badge bg-danger">${errorCount}</span>
        </li>`
    }

    const summaryData = {
        url: baseUrl,
        date: 'date',
        color: errorList.length ? 'danger': 'success',
        stats: stats,
        errorTypes: errorList,
        errorsByPage: errorsByPage
    };

    const renderedTemplate = mustache.render(summaryTemplateContent, summaryData);

    const url = new URL(baseUrl);
    const hostname = url.hostname.replace(/[^a-zA-Z0-9]/g, '_')
    const reportPath = `./storage/reports/${hostname}-a11y.html`

    fs.writeFileSync(reportPath, renderedTemplate, 'utf8');
    console.log(`The summary report has been successfully generated: ${reportPath}`);

    readReport(reportPath)
}
function readReport(reportPath) {
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

function htmlEntities(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function loadTranslations(language) {
    try {
        const translationFile = `./src/Render/translations/messages.${language}.yaml`;
        return yaml.load(fs.readFileSync(translationFile, 'utf8'));
    } catch (error) {
        console.error(`Error loading translations for language ${language}:`, error.message);
        return {};
    }
}

function getTranslation(language, key) {
    const translations = loadTranslations(language);
    const keys = key.split('.');
    const translation = keys.reduce((obj, k) => obj[k],translations);
    return translation || key;
}