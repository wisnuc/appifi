#!/bin/bash

#
# Platform: Ran through on Ubuntu 16.04.2 Desktop 64bit
#

set -e

DASH="------------------------------------------------------------"

banner()
{
	echo ""
	echo $DASH
	echo "$1"
	echo $DASH
	echo ""
}

banner "Running firstDeployEnv.sh file"

#
# update apt sourcelist first
#
banner "Update apt"
echo "deb http://ubuntu.uestc.edu.cn/ubuntu/ xenial main restricted universe multiverse" > /etc/apt/sources.list
echo "deb http://ubuntu.uestc.edu.cn/ubuntu/ xenial-backports main restricted universe multiverse" >> /etc/apt/sources.list
echo "deb http://ubuntu.uestc.edu.cn/ubuntu/ xenial-security main restricted universe multiverse" >> /etc/apt/sources.list
echo "deb http://ubuntu.uestc.edu.cn/ubuntu/ xenial-updates main restricted universe multiverse" >> /etc/apt/sources.list

apt-get update

#
# define all pathnames
#

# docker: v17.04.0-ce
#
docker_download_path="https://get.docker.com/builds/Linux/x86_64/docker-17.04.0-ce.tgz"
docker_package_name="docker-17.04.0-ce.tgz"
docker_home_path="docker"

system_run_path="/usr/local"

#
# install avahi packages
#
banner "Install avahi"
apt-get -y install avahi-daemon avahi-utils

#
# create a new empty folder
#
tmpFolder=`cat /proc/sys/kernel/random/uuid`
mkdir ./$tmpFolder
cd ./$tmpFolder

#
# install some essential packages for whole system
#
banner "Install essential packages for whole system"
apt-get -y install build-essential python-minimal openssh-server btrfs-tools imagemagick ffmpeg samba udisks2 curl

###################################################################
#
# install nodejs
#
banner "Install nodejs"
curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash -
apt-get install -y nodejs
###################################################################

###################################################################
#
# install docker
#
wget $docker_download_path
if [ $? != 0 ]
then
   echo "Download docker package failed!"
   exit 120
fi

#
# install some essential packages for docker
#
banner "Install essential packages for docker"
apt-get -y install xz-utils git aufs-tools apt-transport-https ca-certificates

tar zxf $docker_package_name
\cp -rf ./$docker_home_path/* $system_run_path/bin/
###################################################################

#
# Related deployment with appifi bootstrap
#
banner "deploy some services"

# configure network
echo "[Match]"                       > /etc/systemd/network/wired.network
echo "Name=en*"                     >> /etc/systemd/network/wired.network
echo "[Network]"                    >> /etc/systemd/network/wired.network
echo "DHCP=ipv4"                    >> /etc/systemd/network/wired.network

# Set some softwares' initial value
systemctl enable systemd-networkd
systemctl enable systemd-resolved
systemctl enable avahi-daemon

# disable samba
systemctl stop smbd nmbd
systemctl disable smbd nmbd

#
# cleanup
#
apt-get clean && apt-get autoclean

cd ..
rm -rf ./$tmpFolder
