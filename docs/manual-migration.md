# 旧版本迁移

本文档用于2017年9月30日发布的appifi 0.9.0以前的ws215i用户数据迁移。

20170930版本之前，闻上官方发布过两个ws215i版本：

1. 2016年1月份众筹用户的版本
2. 2017年2月份发布的appifi 0.2.x版本，该版本可以通过打开浏览器登录服务器的3001端口看到。

如果您在设备上的数据不是特别多且在其他设备上有备份，我们强烈建议您直接刷机安装最新版本，然后重新导入数据；如果按照下述文档说明在shell终端内进行文件操作，请务必确认重要数据存有其他备份，或者在操作之前先通过设备的USB口向外部存储设备备份。

> 同时我们必须向所有在使用旧版本的用户表达深切的歉意，未能提供平滑升级功能并非因为我们想偷懒，而是新版本在结构上做了很大调整，而且随着开发的功能越来越多，代码维护工作量也越来越大；没有对之前的版本做自动数据迁移支持是为了减轻未来版本进化的负担，希望旧版本用户可以理解。如果遇到任何问题可以在我们的QQ群里寻求技术支持。

# 0.2.x版本

该版本的目录结构与新版本基本一致。不同之处在于两个重要的系统文件，`users.json`和`drives.json`，文件格式和文件位置均与新版本不同。

> 0.2.x版本的磁盘在新版本上会判定为未安装wisnuc系统。

## 文件位置

在0.2.x版本中文件位置位于:
```
/run/wisnuc/volumes/<btrfs磁盘卷uuid>/wisnuc/fruitmix/models/users.json
/run/wisnuc/volumes/<btrfs磁盘卷uuid>/wisnuc/fruitmix/models/drives.json
```

在新版本中，这两个文件位于：
```
/run/wisnuc/volumes/<btrfs磁盘卷uuid>/wisnuc/fruitmix/users.json
/run/wisnuc/volumes/<btrfs磁盘卷uuid>/wisnuc/fruitmix/drives.json
```

即前者存在于fruitmix目录的models子目录内，后者没有models子目录，存在于fruitmix目录内。

## 文件格式

这两个文件在两个软件版本中均为标准的JSON格式；手动修改文件内容时最好能找一个支持验证JSON格式的编辑器。

### user.json

在新版本中，`users.json`格式定义如下：

```json
[
  {
    "uuid": "3bca88ea-269a-441c-9289-46bc305805fa",
    "username": "alice",
    "password": "$2a$10$2wfUbDUNmqN.X9m1CnavM.Msa5cCzGHvSOnk0HeqUdbVnxavMvMZ2",
    "unixPassword": "$6$F/vNtqZM$/C2lwBdvsH855oOYg8r1hsqmOEfEVazetNBdoumFvaFaL7t7PLNc63CPUAtoLyB1KRouKSjKsfAPy0eDQiJxz0",
    "smbPassword": "4039730E1BF6E10DD01EAAC983DB4D7C",
    "lastChangeTime": 1506342629422,
    "isFirstUser": true,
    "isAdmin": true,
    "avatar": null,
    "disabled": false,
    "global": null
  }
]
```

+ uuid: 每个用户的唯一标识，必须全部小写；
+ username: 每个用户的用户名，该用户名原则上支持任何字符，但它同时用于用户的samba登录的用户名，所以不建议使用难以输入的字符；
+ password: 用户密码密文；
+ unixPassword: 对应用户密码的linux系统密码密文，目前尚未使用；
+ smbPassword: 对用用户密码的samba密码密文；
+ lastChangeTime：最后一次修改用户名或密码的时间；
+ isFirstUser: 仅第一用户设置为true，其他用户为false；
+ isAdmin: 该用户是否为系统管理员；
+ avatar: 保留属性，固定为null；
+ disabled: 当前用户禁止访问；
+ global: 微信帐号的绑定信息，缺省为null；

在0.2.x版本中，`users.json`的格式定义如下：

```json
{
  "type": "该字段应删除",
  "uuid": "该字段应保留",
  "username": "该字段应保留",
  "password": "该字段应保留",
  "smbPassword": "该字段应保留",
  "smbLastChangeTime": "该字段名称应修改为lastChangeTime，值保留",
  "avatar": "该字段应保留，设置为null",
  "email": "该字段应删除",
  "isAdmin": "该字段应保留",
  "isFirstUser": "该字段应保留",
  "home": "该字段应删除，同时drives.json里对应的drive对象应标记tag为home", 
  "library": "该字段应删除"
}
```

### drives.json

新版本的`drives.json`文件内容如下所示：

