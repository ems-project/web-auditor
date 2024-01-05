#!/bin/bash
node src/audit.js $1
node src/upload.js
node src/clean-out.js
