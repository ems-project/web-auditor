"use strict";

module.exports.getTimestamp = function getTimestamp () {
    const now = new Date()
    const timezoneOffset = now.getTimezoneOffset()
    let offsetHours = parseInt(Math.abs(timezoneOffset / 60))
    let offsetMin = Math.abs(timezoneOffset % 60)
    let timezoneStandard

    if (offsetHours < 10) {
        offsetHours = '0' + offsetHours
    }
    if (offsetMin < 10) {
        offsetMin = '0' + offsetMin
    }

    if (timezoneOffset < 0) {
        timezoneStandard = '+' + offsetHours + ':' + offsetMin
    }
    else if (timezoneOffset > 0) {
        timezoneStandard = '-' + offsetHours + ':' + offsetMin
    }
    else {
        timezoneStandard = 'Z'
    }

  return now.toISOString().slice(0, 19) + timezoneStandard
}