```json
[
  {
    "uuid": "746d3476-849b-4e60-becb-84211ee4920e",
    "type": "private",
    "owner": "adead397-b7a2-4f8a-8680-0aabc95d85a1",
    "tag": "home"
  },
  {
    "uuid": "ec98807f-e957-40d6-97d0-de3da77edef5",
    "type": "public",
    "writelist": [
      "b684d090-2405-4194-ab69-e0b34faf8f44",
      "0b18ee88-b398-4912-bbd4-00439eba62d2",
      "c18c4454-cfa7-4dfc-8c96-b06fca225b03",
      "7440ef87-b6c0-478a-b09f-c05406c74deb",
    ],
    "readlist": [],
    "label": "duang"
  },
]
```

有两类drive对象
+ 对于type设置为private的对象（私有盘）：
  - uuid: 唯一标识
  - type: 类型，必须为`private`
  - owner: 盘的所有者的唯一标识（UUID）
  - tag: 使用方式，目前仅支持`home`
+ 对于type设置为public的对象（共享盘）：
  - uuid: 唯一标识
  - type: 类型，必须为`public`
  - writelist: 所有可以访问该盘内容且具有写权限的用户的UUID列表
  - readlist: 目前未使用，应设置为`[]`
  - label: 该盘的文字标识，用于客户端显示和samba访问时的share名称

在0.2.x版本中，`drives.json`文件定义的每个drive对象的格式如下：

```json
[
  {
    "label": "如果type为private，该字段应删除，如果type为public，该字段应保留",
    "fixedOwner": "该字段应删除，同时加入type属性，如果原有值为true，则type为private，否则为public",
    "URI": "fruitmix，该字段应删除",
    "uuid": "该字段应保留",
    "owner": "[] 见说明",
    "writelist": "[]，该字段应保留",
    "readlist": "[]，该字段应设置为[]，原有的UUID内容应加入writelist",
    "cache": "该字段应删除"
  }
]
```

## 手动迁移过程

**第一步**

用户在更新到新版本软件后，重新启动系统，会看到存在btrfs磁盘卷但是没有用户。

此时建议用户应先通过3001端口浏览器访问，停止appifi程序。不停止也可以，但不要通过客户端操作创建用户。

然后用ssh进入系统，找到fruitmix目录位置。

**第二步**

在修改users.json文件和drives.json文件之前请务必先复制一份。

**第三步**

fruitmix的用户和虚拟网盘设置逻辑很简单：
1. `users.json`文件里只包含用户定义信息，每个用户有唯一的uuid
2. `drives.json`文件里只定义虚拟网盘信息，每个网盘有唯一的uuid，所有网盘的存储位置都在`fruitmix/drives`目录下，子目录名称和网盘的uuid一致

首先根据上述`users.json`文件的定义，在`fruitmix`目录下创建新的`users.json`文件；注意：
1. 记下`home`和`library`两个uuid值，它们分别对应在0.2.x版本中该用户的home网盘和library网盘；
2. 原`smbLastChangeTime`属性更名为`lastChangeTime`，值不变；
3. 增加`unixPassword`属性，值可以设置为空（"")；
4. 删除新版本格式中不需要的属性；

然后迁移`drives.json`文件，新版本文件格式简单。
1. 先根据原有的fixedOwner属性创建`type`，`fixedOwner`为`true`则`type`为`private`，否则为`public`；
2. 对于`private`类型：
  1. 保留`uuid`；
  2. 保留`owner`，但值类型从原来的数组改为字符串（即去掉[]）；
  3. 检查原`users.json`里对应的`uuid`为`owner`的用户：
    - 如果该drive对象的`uuid`和user对象的`home`值一致，则该drive对象需保留，且需增加属性`tag`，值设置为`home`
    - 如果该drive对象的`uuid`和user对象的`library`值一致，则该drive对象需删除；在新版本中取消了对`library`特性的支持，用户可以用`mv`命令把对应`library`的目录移动到所属用户的`home`对应的虚拟盘目录下。
3. 对于`public`类型：
  1. 保留`uuid`；
  2. 保留`label`；
  3. 把原来在`writelist`和`readlist`里的UUID字符串都加入到`writelist`里，`readlist`设置为空数组`[]`
    - 新版本暂不支持共享盘区分读写权限，`readlist`属性不生效，但保留；
    - 删除不必要的属性

**第四步**

找一个支持JSON格式校验的编辑器（或者在线检查器），检查新创建的两个文件格式均正确；

**第五步**

把这两个文件放在目标位置（fruitmix目录下）。重新启动appifi服务程序。

# 众筹版

众筹版与后续版本是完全不同的软件版本。用户应该用新版本直接安装appifi系统，然后把下述目录中的文件手工移动到对应的用户的虚拟网盘内，或者移动到共享网盘内，参见前面对两个JSON文件格式的说明。

（待补充）
