const CoreApi = require('./CoreApi/CoreApi')
const path = require('path')
const fs = require('fs')
const cliProgress = require('cli-progress')
const crypto = require('crypto')
const args = require('yargs').argv
require('dotenv').config()

let datasetId = args._[0]
if (undefined === datasetId) {
  datasetId = 'default'
} else {
  datasetId = datasetId.replaceAll('/', '_').replaceAll(':', '')
}

const directoryPath = path.join(__dirname, '..', 'storage', 'datasets', datasetId)
const Process = require('./Helpers/Process');

(async () => {
  const coreApi = new CoreApi()
  if (!await coreApi.login()) {
    console.log('The script is not able to login to ElasticMS admin')
    process.exit(-1)
  }

  const files = fs.readdirSync(directoryPath)
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
  progressBar.start(files.length, 0)
  for (const file of files) {
    const rawData = fs.readFileSync(path.join(directoryPath, file))
    const document = JSON.parse(rawData)
    const url = new URL(document.url)
    const sha1Sum = crypto.createHash('sha1')
    sha1Sum.update(`AuditHashSeed$${url.origin}${url.pathname}`)
    const hash = sha1Sum.digest('hex')
    let counter = 1
    while (true) {
      try {
        await coreApi.mergeDocument('audit', hash, document)
        break
      } catch (e) {
        console.warn(`Impossible to update document ${hash} from file ${file}, retry after ${counter} sec`)
        await Process.sleep(1000 * counter++)
      }
    }
    progressBar.increment()
  }
  progressBar.stop()
})()
