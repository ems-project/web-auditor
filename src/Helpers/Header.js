'use strict'

module.exports.isHtmlMimetype = function isHtmlMimetype (mimetype) {
  if (!mimetype) {
    return false
  }
  return mimetype.startsWith('text/html') || mimetype.startsWith('application/xhtml')
}
