'use strict'
const https = require('node:https')
const path = require('path')
const Process = require('../Helpers/Process')

module.exports = class CoreApi {
  async login () {
    const emsAdmin = process.env.WEB_AUDIT_EMS_ADMIN || null
    const emsAuthKey = process.env.WEB_AUDIT_EMS_AUTHKEY || null
    if (emsAdmin === null) {
      console.error('The environment variable WEB_AUDIT_EMS_ADMIN must be defined')
    }
    if (emsAuthKey === null) {
      console.error('The environment variable WEB_AUDIT_EMS_AUTHKEY must be defined')
    }
    if (emsAuthKey === null || emsAdmin === null) {
      process.exit(-1)
    }

    const url = new URL(emsAdmin)
    this.options = {
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'X-Auth-Token': emsAuthKey,
        Accept: 'application/json'
      }
    }

    const options = Object.assign({}, this.options)
    options.path = path.join(this.options.path, 'api', 'test')
    const data = await this._makeRequest(options)
    const body = data.body

    if (body.success !== true) {
      console.warn(`It was not possible to connect to ${emsAdmin}`)
      return false
    }

    return true
  }

  async mergeDocument (type, hash, document) {
    const options = Object.assign({}, this.options)
    options.path = path.join(this.options.path, 'api', 'data', type, 'index', hash)
    await this._makeRequest(options, 'POST', document)
  }

  async runCommand (command) {
    const job = {
      class: 'EMS\\CoreBundle\\Entity\\Job',
      arguments: {},
      properties: {
        command
      }
    }
    const options = Object.assign({}, this.options)
    options.path = path.join(this.options.path, 'api', 'admin', 'job')
    const jobId = (await this._makeRequest(options, 'POST', job)).body.id

    options.path = path.join(this.options.path, 'api', 'admin', 'start-job', jobId)
    this._makeRequest(options, 'POST')

    while (true) {
      options.path = path.join(this.options.path, 'api', 'admin', 'job-status', jobId)
      const status = (await this._makeRequest(options)).body

      if (status.done) {
        console.log(status.output)
        break
      }
      await Process.sleep(10000)
    }
  }

  async _makeRequest (urlOptions, method = 'GET', data = null) {
    urlOptions.method = method
    return new Promise((resolve, reject) => {
      const req = https.request(urlOptions,
        (res) => {
          let body = ''
          res.on('data', (chunk) => (body += chunk.toString()))
          res.on('error', reject)
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode <= 299) {
              resolve({ statusCode: res.statusCode, headers: res.headers, body: JSON.parse(body) })
            } else {
              reject(new Error('Request failed. Status: ' + res.statusCode + ': ' + body))
            }
          })
        })
      req.on('error', reject)
      if (data) {
        req.write(JSON.stringify(data))
      }
      req.end()
    })
  }
}
