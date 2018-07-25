
<!-- TOC -->

- [1. Samba](#1-samba)
  - [1.1. 软件包（package）](#11-软件包package)
  - [1.2. 配置](#12-配置)
    - [1.2.1. Linux系统用户帐号](#121-linux系统用户帐号)
    - [1.2.2. Samba用户名](#122-samba用户名)
    - [1.2.3. 密码](#123-密码)
    - [1.2.4. share名称](#124-share名称)
    - [1.2.5. samba服务控制](#125-samba服务控制)
    - [1.2.6. 文件信息同步](#126-文件信息同步)
  - [1.3. 配置文件说明](#13-配置文件说明)
    - [1.3.1. rsyslog配置](#131-rsyslog配置)
    - [1.3.2. linux系统用户配置](#132-linux系统用户配置)
    - [1.3.3. samba配置文件](#133-samba配置文件)
    - [1.3.4. samba用户名配置](#134-samba用户名配置)
    - [1.3.5. samba密码数据库](#135-samba密码数据库)

<!-- /TOC -->
# 1. Samba

Samba是一个兼容Windows文件共享的服务程序，广泛用于各种非Windows平台系统提供Windows文件共享服务。

## 1.1. 软件包（package）

Samba功能由Ubuntu Server的samba软件包提供。本项目未使用特殊编译版本。

如果使用wisnuc定制的Ubuntu Server安装光盘安装Ubuntu系统，或者使用wisnuc ws215i设备的官方系统镜像，则samba服务已经安装。

## 1.2. 配置

Fruitmix（appifi服务的核心组件）内置samba支持。

Fruitmix会使用内置的用户帐号和密码系统创建samba的服务配置文件。

### 1.2.1. Linux系统用户帐号

samba服务的用户需要具有系统用户帐号。

fruitmix系统中每个用户具有唯一标识ID（UUID）；fruitmix使用该UUID创建一个对应的Linux系统用户名，命名规则如下：

UUID的格式为`xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx`，去除所有的`-`，去掉`M`，加上`x`前缀。

该用户不具有Linux系统登录能力。

例如：

```
user uuid - 26d1c018-9f7a-45fa-b849-7008e28b5248
linux username - x26d1c0189f7a5fab8497008e28b5248
```

### 1.2.2. Samba用户名

fruitmix使用samba的user map功能，将用户的fruitmix用户名map到它的Linux系统用户名，这样用户可以使用它在fruitmix系统内设置的用户名登录samba。

samba用户也可以使用上述Linux系统用户帐号直接访问samba，但不具有实用价值。

Phicomm版本：将用户手机号码（`user.phoneNumber`）map到其Linux系统用户名。

### 1.2.3. 密码

samba登录使用和fruitmix同样的用户密码。fruitmix不会保留该密码的明文，但会保留该密码的密文（对应fruitmix和samba是两个不同的密文，因为使用的加密算法不同）。

fruitmix在配置samba服务的时候会自动注入该密文到samba的密码数据库中（使用`pdbedit`）。

### 1.2.4. share名称

在fruitmix系统中，具有两类虚拟云盘：

1. 每个用户具有一个私有的虚拟云盘（private drive），仅该用户可以访问。
2. 管理员可以创建共享虚拟云盘（public drive），管理员指定的用户可以访问。

在samba服务中，两类虚拟云盘均会自动创建samba share，并应用和fruimtmix内置访问权限相同的访问权限。

vfs不具有文件夹或文件级的细粒度访问权限控制，对应的samba服务也不提供类似功能，访问权限以盘为单位。fruitmix和samba服务也不使用Linux的acl访问控制。

对私有虚拟云盘，对应的share名称是该用户的用户名。

对共享虚拟云盘，对应的share名称是该云盘的名称属性，如果该属性不存在或者有冲突，则使用该云盘的UUID的前面8个字符命名，如果该名称仍然有冲突，则该云盘不显示。

### 1.2.5. samba服务控制

在当前版本中samba服务（包括smbd和nmbd）和fruitmix同时启动，fruitmix如果退出不会关闭samba服务；未来版本中会提供用户手动控制。

### 1.2.6. 文件信息同步

用户通过samba访问对磁盘文件系统做出的增加、修改、和删除操作，fruitmix系统不会立刻知道。

fruitmix通过观察samba的审核日志（audit log）的方式获知用户对磁盘文件系统的改动。

1. 在内部，fruitmix在3721端口启动一个udp服务；
2. 所有samba share均配置`vfs_full_audit` vfs module，该module可以审查所有写入操作；
3. 审查结果写入系统的标号为LOCAL7的日志工具（logging facility）；
4. LOCAL7被配置为127.0.0.1:3721端口的udp服务；在Ubuntu上syslog程序是rsyslogd，该配置通过rsyslogd的配置文件实现

用户通过samba访问对文件系统做出改动时，相应的操作动作会被发送给fruitmix，fruitmix会延时检查文件系统，如果发现文件变更，会启动相应的组件工作，例如计算hash值，提取metadata等等。

## 1.3. 配置文件说明

### 1.3.1. rsyslog配置

用于配置samba的audit log服务。

```bash
# /etc/rsyslog.d/99-smbaudit.conf

LOCAL7.*    @127.0.0.1:3721
```

### 1.3.2. linux系统用户配置

代码使用shell命令创建和删除Linux用户，不会直接改写该文件。

```bash
# /etc/passwd
```

### 1.3.3. samba配置文件

该文件为samba配置文件，路径名不可变更。

```bash
# /etc/samba/smb.conf
```

### 1.3.4. samba用户名配置

该文件路劲由fruitmix软件自定义

```bash
# /etc/smbusermap
```

### 1.3.5. samba密码数据库

代码使用`pdbedit`命令访问，不直接修改samba密码数据库文件。该命令在Ubuntu的samba软件包中自带，如果是自己编译的samba，缺省配置下也会提供该命令。

```bash
# list all samba users
pdbedit -Lw

# remove user
pdbedit -x ${username}

# import user
pdbedit -i smbpasswd:${smbUserFile}
```

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