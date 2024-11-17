const path = require('path')
const fs = require('fs')
const args = require('yargs').argv
require('dotenv').config()

let datasetId = args._[1]
let directoryPath = null
if (undefined === datasetId) {
  directoryPath = path.join(__dirname, '..', 'storage', 'datasets')
} else {
  datasetId = datasetId.replaceAll('/', '_').replaceAll(':', '')
  directoryPath = path.join(__dirname, '..', 'storage', 'datasets', datasetId)
}
const pattern = args._[0]
if (undefined === pattern) {
  console.error('Pattern not provided')
  process.exit(-1)
}
const flags = args.flags ?? 'gi'
const regexp = new RegExp(pattern, flags)
let counter = 0;
(async () => {
  const files = fs.readdirSync(directoryPath, {
    recursive: true
  })
  for (const file of files) {
    if (fs.lstatSync(path.join(directoryPath, file)).isDirectory()) {
      continue
    }
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
