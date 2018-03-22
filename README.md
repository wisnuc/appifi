This work is licensed under GPL v3.

# Notice

This project is under heavy development.

# For Developers (English)

(TBD)

# For Developers (Chinese)

## 在虚机或x86_64 PC上源码安装此项目

此项目可以在虚拟机或者x86_64 PC上直接从源码安装运行。操作系统为Ubuntu 16.04 LTS版本，目前开发人员使用的是16.04.3，16.04.4未测试过。

安装主机需要具有两块物理硬盘，其中系统盘可以是U盘，但数据盘目前仅支持SATA盘。在虚机里安装的时候应该为虚机配置两块虚拟磁盘。

对于客户端开发者，安装系时系统盘（rootfs）推荐选择ext4文件系统；数据盘可以自己手工格式化成btrfs，也可以用本项目的客户端在初始化时创建btrfs磁盘卷。

对于本项目服务器端代码开发者，系统盘必须使用btrfs文件系统，本项目代码中的测试代码需要运行在btrfs文件系统上。

安装过程如下。

### 1. 安装OS

在虚机或者x86_64 PC上安装Ubuntu 16.04.3 AMD64 server版；在最后选择软件包时应添加openssh server.

### 2. 安装Ubuntu/Debian软件包

用apt-get安装如下软件包：

1. python-minimal, build-essential, 在安装npm包时需要这两个包编译二进制模块
2. btrfs-toosl, btrfs命令行工具
3. avahi-daemon, avahi-utils, mDNS设备发现服务
4. udisks2, U盘热插拔
5. libimage-exiftool-perl, imagemagick, ffmpeg, EXIF/缩略图/视频缩略图工具
6. samba, minidlna, 依赖的外部服务

### 3. 安装和运行

```
$ git clone https://github.com/wisnuc/appifi
$ cd appifi
$ npm install
$ npm run devel-bootstrap
```






