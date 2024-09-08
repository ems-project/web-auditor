'use strict'

const util = require('util')
const exec = util.promisify(require('child_process').exec)

module.exports = class Extractor {
  #tikaPath
  constructor (tikaPath = 'src/Helpers/tika-app-2.9.2.jar') {
    this.#tikaPath = tikaPath
  }

  async extractContent (path) {
    const { stdout, stderr } = await exec(`java -jar ${this.#tikaPath} --html ${path}`)
    if (stderr) {
      console.error(stderr)
    }
    return stdout
  }

  async extractMeta (path) {
    const { stdout, stderr } = await exec(`java -jar ${this.#tikaPath} --json ${path}`)
    if (stderr) {
      console.error(stderr)
    }

    return JSON.parse(stdout)
  }

  async extractLanguage (path) {
    const { stdout, stderr } = await exec(`java -jar ${this.#tikaPath} --language ${path}`)
    if (stderr) {
      console.error(stderr)
    }

    return stdout
  }
}
