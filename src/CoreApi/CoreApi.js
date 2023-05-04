'use strict';

module.exports =  class CoreApi {
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }

    login() {
        console.log('Login function');
    }
}