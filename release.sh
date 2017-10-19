#! /bin/bash

echo ":: clean release folder"
rm -rf release
mkdir release

echo ":: change to release folder"
cd release
echo "$(pwd)"

echo ":: cloning appifi repository"
git clone https://github.com/wisnuc/appifi.git

cd appifi
git rev-parse HEAD > .revision

cd -

echo ":: cloning appifi-release repository"
git clone https://github.com/wisnuc/appifi-release.git

rm -rf appifi/.git
mv appifi-release/.git appifi/.git
rm -rf appifi-release
mv appifi appifi-release
cd appifi-release

npm i --production

rm -rf build
mv src build

rm -rf .gitignore
rm -rf .eslintignore
rm -rf .eslintrc.js
rm -rf README.md
rm -rf assets.js
rm -rf backpack.config.js
rm -rf backpack.js
rm -rf docs
rm -rf graph.sh
rm -rf jsdoc.conf.json
rm -rf markdown
rm -rf misc
rm -rf patch
rm -rf prepare.sh
rm -rf release.sh
rm -rf public
rm -rf sandbox
rm -rf serveJsdoc.js
rm -rf static.js
rm -rf test
rm -rf webpack.config.js
rm -rf remote

git add *
git add .[!.]*
git config --global user.email "lewis.ma@winsuntech.cn"
git config --global user.name "lewis ma"
git commit -a -m "scripted commit on original appifi commit: $(cat .revision)"


