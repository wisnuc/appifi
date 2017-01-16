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

npm install

node_modules/.bin/webpack -p

mkdir -p build
npm run build

rm .gitignore
rm build/.gitignore

rm -rf docpress
rm -rf docs
rm -rf graph.sh
rm -rf prepare.sh
rm -rf markdown
rm -rf misc

rm -rf test
rm -rf src
rm -rf web

npm prune --production

git add *
git add .[!.]*
git config --global user.email "lewis.ma@winsuntech.cn"
git config --global user.name "lewis ma"
git commit -a -m "scripted commit on original appifi commit: $(cat .revision)"


