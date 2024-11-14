'use strict'
const request = require('requestretry')
const textract = require('textract')
const Header = require('./Header')
module.exports = class LinkAuditor {
  #cacheHrefs
  #origin
  #content
  constructor (origin, content) {
    this.#origin = origin
    this.#content = content
    this.#cacheHrefs = []
  }

  async auditUrls (hrefs) {
    const setHrefs = new Set(hrefs)
    const promises = []
    let counter = 0
    setHrefs.forEach(href => {
      promises.push(this.auditUrl(href))
      ++counter
      if ((counter % 10) === 0) {
        Promise.all(promises)
      }
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
    href = href.split('#')[0]
    if (this.#cacheHrefs[href]) {
      return this.#cacheHrefs[href]
    }
    if (!URL.canParse(href)) {
      return {
        url: href,
        status_code: 400,
        message: 'Can\'t parse the URL'
      }
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
        const req = request({
          url: href,
          maxAttempts: 5,
          retryDelay: 5000,
          retryStrategy: request.RetryStrategies.HTTPOrNetworkError,
          encoding: null
        }, function (error, response) {
          if (response) {
            const data = self.#response(href, response)
            if (
              !data.mimetype ||
                !self.#content ||
                Header.isHtmlMimetype(data.mimetype) ||
                ((new URL(href)).origin !== self.#origin) ||
                ['application/octet-stream', 'text/javascript', 'text/css', 'application/x-javascript'].includes(data.mimetype)) {
              req.destroy()
              resolve(data)
            } else {
              textract.fromBufferWithMime(data.mimetype, response.body, (error, text) => {
                if (error) {
                  data.warning = `Textract fails: ${error.message}`
                } else {
                  data.content = text
                }
                resolve(data)
              })
            }
          } else {
            req.destroy()
            resolve(self.#error(href, error))
          }
        }).on('error', () => {
          // Request might have been intentionally destroyed
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
      mimetype: response.headers['content-type'] ?? null
    }
    this.#cacheHrefs[href] = data
    return data
  }
}
