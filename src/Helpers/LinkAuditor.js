'use strict'
const request = require('requestretry')
const tmp = require('tmp')
const fs = require('fs')
const Header = require('./Header')

module.exports = class LinkAuditor {
  #cacheHrefs
  #origin
  constructor (origin) {
    this.#origin = origin
    this.#cacheHrefs = []
    tmp.setGracefulCleanup()
  }

  async auditUrls (hrefs) {
    const setHrefs = new Set(hrefs)
    const promises = []
    setHrefs.forEach(href => {
      promises.push(this.auditUrl(href))
    })
    return Promise.all(promises)
  }

  getFromCache (href) {
    if (this.#cacheHrefs[href]) {
      return this.#cacheHrefs[href]
    }

    return false
  }

  async auditUrl (href) {
    if (this.#cacheHrefs[href]) {
      return this.#cacheHrefs[href]
    }
    const url = new URL(href)
    switch (url.protocol) {
      case 'http:':
      case 'https:':
        return this.#request(href)
    }
    const data = {
      url: href,
      status_code: 302,
      message: 'Protocol not supported'
    }
    this.#cacheHrefs[href] = data
    return data
  }

  #request (href) {
    const self = this
    const tmpObject = tmp.fileSync()
    let resolved = false
    return new Promise(resolve => {
      try {
        const req = request({
          url: href,
          maxAttempts: 5,
          retryDelay: 5000,
          retryStrategy: request.RetryStrategies.HTTPOrNetworkError
        }, function (error, response) {
          if (response) {
            const data = self.#response(href, response)
            if (Header.isHtmlMimetype(data.mimetype) || ((new URL(href)).origin !== self.#origin)) {
              resolved = true
              resolve(data)
              req.destroy()
            }
          } else {
            resolve(self.#error(href, error))
          }
        }).on('data', (data) => {
          if (data.length <= 0) {
            return
          }
          fs.write(tmpObject.fd, data, (err) => {
            if (err) {
              console.error(err)
            }
          })
        }).on('end', () => {
          fs.close(tmpObject.fd, (err) => {
            if (resolved) {
              tmpObject.removeCallback()
              return
            }
            if (err) {
              resolve(self.#error(href, err))
            }
            const data = this.#cacheHrefs[href]
            if (tmpObject) {
              data.tmpObject = tmpObject
            }
            resolve(data)
          })
        })
      } catch (error) {
        resolve(self.#error(href, error))
      }
    })
  }

  #error (href, e) {
    const data = {
      url: href,
      status_code: 500,
      message: e.message
    }
    this.#cacheHrefs[href] = data
    return data
  }

  #response (href, response) {
    const data = {
      url: href,
      status_code: response.statusCode,
      message: response.statusMessage,
      mimetype: response.headers['content-type']
    }
    this.#cacheHrefs[href] = data
    return data
  }
}
