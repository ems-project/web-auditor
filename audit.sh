#!/bin/bash
node src/audit.js $1
node src/upload.js $1
node src/clean-out.js $1
