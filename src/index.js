const args = require('yargs').argv
const CoreApi = require('./CoreApi/CoreApi')
const puppeteer = require('puppeteer')
// const codeSniffer = require('html_codesniffer')
// const fs = require('fs');
const path = require('path');
const pa11y = require('pa11y');


const coreApi = new CoreApi()
coreApi.login()

const baseUrl = args._[0]


if (undefined === baseUrl) {
    console.log('The argument website to test is mandatory')
    process.exit(-1)
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    page
        .on('console', message =>
            console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`))
        .on('pageerror', ({ message }) => console.log(message))
        .on('response', response =>
            console.log(`${response.status()} ${response.url()}`))
        .on('requestfailed', request =>
            console.log(`${request.failure().errorText} ${request.url()}`))

    const result2 = await pa11y(baseUrl, {
        browser: browser,
        page: page,
    });

    const hrefs = await page.$$eval('a', as => as.map(a => a.href));
    console.log(hrefs);

    // await sleep(5000);

    await page.screenshot({path: 'index.png'})


    console.log(result2);
    console.log('Closing');



    await browser.close();
})();



