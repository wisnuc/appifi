# Samba

Samba是一个兼容Windows文件共享的服务程序，广泛用于各种非Windows平台系统提供Windows文件共享服务。

## 软件包（package）

Samba功能由Ubuntu Server的samba软件包提供。本项目未使用特殊编译版本。

如果使用wisnuc定制的Ubuntu Server安装光盘安装Ubuntu系统，或者使用wisnuc ws215i设备的官方系统镜像，则samba服务已经安装。

## 配置

Fruitmix（appifi服务的核心组件）内置samba支持。

Fruitmix会使用内置的用户帐号和密码系统创建samba的服务配置文件。

### Linux系统用户帐号

samba服务的用户需要具有系统用户帐号。

fruitmix系统中每个用户具有唯一标识ID（UUID）；fruitmix使用该UUID创建一个对应的Linux系统用户名，命名规则如下：

UUID的格式为`xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx`，去除所有的`-`，去掉`M`，加上`x`前缀。

该用户不具有Linux系统登录能力。

> 例如fruitmix用户的UUID为`26d1c018-9f7a-45fa-b849-7008e28b5248`, 则对应的Linux系统用户名为`x` `26d1c018` `9f7a` `5fa` `b849` `7008e28b5248`.

### Samba用户名

fruitmix使用samba的user map功能，将用户的fruitmix用户名map到它的Linux系统用户名，这样用户可以使用它在fruitmix系统内设置的用户名登录samba。

samba用户也可以使用上述Linux系统用户帐号直接访问samba，但不具有实用价值。

### 密码

samba登录使用和fruitmix同样的用户密码。fruitmix不会保留该密码的明文，但会保留该密码的密文（对应fruitmix和samba是两个不同的密文，因为使用的加密算法不同）。

fruitmix在配置samba服务的时候会自动注入该密文到samba的密码数据库中（使用`pdbedit`）。

### share名称

在fruitmix系统中，具有两类虚拟云盘：

1. 每个用户具有一个私有的虚拟云盘（private drive），仅该用户可以访问。
2. 管理员可以创建共享虚拟云盘（public drive），管理员指定的用户可以访问。

在samba服务中，两类虚拟云盘均会自动创建samba share，并应用和fruimtmix内置访问权限相同的访问权限。

fruitmix的虚拟云盘不具有文件夹或文件级的细粒度访问权限控制，对应的samba服务也不提供类似功能，访问权限以盘为单位。fruitmix和samba服务也不使用Linux的acl访问控制。

对私有虚拟云盘，对应的share名称是该用户的用户名。

对共享虚拟云盘，对应的share名称是该云盘的名称属性，如果该属性不存在或者有冲突，则使用该云盘的UUID的前面8个字符命名，如果该名称仍然有冲突，则该云盘不显示。

### samba服务控制

在当前版本中samba服务（包括smbd和nmbd）和fruitmix同时启动，fruitmix如果退出不会关闭samba服务；未来版本中会提供用户手动控制。

### 文件信息同步

用户通过samba访问对磁盘文件系统做出的增加、修改、和删除操作，fruitmix系统不会立刻知道。

fruitmix通过观察samba的审核日志（audit log）的方式获知用户对磁盘文件系统的改动。

1. 在内部，fruitmix在3721端口启动一个udp服务；
2. 所有samba share均配置`vfs_full_audit` vfs module，该module可以审查所有写入操作；
3. 审查结果写入系统的标号为LOCAL7的日志工具（logging facility）；
4. LOCAL7被配置为127.0.0.1:3721端口的udp服务；在Ubuntu上syslog程序是rsyslogd，该配置通过rsyslogd的配置文件实现

用户通过samba访问对文件系统做出改动时，相应的操作动作会被发送给fruitmix，fruitmix会延时检查文件系统，如果发现文件变更，会启动相应的组件工作，例如计算hash值，提取metadata等等。

## 配置文件说明

### rsyslog配置

用于配置samba的audit log服务。

```bash
# /etc/rsyslog.d/99-smbaudit.conf

LOCAL7.*    @127.0.0.1:3721
```

### linux系统用户配置

代码使用shell命令创建和删除Linux用户，不会直接改写该文件。

```bash
# /etc/passwd
```

### samba配置文件

该文件为samba配置文件，路径名不可变更。

```bash
# /etc/samba/smb.conf
```

### samba用户名配置

该文件路劲由fruitmix软件自定义

```bash
# /etc/smbusermap
```

### samba密码数据库

代码使用`pdbedit`命令访问，不直接修改samba密码数据库文件。该命令在Ubuntu的samba软件包中自带，如果是自己编译的samba，缺省配置下也会提供该命令。

```bash
# list all samba users
pdbedit -Lw

# remove user
pdbedit -x ${username}

# import user
pdbedit -i smbpasswd:${smbUserFile}
```
