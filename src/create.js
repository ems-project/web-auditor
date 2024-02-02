'use strict'
const http = require('http')
const PORT = 8686

const path = require('path')
const fs = require('fs')
const mustache = require('mustache')
const yaml = require('js-yaml')
const moment = require('moment')

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
      let totalIssuesCount = 0
      let pagesWithIssues = 0
      let errorsByPage = ''
      let startTime
      let endTime

      files.forEach((file, index) => {
        const rawData = fs.readFileSync(path.join(directoryPath, file))
        const document = JSON.parse(rawData)

        if (document.status_code === 200 && document.pa11y.length > 0) {
          totalIssuesCount += document.pa11y.length
          pagesWithIssues++

          document.pa11y.forEach(issue => {
            const code = issue.code
            errorTypes[code] ? errorTypes[code]++ : errorTypes[code] = 1
          })

          errorsByPage += errorByPageItem(document, index)
        }

        if (index === 0) {
          startTime = document.timestamp
        }
        if (index === files.length - 1) {
          endTime = document.timestamp
        }
      })

      const duration = getDuration(startTime, endTime)
      const stats = getStats(totalIssuesCount, pagesWithIssues, files.length, duration, endTime)

      createSummaryReportHTML(baseUrl, stats, errorTypes, errorsByPage)
    } else {
      console.error(`File not found in ${directoryPath}`)
    }
  } else {
    console.error(`${folderName} folder not found`)
  }
})()
// Utility functions
function htmlEntities (str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
function loadTranslations (language) {
  try {
    const translationFile = `./src/Render/translations/messages.${language}.yaml`
    return yaml.load(fs.readFileSync(translationFile, 'utf8'))
  } catch (error) {
    console.error(`Error loading translations for language ${language}:`, error.message)
    return {}
  }
}
function getTranslation (language, key) {
  const translations = loadTranslations(language)
  const keys = key.split('.')
  const translation = keys.reduce((obj, k) => obj[k], translations)
  return translation
}
function getDate (timestamp) {
  const dateObj = moment(timestamp)
  // const dateFormat = dateObj.format("DD/MM/YYYY HH:mm");
  const dateFormat = dateObj.format('DD/MM/YYYY')
  return dateFormat
}
function getDuration (startTime, endTime) {
  const start = moment(startTime)
  const end = moment(endTime)

  const differenceInMilliseconds = end.diff(start)

  const duration = moment.duration(differenceInMilliseconds)

  // Formatting the duration
  const hours = Math.floor(duration.asHours())
  const minutes = Math.floor(duration.minutes())
  const seconds = Math.floor(duration.seconds())

  switch (true) {
    case hours > 0:
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
    case minutes > 0:
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
    default:
      return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`
  }
}

// Audit-specific functions
function getStats (totalIssuesCount, pagesWithIssues, totalPages, duration, endTime) {
  let statsErrors
  if (totalIssuesCount > 0) {
    statsErrors = `<strong>${totalIssuesCount}</strong> error${totalIssuesCount !== 1 ? 's' : ''} found on <strong>${pagesWithIssues}</strong> page${pagesWithIssues !== 1 ? 's' : ''}`
  } else {
    statsErrors = '<span class="d-flex align-items-center"><span class="fs-2 me-2 lh-1">🥳</span> Yippee ki‐yay! No accessibility error found.</span>'
  }

  const auditStats = `<span class="text-muted me-3" title="Audit duration"><i class="bi bi-stopwatch" aria-hidden="true"></i> <strong>${duration}</strong></span>
        <strong>${totalPages}</strong> audited pages on <strong>${getDate(endTime)}</strong>`

  return `<p class="mb-md-0">${statsErrors}</p>
  <p class="ms-md-auto mb-0">${auditStats}</p>`
}
function parseErrorCode (errorCode) {
  const errorCodeSplit = errorCode.split('.')

  const techniqueLabel = getTranslation('en', 'accessibility.techniques.' + errorCodeSplit[4])
  const techniqueLabelDetails = getTranslation('en', 'accessibility.techniques.' + errorCodeSplit[4]+'_'+errorCodeSplit[5])

  return {
    code: errorCodeSplit[4],
    label: techniqueLabel + (techniqueLabelDetails ? '<span class="ms-2 text-muted">('+techniqueLabelDetails+')</span>' : '')
  }
}
function createSummaryReportHTML (baseUrl, stats, errorTypes, errorsByPage, duration) {
  const summaryTemplate = './src/Render/templates/summary.html'
  const summaryTemplateContent = fs.readFileSync(summaryTemplate, 'utf8')

  if (!fs.existsSync('./storage/reports/')) {
    fs.mkdirSync('./storage/reports/', { recursive: true })
  }

  let errorList = ''
  for (const errorCode in errorTypes) {
    const errorCount = errorTypes[errorCode]

    const technique = parseErrorCode(errorCode)

    errorList += `<li class="list-group-item d-flex justify-content-between align-items-center">
            <a class="tex-decoration-none" href="https://www.w3.org/TR/WCAG20-TECHS/${technique.code}" target="_blank">
                ${technique.code}
            </a><i class="bi bi-arrow-bar-right mx-2" aria-hidden="true"></i>${technique.label}
            <span class="ms-auto badge bg-danger">${errorCount}</span>
        </li>`
  }

  const summaryData = {
    url: baseUrl,
    color: errorList.length ? 'danger' : 'success',
    stats,
    duration,
    errorTypes: errorList,
    errorsByPage
  }

  const renderedTemplate = mustache.render(summaryTemplateContent, summaryData)

  const url = new URL(baseUrl)
  const hostname = url.hostname.replace(/[^a-zA-Z0-9]/g, '_')
  const reportPath = `./storage/reports/${hostname}-a11y.html`

  fs.writeFileSync(reportPath, renderedTemplate, 'utf8')
  console.log(`The summary report has been successfully generated: ${reportPath}`)

  readReport(reportPath)
}
function readReport (reportPath) {
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
function errorByPageItem (document, index) {
  const collapseLink = `<a class="me-3 btn btn-sm btn-light border-secondary" data-bs-toggle="collapse" href="#collapse-${index}" role="button" aria-expanded="false" aria-controls="collapse-${index}">Details</a>`
  const pageLink = `<a class="text-break me-3" href="${document.url}" target="_blank">${document.url}</a>`
  const errorsByPageCount = `<span class="ms-auto badge bg-danger">${document.pa11y.length}</span>`

  let detailsContent = ''

  document.pa11y.forEach(issue => {
    const technique = parseErrorCode(issue.code)
    detailsContent += `<div class="card rounded-0 mt-3">
            <div class="card-body py-1"><strong>${technique.label}</strong><br><span class="help-text">${issue.message}</span></div>
            <div class="card-footer"><pre class="bg-light mb-0">${htmlEntities(issue.context)}</pre></div>
        </div>`
  })

  return `
        <li class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">${collapseLink} ${pageLink} ${errorsByPageCount}</div>
            <div class="collapse" id="collapse-${index}">
                <ul class="list-unstyled mb-4">
                    <li>${detailsContent}</li>
                </ul>
            </div>
        </li>`
}
