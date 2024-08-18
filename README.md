# web-auditor

This tools provides 4 scripts:
 * A [script to perform an audit of a web site](#audit)
 * A [script to see locally the outcome of the audit](#create-local-report)
 * A [script to upload the last performed in an elasticms admin](#upload)
 * A [script to clean out old audit results](#cleaning)

The idea behind splitting the audit from the upload is that the audit is very network and cpu consuming.
In those particular circumstances, the audit script might not work at first run. So run the audit until it passed, than launch the upload.

## Prerequisite

Both Pupeteer and Chromium must install and working. Here an example for Ubuntu:  

```shell
sudo apt-get install chromium-browser
sudo apt-get install libx11-xcb1 libxcomposite1 libasound2 libatk1.0-0 libatk-bridge2.0-0 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6
npm install
```
Check Pupeteer documentation for your platform.

## Audit

This script launches the audit. A JSON file per URL audited is saved in the directory `storage/datasets/https__elasticms.fgov.be/`


```shell
node src/audit.js https://elasticms.fgov.be
```

## Create local report

`create.js` generates a summary report for a prior audit and launches a local server for review. The report, which includes the total error count, the number of pages with errors, and the audit date, is saved in `/storage/reports/` and easily shareable (for analysis and corrections). It also provides a list of error types and a breakdown of pages with errors, including specific error information.

Running an audit (using audit.js) on the URL before executing create.js is mandatory.

```shell
node src/create.js  https://elasticms.fgov.be
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
node src/clean-out.js  https://elasticms.fgov.be
```

## All in one

A shell script, at the root, is available to audit, upload and clean a website with a single command:

```shell
./audit.sh  https://elasticms.fgov.be
```

## Script's arguments

 * URL used to start the audit [mandatory]
 * Dataset ID, used to identify the audit's dataset [not mandatory, by default generated with URL argument] 


## Script's options

All options can be passed to all WebAuditor scripts, but they aren't always always an effect on all scripts: 

 * --ca=/path/to/alt/root-ca.crt: used to specify the path to an alternative CA's certificate file
 * --status-code=200: Display all links with a return code above the one provided (only for the create.js script)
 * --max-pages=5000: Limit the summary overview to the first c audited pages (performance issue) (only for the create.js script)

## How to

### How to keep current results

With the environment variable `CRAWLEE_PURGE_ON_START`:

```shell
CRAWLEE_PURGE_ON_START=0 node src/audit.js https://elasticms.fgov.be
```

### Increase the memory available for Puppeteer

By default, Crawlee is set to use only 25% of the available memory. You can update the configuration by setting the environment variable `CRAWLEE_AVAILABLE_MEMORY_RATIO`. I would recommend setting it to 0.8. Especially if you want to scan a large website (>5.000 pages)

```shell
CRAWLEE_AVAILABLE_MEMORY_RATIO=0.8
```