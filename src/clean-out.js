const CoreApi = require('./CoreApi/CoreApi');
const path = require('path');
const fs = require("fs");
require('dotenv').config();

(async () => {
    const sourcePath = path.join(__dirname, '..', 'storage', 'datasets', 'default', '000000001.json')
    const rawData = fs.readFileSync(sourcePath)
    const document = JSON.parse(rawData)

    const coreApi = new CoreApi()
    if (!await coreApi.login()) {
        console.log(`The script is not able to login to ElasticMS admin`)
        process.exit(-1)
    }

    const query = JSON.stringify({
        "index": [
            "a11y_default"
        ],
        "body": {
            "query": {
                "bool": {
                    "must": [
                        {
                            "terms": {
                                "host": [
                                    document.host
                                ]
                            }
                        },
                        {
                            "terms": {
                                "_contenttype": [
                                    "audit"
                                ]
                            }
                        },
                        {
                            "range": {
                                "timestamp": {
                                    "lt": document.timestamp
                                }
                            }
                        }
                    ]
                }
            }
        },
        "size": 50
    })

    const command = `emsco:revision:delete --mode=by-query --query='${query}'`
    coreApi.runCommand(command)

})()