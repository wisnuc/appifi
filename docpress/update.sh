#!/bin/bash

rm -rf _docpress
docpress build

rm -rf ../docs
mkdir -p ../docs

cp -r _docpress/* ../docs
cp style.css ../docs/assets


