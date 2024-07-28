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
      const brokenLinks = []

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
        if (document.status_code >= 404) {
          brokenLinks.push({
            url: document.url,
            status_code: document.status_code
          })
        }

        if (index === 0) {
          startTime = document.timestamp
        }
        if (index === files.length - 1) {
          endTime = document.timestamp
        }
      })

      const duration = getDuration(startTime, endTime)
      const stats = getStats(totalIssuesCount, pagesWithIssues, files.length, duration, endTime, brokenLinks.length)

      createSummaryReportHTML(baseUrl, stats, errorTypes, errorsByPage, brokenLinks)
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
  return translation || ''
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
function getStats (totalIssuesCount, pagesWithIssues, totalPages, duration, endTime, brokenLinksCount) {
  let statsErrors
  if (totalIssuesCount > 0) {
    statsErrors = `<span><strong>${totalIssuesCount}</strong> error${totalIssuesCount !== 1 ? 's' : ''} found on <strong>${pagesWithIssues}</strong> page${pagesWithIssues !== 1 ? 's' : ''}</span>`
  } else {
    statsErrors = '<span class="d-flex align-items-center"><span class="fs-2 me-2 lh-1">🥳</span> Yippee ki‐yay! No accessibility error found.</span>'
  }
  if (brokenLinksCount > 0) {
    statsErrors += `<span class="text-muted ms-3">💀 <strong>${brokenLinksCount}</strong> broken link${brokenLinksCount !== 1 ? 's' : ''}</span>`
  }

  const auditStats = `<span class="text-muted mx-3" title="Audit duration"><i class="bi bi-stopwatch" aria-hidden="true"></i> <strong>${duration}</strong></span>
        <strong>${totalPages}</strong> audited pages on <strong>${getDate(endTime)}</strong>`

  return `${statsErrors} <p class="ms-md-auto mb-0">${auditStats}</p>`
}
function parseErrorCode (errorCode) {
  const errorCodeSplit = errorCode.split('.')
  const techniqueCode = errorCodeSplit[4]
  const techniqueCodeDetail = errorCodeSplit[5]
  let techniqueLabel
  let techniqueLabelDetail

  const getTechniqueText = (code) => {
    return getTranslation('en', 'accessibility.techniques.' + code)
  }

  const makeTechniqueLink = (code) => {
    return `<a class="text-decoration-none" href="https://www.w3.org/TR/WCAG20-TECHS/${code}" target="_blank">${code}</a>`
  }

  if (techniqueCode.includes(',')) {
    const multipleErrors = techniqueCode.split(',')
    techniqueLabel = '<ul class="list-unstyled">'
    multipleErrors.forEach((code, index) => {
      if (!/^a/i.test(code)) {
        techniqueLabel += `<li>${makeTechniqueLink(code)} <i class="bi bi-arrow-bar-right mx-2" aria-hidden="true"></i> ${getTechniqueText(code)}</li>`
      }
    })
    techniqueLabelDetail = htmlEntities(getTranslation('en', 'accessibility.techniques_help.' + techniqueCodeDetail))
    if (techniqueLabelDetail) {
      techniqueLabel += `<li class="text-muted"><i class="bi bi-backspace-reverse" aria-hidden="true"></i> ${techniqueLabelDetail}</li>`
    }
    techniqueLabel += '</ul>'
  } else {
    techniqueLabel = `${makeTechniqueLink(techniqueCode)} <i class="bi bi-arrow-bar-right mx-2" aria-hidden="true"></i> ${getTechniqueText(techniqueCode)}`
    techniqueLabelDetail = htmlEntities(getTranslation('en', 'accessibility.techniques_help.' + techniqueCodeDetail))
    if (techniqueLabelDetail) {
      techniqueLabel += `<span class="ms-3 text-muted"><i class="bi bi-backspace-reverse" aria-hidden="true"></i> ${techniqueLabelDetail}</span>`
    }
  }

  return {
    code: techniqueCode,
    label: techniqueLabel
  }
}
function createSummaryReportHTML (baseUrl, stats, errorTypes, errorsByPage, brokenLinks) {
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
            ${technique.label}
            <span class="ms-auto badge bg-danger">${errorCount}</span>
        </li>`
  }

  let brokenList = ''
  brokenLinks.forEach(link => {
    brokenList += `<li class="list-group-item">${link.status_code}: <a href="${link.url}" target="_blank">${link.url}</a></li>`
  })

  const summaryData = {
    url: baseUrl,
    color: errorList.length ? 'danger' : 'success',
    stats,
    errorTypes: errorList,
    errorsByPage,
    brokenList
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
  const pageLink = `<a class="text-break me-3" href="${document.url}" target="_blank">${document.url}</a>`
  const btnErrors = `<a class="ms-auto btn btn-danger badge border-secondary" data-bs-toggle="collapse" href="#collapse-${index}" role="button" aria-expanded="false" aria-controls="collapse-${index}">${document.pa11y.length}</a>`

  let detailsContent = ''

  document.pa11y.forEach(issue => {
    const technique = parseErrorCode(issue.code)
    detailsContent += `<div class="card rounded-2 mt-3 border-secondary">
            <div class="card-header py-1 bg-white">${issue.message}</div>
            <div class="card-body py-2 bg-light"><code class="text-body mb-0">${htmlEntities(issue.context)}</code></div>
            <small class="card-footer py-1 bg-white d-flex">${technique.label}</small>
        </div>`
  })

  return `
        <li class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">${pageLink} ${btnErrors}</div>
            <div class="collapse" id="collapse-${index}">
                <ul class="list-unstyled mb-4">
                    <li>${detailsContent}</li>
                </ul>
            </div>
        </li>`
}
