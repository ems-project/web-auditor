const args = require('yargs').argv
const CoreApi = require('./CoreApi/CoreApi')
const puppeteer = require('puppeteer')
// const codeSniffer = require('html_codesniffer')
// const fs = require('fs');
const path = require('path');


const coreApi = new CoreApi()
coreApi.login()

const baseUrl = args._[0]


if (undefined === baseUrl) {
    console.log('The argument website to test is mandatory')
    process.exit(-1)
}

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page
        .on('console', message =>
            console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`))
        .on('pageerror', ({ message }) => console.log(message))
        .on('response', response =>
            console.log(`${response.status()} ${response.url()}`))
        .on('requestfailed', request =>
            console.log(`${request.failure().errorText} ${request.url()}`))
    await page.goto(baseUrl);
    const filepath = path.join(__dirname, '..', 'build', 'a11y.js')
    await page.addScriptTag({
        path: filepath
    });


    // await page.screenshot({path: 'index.png'})


    await browser.close();
})();



