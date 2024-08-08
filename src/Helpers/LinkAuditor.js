'use strict'
const https = require('node:https')
const http = require('node:http')
module.exports = class LinkAuditor {
  #cacheHrefs
  constructor () {
    this.#cacheHrefs = []
  }

  async auditUrls (hrefs) {
    const promises = []
    hrefs.forEach(href => {
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
      case 'http':
        return this.#getHttp(href)
      case 'https':
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
    return new Promise(resolve => {
      try {
        http.get(href, response => {
          resolve(this.#response(href, response))
        })
      } catch (e) {
        resolve(this.#error(href, e))
      }
    })
  }

  #getHttps (href) {
    return new Promise(resolve => {
      try {
        https.get(href, response => {
          resolve(this.#response(href, response))
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
