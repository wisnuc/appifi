
<!-- TOC -->

- [1. Samba](#1-samba)
  - [1.1. 软件包（package）](#11-软件包package)
  - [1.2. 控制](#12-控制)
  - [1.3. 配置](#13-配置)
    - [1.3.1. Linux系统用户帐号](#131-linux系统用户帐号)
    - [1.3.2. Samba用户名](#132-samba用户名)
    - [1.3.3. 密码](#133-密码)
    - [1.3.4. Share创建](#134-share创建)
    - [1.3.5. Share访问控制](#135-share访问控制)
    - [1.3.6. Share名称](#136-share名称)
      - [1.3.6.1. Public Drive](#1361-public-drive)
      - [1.3.6.2. Private Drive](#1362-private-drive)
      - [1.3.6.3. USB Drive](#1363-usb-drive)
    - [1.3.7. 文件信息同步](#137-文件信息同步)
  - [1.4. 配置文件](#14-配置文件)
    - [1.4.1. rsyslog配置](#141-rsyslog配置)
    - [1.4.2. linux系统用户配置](#142-linux系统用户配置)
    - [1.4.3. samba配置文件](#143-samba配置文件)
    - [1.4.4. samba用户名配置](#144-samba用户名配置)
    - [1.4.5. samba密码数据库](#145-samba密码数据库)
- [2. 测试](#2-测试)
  - [2.1. 测试方法](#21-测试方法)
  - [2.2. smbclient](#22-smbclient)
  - [2.3. 测例](#23-测例)
    - [2.3.1. 启动与关闭](#231-启动与关闭)
      - [测例1](#测例1)
      - [测例2](#测例2)
      - [测例3](#测例3)
      - [测例4](#测例4)
    - [2.3.2. fruitmix drive](#232-fruitmix-drive)
      - [2.3.2.1. 测例](#2321-测例)
    - [USB DRIVE](#usb-drive)
- [3. Appendix](#3-appendix)

<!-- /TOC -->
# 1. Samba

Samba是一个兼容Windows文件共享的服务程序，广泛用于各种非Windows平台系统提供Windows文件共享服务。

## 1.1. 软件包（package）

Samba功能由Ubuntu Server的samba软件包提供。本项目未使用特殊编译版本。

## 1.2. 控制

Samba包含smbd, nmbd, winbindd三个服务，其中winbindd与Windows Active Directory有关，在fruitmix系统中未实现。

fruitmix的samba模块仅控制nmbd的服务状态，且不额外持久化状态，即以nmbd的enabled/disabled状态作为fruitmix中samba控制的使能和禁止状态。

## 1.3. 配置

Fruitmix（appifi服务的核心组件）内置samba支持。

Fruitmix会使用内置的用户帐号和密码系统创建samba的服务配置文件。

### 1.3.1. Linux系统用户帐号

samba服务的用户需要具有系统用户帐号。

fruitmix系统中每个用户具有唯一标识ID（UUID）；fruitmix使用该UUID创建一个对应的Linux系统用户名，命名规则如下：

UUID的格式为`xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx`，去除所有的`-`，去掉`M`，加上`x`前缀。

例如：

```
user uuid - 26d1c018-9f7a-45fa-b849-7008e28b5248
linux username - x26d1c0189f7a5fab8497008e28b5248
```
该用户不具有Linux系统登录能力。

> 理论上samba用户可以用该linux user name作为samba用户名登录samba，因不产生安全性问题，故不做限制。

### 1.3.2. Samba用户名

在Phicomm版本中使用用户的手机号码（`user.phoneNumber`）作为Samba用户名。

### 1.3.3. 密码

使用`user.smbPassword`作为用户的Samba密码（密文）。

fruitmix在配置samba服务的时候会自动注入该密文到samba的密码数据库中（使用`pdbedit`）。

### 1.3.4. Share创建

1. 所有public drive均会创建对应的smb share
2. private drive在下述情况下会创建smb share
    1. drive.owner必须为active user
    2. drive.smb === false，或，drive.smb === true且user.smbPassword存在
3. 所有usb drive均创建对应的smb share

### 1.3.5. Share访问控制

1. public drive只使用密码访问模式，仅drive.writelist中列出的active user可以访问
2. private drive可以密码访问或者匿名访问；
    1. 如果drive.smb === false，为匿名访问模式；
    2. 如果drive.smb === true，为密码访问模式，仅drive.owner（必须active）可以访问
3. usb drive只使用匿名访问模式

### 1.3.6. Share名称

#### 1.3.6.1. Public Drive

1. 如果为内置的共享盘（drive.tag === 'built-in'），share名称为“默认共享盘”
2. 如果不是内置的共享盘，share名称为`drive.label`，但不得为“默认共享盘”
3. 如果`drive.label`为空字符串或者“默认共享盘”，采用如下算法确定其名称：

```
const ps = drives.filter(x => 
  x.type === 'public' &&  // 是共享盘
  !x.isDeleted &&         // 未删除
  x.tag !== 'built-in')   // 不是内置共享盘

let name = '共享盘 ' + (ps.indexOf(drive) + 1)
```
> 上述命名假设系统采用append-only的方式维护drive列表。

#### 1.3.6.2. Private Drive

使用`drive.owner`对应的`user.phoneNumber`作为名称，即用户手机号码。

#### 1.3.6.3. USB Drive

使用usb设备的设备名，去掉sd前缀，加上`usb.`前缀合成，例如`usb.a1`, `usb.b3`等。

### 1.3.7. 文件信息同步

用户通过samba访问对磁盘文件系统做出的增加、修改、和删除操作，fruitmix系统不会立刻知道。

fruitmix通过观察samba的审核日志（audit log）的方式获知用户对磁盘文件系统的改动。

1. 在内部，fruitmix在3721端口启动一个udp服务；
2. 所有samba share均配置`vfs_full_audit` vfs module，该module可以审查所有写入操作；
3. 审查结果写入系统的标号为LOCAL7的日志工具（logging facility）；
4. LOCAL7被配置为127.0.0.1:3721端口的udp服务；在Ubuntu上syslog程序是rsyslogd，该配置通过rsyslogd的配置文件实现

用户通过samba访问对文件系统做出改动时，相应的操作动作会被发送给fruitmix，fruitmix会延时检查文件系统，如果发现文件变更，会执行相应动作，例如计算hash值，提取metadata等等。

## 1.4. 配置文件

fruitmix的Samba模块会创建或修改下述文件

### 1.4.1. rsyslog配置

用于配置samba的audit log服务。

```bash
# /etc/rsyslog.d/99-smbaudit.conf

LOCAL7.*    @127.0.0.1:3721
```

### 1.4.2. linux系统用户配置

代码使用shell命令创建和删除Linux用户，不会直接改写该文件。

```bash
# /etc/passwd
```

### 1.4.3. samba配置文件

该文件为samba配置文件，路径名不可变更。

```bash
# /etc/samba/smb.conf
```

### 1.4.4. samba用户名配置

该文件路劲由fruitmix软件自定义

```bash
# /etc/smbusermap
```

### 1.4.5. samba密码数据库

代码使用`pdbedit`命令访问，不直接修改samba密码数据库文件。该命令在Ubuntu的samba软件包中自带，如果是自己编译的samba，缺省配置下也会提供该命令。

```bash
# list all samba users
pdbedit -Lw

# remove user
pdbedit -x ${username}

# import user
pdbedit -i smbpasswd:${smbUserFile}
```

# 2. 测试

## 2.1. 测试方法

1. 使用自动化测试
2. user和drive操作使用api完成
3. 使用smbclient实现assertion

## 2.2. smbclient

TODO

## 2.3. 测例

### 2.3.1. 启动与关闭

1. 检查samba状态
    1. fruitmix启动时smb已经停止
    2. fruitmix启动时smb已经启动
2. 启动和停止操作
    1. smb停止时启动
    2. smb启动时停止

#### 测例1

预置samba为启动状态，启动fruitmix，api获取samba状态为已经启动。

#### 测例2

预置samba为停止状态，启动fruitmix, api获取samba状态为已经停止。

#### 测例3

预置samba为启动状态且smb.conf为无效文件，启动fruitmix，api获取samba状态为已经启动，且smb.conf正确更新。

#### 测例4

预置samba为停止状态且smb.conf为无效文件，启动fruitmix并启动samba，api获取samba状态为已经启动，且smb.conf正确更新。


### 2.3.2. fruitmix drive

以下测试中假定：

1. alice为管理员
2. 创建bob为active的普通用户，设置smb password，smb设置为true（缺省）；
3. 创建charlie为active的普通用户，设置smb password，smb设置为false；
4. 创建david为active的普通用户，不设置smb password，smb设置为true（缺省）；
5. 创建eve为active的普通用户，不设置smb password，smb设置为false；
6. 创建frank和grace为active的普通用户；
7. 创建了共享盘foo包含bob, charlie, david, eve, frank, grace；然后删除
8. 创建了共享盘hello包含bob, david，eve，frank, grace；不包含charlie
9. 创建了共享盘world包含charlie, david, eve, frank, grace；不包含bob
10. patch frank为inactive用户；
11. 删除grace；

#### 2.3.2.1. 测例

完成假设中所需全部操作后验证如下信息：

1. samba中包括alice, bob, charlie, david, eve的私有盘，但没有david（密码未设置），frank（未激活用户）和grace（已删除）的；

2. samba中包括内置共享盘，hello和world，但不包含foo；

3. alice, bob, charlie, eve的私有盘仅owner可访问；

4. david的私有盘任何人可访问；

5. hello仅alice, bob, david, eve可访问，其他人不可访问；

6. world仅alice, charlie, david, eve可访问，其他人不可访问；

### USB DRIVE

可使用fake nfs模拟

TODO



# 3. Appendix


```
[
  "11lp0panr33334328"
]

[
  {
    "uuid": "2f807518-d466-44fa-b83e-607a67e72dbc",
    "username": "admin",
    "isFirstUser": true,
    "isAdmin": true,
    "phicommUserId": "88648501",
    "status": "ACTIVE",
    "createTime": 1531897406978,
    "lastChangeTime": 1531897414625,
    "phoneNumber": "15618429080",
    "password": "$2a$10$ezAaVok9HZVJUfH5PHcYGeuMf938sMl7BrfEFtuECBg4jc41EQgk2",
    "smbPassword": "32ED87BDB5FDC5E9CBA88547376818D4"
  }
]

[
  {
    "uuid": "66d97023-22dd-48a5-899b-a977b46e8f14",
    "type": "private",
    "owner": "2f807518-d466-44fa-b83e-607a67e72dbc",
    "tag": "home",
    "label": "",
    "isDeleted": false,
    "smb": true
  },
  {
    "uuid": "e22f5124-8b17-4156-8eb1-4d79915c8af2",
    "type": "public",
    "writelist": "*",
    "readlist": "*",
    "label": "",
    "tag": "built-in",
    "isDeleted": false,
    "smb": true
  }
]
```


