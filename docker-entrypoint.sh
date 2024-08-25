#!/bin/bash

if [ $# == 0 ];then
	echo "No argument passed to docker run command"
	exit 0
fi

# check if it first argument is the all script
if [ "${1}" == "all" ]; then
  echo "start all scripts"
  node src/audit.js "${@:2}"
  node src/upload.js "${@:2}"
  node src/clean-out.js "${@:2}"
else
	echo "starting script ${1}"
  node src/${1}.js "${@:2}"
fi