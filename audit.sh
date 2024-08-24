#!/bin/bash
node src/audit.js "$@"
node src/upload.js "$@"
node src/clean-out.js "$@"
