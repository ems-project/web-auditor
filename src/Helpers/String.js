"use strict";

module.exports.getTimestamp = function getTimestamp() {
    const now = new Date()
    const timezone_offset_min = now.getTimezoneOffset()
    let offset_hrs = parseInt(Math.abs(timezone_offset_min / 60))
    let offset_min = Math.abs(timezone_offset_min % 60)
    let timezone_standard

    if (offset_hrs < 10) {
        offset_hrs = '0' + offset_hrs;
    }
    if (offset_min < 10) {
        offset_min = '0' + offset_min;
    }

    if (timezone_offset_min < 0) {
        timezone_standard = '+' + offset_hrs + ':' + offset_min
    }
    else if (timezone_offset_min > 0) {
        timezone_standard = '-' + offset_hrs + ':' + offset_min
    }
    else {
        timezone_standard = 'Z'
    }

    return now.toISOString().slice(0, 19) + timezone_standard
}