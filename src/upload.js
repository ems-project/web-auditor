const CoreApi = require('./CoreApi/CoreApi')
const path = require('path');
const fs = require('fs');
const cliProgress = require("cli-progress");
const crypto = require("crypto");

const emsAdmin = process.env.WEB_AUDIT_EMS_ADMIN || null;
const emsAuthKey = process.env.WEB_AUDIT_EMS_AUTHKEY || null;
const directoryPath = path.join(__dirname, '..', 'storage', 'datasets', 'default');

(async () => {
    if (null === emsAdmin) {
        console.log('The environment variable WEB_AUDIT_EMS_ADMIN must be defined')
    }
    if (null === emsAuthKey) {
        console.log('The environment variable WEB_AUDIT_EMS_AUTHKEY must be defined')
    }
    if (null === emsAuthKey || null === emsAdmin) {
        process.exit(-1)
    }

    const coreApi = new CoreApi(emsAdmin, emsAuthKey)
    if (!await coreApi.login()) {
        console.log(`The script is not able to login ElasticMS admin ${emsAdmin}`)
        process.exit(-1)
    }


    const files = fs.readdirSync(directoryPath)
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
    progressBar.start(files.length, 0)
    for (const file of files) {
        const rawData = fs.readFileSync(path.join(directoryPath, file))
        let document = JSON.parse(rawData)
        const url = new URL(document.url)
        const sha1Sum = crypto.createHash('sha1')
        sha1Sum.update(`AuditHashSeed$${url.origin}${url.pathname}`)
        const hash = sha1Sum.digest('hex')
        try {
            await coreApi.mergeDocument('audit', hash, document)
        } catch (e) {
            console.log(e)
            console.warn(`Impossible to update document ${hash} from file ${file}`)
        }
        progressBar.increment()
    }
    progressBar.stop()
})();


