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

This script launches the audit. A JSON file per URL audited is saved in the directory `storage/datasets/default`


```shell
node src/audit.js https://elasticms.fgov.be
```

## Upload

This script upload the current JSON files present in the folder `storage/datasets/default` in elasticms.
Ensure first that the audit has been performed completely.

Also define those 2 environment variables:
 * WEB_AUDIT_EMS_ADMIN
 * WEB_AUDIT_EMS_AUTHKEY

```shell
node src/upload.js
```

## Cleaning

This script cleans out audit results that are older that storage/datasets/default/000000001.json

```shell
node src/clean-out.js
```