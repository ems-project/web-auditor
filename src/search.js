const path = require('path')
const fs = require('fs')
const args = require('yargs').argv
require('dotenv').config()

let datasetId = args._[0]
if (undefined === datasetId) {
  datasetId = 'default'
} else {
  datasetId = datasetId.replaceAll('/', '_').replaceAll(':', '')
}
const pattern = args._[1]
if (undefined === pattern) {
  console.error('Pattern not provided')
}

const directoryPath = path.join(__dirname, '..', 'storage', 'datasets', datasetId)
const regexp = /BE[0-9]{2}.[0-9]{4}.[0-9]{4}.[0-9]{4}/gi
let counter = 0;

(async () => {
  const files = fs.readdirSync(directoryPath)
  for (const file of files) {
    const rawData = fs.readFileSync(path.join(directoryPath, file))
    const document = JSON.parse(rawData)
    if (!document.content) {
      continue
    }
    const array = [...document.content.matchAll(regexp)]
    for (const key in array) {
      console.log(document.url + ';' + array[key])
      counter = counter + 1
    }
  }
  console.log(('Found ' + counter + ' matches'))
})()
