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

echo ":: cloning appifi-tarball repository"
git clone https://github.com/wisnuc/appifi-tarball.git

rm -rf appifi/.git
mv appifi-tarball/.git appifi/.git
rm -rf appifi-tarball
mv appifi appifi-tarball

cd appifi-tarball

npm install
node_modules/.bin/webpack -p
rm .gitignore
rm build/.gitignore

git add *
git add .[!.]*
git config --global user.email "lewis.ma@winsuntech.cn"
git config --global user.name "lewis ma"
git commit -a -m "scripted commit on original appifi commit: $(cat .revision)"


