'use strict'
const https = require('node:https')
const http = require('node:http')
module.exports = class LinkAuditor {
  #cacheHrefs
  constructor () {
    this.#cacheHrefs = []
  }

  async auditUrls (hrefs) {
    const setHrefs = new Set(hrefs)
    const promises = []
    setHrefs.forEach(href => {
      promises.push(this.#addUrl(href))
    })
    return Promise.all(promises)
  }

  async #addUrl (href) {
    if (this.#cacheHrefs[href]) {
      return this.#cacheHrefs[href]
    }
    const url = new URL(href)
    switch (url.protocol) {
      case 'http:':
        return this.#getHttp(href)
      case 'https:':
        return this.#getHttps(href)
    }
    const data = {
      url: href,
      status_code: 302,
      message: 'Protocol not supported'
    }
    this.#cacheHrefs[href] = data
    return data
  }

  #getHttp (href) {
    const self = this
    return new Promise(resolve => {
      try {
        const req = http.get(href, {
          timeout: 20_000
        }, response => {
          resolve(this.#response(href, response))
          req.destroy()
        })
        req.on('error', function (e) {
          resolve(self.#error(href, e))
          req.destroy()
        })
        req.on('timeout', function () {
          resolve(self.#error(href, 'Timeout'))
          req.destroy()
        })
        req.on('uncaughtException', function (e) {
          resolve(self.#error(href, e))
          req.destroy()
        })
      } catch (e) {
        resolve(this.#error(href, e))
      }
    })
  }

  #getHttps (href) {
    const self = this
    return new Promise(resolve => {
      try {
        const req = https.get(href, {
          timeout: 20_000
        }, response => {
          resolve(this.#response(href, response))
          req.destroy()
        })
        req.on('error', function (e) {
          resolve(self.#error(href, e))
          req.destroy()
        })
        req.on('timeout', function () {
          resolve(self.#error(href, 'Timeout'))
          req.destroy()
        })
        req.on('uncaughtException', function (e) {
          resolve(self.#error(href, e))
          req.destroy()
        })
      } catch (e) {
        resolve(this.#error(href, e))
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
      message: response.statusMessage
    }
    this.#cacheHrefs[href] = data
    return data
  }
}
