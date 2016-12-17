#! /bin/bash

cd "$(dirname "$0")"

export PATH=/opt/homebrew/bin:$PATH
jekyll serve --baseurl "" --destination _site_local --trace

echo
echo "Done"

