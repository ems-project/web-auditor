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
const ignoreSsl = args['ignore-ssl']

const directoryPath = path.join(__dirname, '..', 'storage', 'datasets', datasetId)
if (ignoreSsl) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0
}
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
    if (document.pa11y && Array.isArray(document.pa11y)) {
      document.pa11y = document.pa11y.filter(error => !error.mobile).map((p, index) => {
        delete p.mobile
        if (index > 10) {
          delete p.message
          delete p.context
          delete p.selector
        }
        return p
      })
    }
    if (document.links && Array.isArray(document.links)) {
      document.links = document.links.filter(link => link.status_code >= 404 && link.status_code < 600)
    }
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
        const pa11yCounter = (document.pa11y ?? []).length
        const linksCounter = (document.pa11y ?? []).length
        console.warn(`Impossible to update document ${hash} from file ${file}, retry after ${counter} sec (${pa11yCounter} pa11y & ${linksCounter})`)
        await Process.sleep(1000 * counter++)
      }
    }
    progressBar.increment()
  }
  progressBar.stop()
})()
