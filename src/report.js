'use strict'
const http = require('http')
const fs = require('fs')
const PORT = 8686

const args = require('yargs').argv
const baseUrl = args._[0]
const url = new URL(baseUrl)
const hostname = url.hostname.replace(/[^a-zA-Z0-9]/g, '_')
const reportPath = `./storage/reports/${hostname}-accessibility-report.html`

fs.readFile(reportPath, function (err, html) {
  if (err) throw err

  http.createServer(function (request, response) {
    response.writeHeader(200, { 'Content-Type': 'text/html' })
    response.write(html)
    response.end()
  }).listen(PORT)

  console.log(`http://localhost:${PORT}`)
})
