# web-auditor

This tools provides 4 scripts:
 * A [script to perform an audit of a web site](#audit)
 * A [script to see locally the outcome of the audit](#create-local-report)
 * A [script to upload the last performed in an elasticms admin](#upload)
 * A [script to clean out old audit results](#cleaning)

The idea behind splitting the audit from the upload is that the audit is very network and cpu consuming.
In those particular circumstances, the audit script might not work at first run. So run the audit until it passed, than launch the upload.

## Prerequisite

You may want to use a docker, check the [Docker chapter](#docker)

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

In order to pass them to the `audit.sh` script all options can be provided to all WebAuditor scripts, but they don't always have an effect on all scripts, but the [search script](#search) that works with it's own parameters: 

 * `--ignore-ssl=true`: used to ignore SSL errors (only for the `audit.js`, `clean-out.js` and `upload.js` scripts)
 * `--content=true`: also extract text content if supported in a `content` field (for HTML and using [textract](https://www.npmjs.com/package/textract))
 * `--status-code=200`: Display all links with a return code above the one provided (only for the `create.js` script)
 * `--max-pages=5000`: Limit the summary overview to the first x audited pages (performance issue if the website contains too much A11Y issues and/or too much broken links) (only for the `create.js` script). Try `--max-pages=all` to load all pages.
 * `--wait-until=load`: If defined, the page audit will be initiated only after the provided event is triggered. Check this [blog page](https://cloudlayer.io/blog/puppeteer-waituntil-options/). (only for the `audit.js` script)
 * `--pa11y-limit=100`: Limit the upload of P11Y errors to the first x one. Default value `100`. (only for the `upload.js` script)
 * `--status-code-limit=404`: If defined, limit the upload of links to one with status code bigger or equal to x. (only for the `upload.js` script)
 * `--max-concurrency=10`: Sets the maximum concurrency (parallelism) for the crawl. Default value `50`.
 * `--max-size=52428800`: Sets the maximum size of a response to be audited. Default value `52428800`.

And then you can run :
````shell
./audit.sh --ignore-ssl=true  https://elasticms.fgov.be/
````

## Search

All you to search a RegEx throw all local datasets. The console output is CSV line, one line by hit.

```shell
node src/search.js "BE[0-9]{2}.[0-9]{4}.[0-9]{4}.[0-9]{4}"
```

With this script you can also limit the search within only node dataset with an extra parameter:


```shell
node src/search.js "BE[0-9]{2}.[0-9]{4}.[0-9]{4}.[0-9]{4}" https://www.elasticms.be
```

If needed you can adjust the RegEx flags with the `--flags` options. Default value is `gi`:

```shell
node src/search.js "BE[0-9]{2}.[0-9]{4}.[0-9]{4}.[0-9]{4}" https://www.elasticms.be --flags=i
```

Another example to get all instance of the pattern `bic` with 7 optional characters before and 15 optional characters after.
With the extra condition that the both characters just before and just before aren't an alphanumeric characters.
Th result is saved in a `bic.csv` file.

```shell
node src/search.js ".{0,7}\Wbic\W.{0,15}" > bic.csv
```

## Docker

### Build the image

```shell
docker compose build
```

### Run the web-auditor scripts

Script by script:

```shell
docker compose run --rm web-auditor audit --ignore-ssl=true --content=true https://elasticms.fgov.be/
docker compose run --rm --service-ports web-auditor create https://elasticms.fgov.be/
docker compose run --rm web-auditor upload --pa11y-limit=10 --status-code-limit=404 https://elasticms.fgov.be/
docker compose run --rm web-auditor clean-out https://elasticms.fgov.be/
```

Or all in one (without the `create` script):

```shell
docker compose run --rm web-auditor all --ignore-ssl=true --pa11y-limit=10 --status-code-limit=404 https://elasticms.fgov.be/
```

## How to

### How to keep current results

With the environment variable `CRAWLEE_PURGE_ON_START`:

```shell
CRAWLEE_PURGE_ON_START=0 node src/audit.js https://elasticms.fgov.be
```

### Increase the memory available for Puppeteer

By default, Crawlee is set to use only 25% of the available memory. You can update the configuration by setting the environment variable `CRAWLEE_AVAILABLE_MEMORY_RATIO`. I would recommend setting it to 0.8. Especially if you want to scan a large website (>5.000 pages)

```shell
CRAWLEE_AVAILABLE_MEMORY_RATIO=0.8 node src/audit.js https://elasticms.fgov.be
```

