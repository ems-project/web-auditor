# web-auditor

This tools provides 3 scripts:
 * A script to perform an audit of a web site
 * A script to upload the last performed in an elasticms admin
 * A script to clean out old audit results

The idea behind splitting the audit from the upload is that the audit is very network and cpu consuming.
In those particular circumstances, the audit script might not work at first run. So run the audit until it passed, than launch the upload.

## Prerequisite

Both Pupeteer and Chromium must install and working. Here an example for Ubuntu:  

```shell
sudo apt-get install chromium-browser
sudo apt-get install libx11-xcb1 libxcomposite1 libasound2 libatk1.0-0 libatk-bridge2.0-0 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6
npm install
```
Check Pupeteer document for your platform.

## Audit

This script launches the audit. A JSON file per URL audited is saved in the directory `storage/datasets/https__elasticms.fgov.be/`


```shell
node src/audit.js https://elasticms.fgov.be
```

## Create local report

`create.js` generates a summary report for a prior audit and launches a local server for review. The report, which includes the total error count, the number of pages with errors, and the audit date, is saved in `/storage/reports/` and easily shareable (for analysis and corrections). It also provides a list of error types and a breakdown of pages with errors, including specific error information.

Running an audit (using audit.js) on the URL before executing create.js is mandatory.

```shell
node src/create.js  https://elasticms.fgov.be/
```

## Upload

This script upload the current JSON files present in the folder `storage/datasets/https__elasticms.fgov.be/` in elasticms.
Ensure first that the audit has been performed completely.

The audit base url is mandatory in order to identify the right dataset to upload.

Also define those 2 environment variables (or in a `.env` file):
 * WEB_AUDIT_EMS_ADMIN
 * WEB_AUDIT_EMS_AUTHKEY

```shell
node src/upload.js  https://elasticms.fgov.be/
```

## Cleaning

This script cleans out audit results that are older that `storage/datasets/https__elasticms.fgov.be//000000001.json`. 

Caution: this script does not currently give live feedback. Check the elasticms job's logs for live status.

The audit base url is mandatory in order to identify the right dataset to upload.

```shell
node src/clean-out.js  https://elasticms.fgov.be/
```

## All in one

A shell script, at the root, is available to audit, upload and clean a website with a single command:

```shell
./audit.sh  https://elasticms.fgov.be/
```