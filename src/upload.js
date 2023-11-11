const CoreApi = require('./CoreApi/CoreApi')
const path = require('path');
const fs = require('fs');
const cliProgress = require("cli-progress");

const emsAdmin = process.env.WEB_AUDIT_EMS_ADMIN || null;
const emsAuthKey = process.env.WEB_AUDIT_EMS_AUTHKEY || null;
const directoryPath = path.join(__dirname, '..', 'storage', 'datasets', 'default');

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
coreApi.login()

fs.readdir(directoryPath, function (err, files) {
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    }
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(files.length, 0)
    files.forEach(function (file) {
        progressBar.increment();
    });
    progressBar.stop()
});