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


    fs.readdir(directoryPath, function (err, files) {
        if (err) {
            return console.log('Unable to scan directory: ' + err)
        }
        const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
        progressBar.start(files.length, 0)
        files.forEach(function (file) {
            const rawdata = fs.readFileSync(path.join(directoryPath, file))
            let document = JSON.parse(rawdata)
            const url = new URL(document.url)
            const shasum = crypto.createHash('sha1')
            shasum.update(`AuditHashSeed$${url.origin}${url.pathname}`)
            const hash = shasum.digest('hex')
            coreApi.mergeDocument('audit', hash, document)
            progressBar.increment()
        });
        progressBar.stop()
    })
})();


