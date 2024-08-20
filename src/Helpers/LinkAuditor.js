'use strict'
const request = require('requestretry')
module.exports = class LinkAuditor {
  #cacheHrefs
  constructor () {
    this.#cacheHrefs = []
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
    return new Promise(resolve => {
      try {
        request({
          url: href,
          maxAttempts: 5,
          retryDelay: 5000,
          retryStrategy: request.RetryStrategies.HTTPOrNetworkError
        }, function (error, response) {
          if (response) {
            resolve(self.#response(href, response))
          } else {
            resolve(self.#error(href, error))
          }
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
