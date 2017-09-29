# 磁盘文件结构

`appifi`分离系统和用户数据，系统安装在独立的磁盘或磁盘分区上，用户数据保存在独立的磁盘（磁盘卷）上。

操作系统的根文件系统（root file system，简写为rootfs）可以使用任何Linux支持作为roofs的文件系统类型，缺省为ext4，也是推荐的文件系统；用户在安装系统时也可以选择其他文件系统类型，例如btrfs。

用户数据位于一个btrfs磁盘卷上。用户可以通过客户端软件在除了根文件系统的其他磁盘上创建btrfs卷。`appifi`仅支持使用完整磁盘作为btrfs卷的设备（btrfs device），不支持使用磁盘上的分区作为btrfs device。

## 挂载点

系统中所有btrfs磁盘卷都会被`appifi`挂载到`/run/wisnuc/volumes`目录的子目录上，子目录的名称是该btrfs磁盘卷的UUID，例如：

```
/run/wisnuc/volumes/c579841a-912b-43f4-9be2-7b32c2e3eebb/
```

如果磁盘卷出现错误或者部分磁盘缺失，磁盘卷仍然会以只读和降级方式（`-o ro,degraded`）挂载到对应位置。

## 系统配置

系统配置文件位于根文件系统上，路径为：

```
/etc/wisnuc.json
```

该文件指定了系统当前使用哪个btrfs卷存储用户数据。所有用户数据，包括用户名密码和虚拟云盘对应的物理目录信息，都保存在用户数据卷上，不存在于根文件系统上。因此在任何情况下重新安装整个根文件系统，对用户数据而言都是安全的。

## 用户数据目录树

`appifi`会用户选择的btrfs磁盘卷的根目录创建名为`wisnuc`的目录，在`wisnuc`目录下创建`fruitmix`目录，全部用户数据都存在该目录下。`appifi`不会去修改`wisnuc`目录之外的文件。

`fruitmix`目录下的文件结构如下所示：

```
/run/wisnuc/volumes/c579841a-912b-43f4-9be2-7b32c2e3eebb/
└── wisnuc
    └── fruitmix
        ├── boxes
        ├── drives
        │   └── 02000ee4-bfbc-4681-98c8-f71b904260e9
        ├── drives.json
        ├── metadataDB.json
        ├── repo
        ├── station
        │   ├── pb.pub
        │   ├── pv.pem
        │   └── station.json
        ├── thumbnail
        ├── tmp
        │   └── d5473640-f14a-4e96-b03d-04ae34959bbd
        └── users.json
```

其中`users.json`和`drives.json`文件是系统的核心文件，分别定义了用户帐号信息和虚拟文件系统路径与权限信息。在一般使用情况下用户不应该修改它们。

`drives`文件夹下是所有用户的虚拟文件系统。每个子文件夹对应一个虚拟文件系统，使用虚拟文件系统的UUID命名。

`station`文件夹下是该设备与闻上云服务通讯所需的必要信息，包括身份，公密钥证书等；其中密钥证书作为云相信该设备身份的依据，如果被窃取会导致该设备身份被他人仿冒，但不会危及本地数据安全。用户在任何时候都不应该将密钥信息从设备中复制出来保存在它处。如果确信该密钥已经泄漏，用户通过客户端可以重新生成新的公钥密钥对，泄漏的密钥没有其他后果。

其他目录和文件对应的功能暂未开放，不做介绍。

`appifi`作为重头设计的系统，在设计之处就把降低系统复杂度、减少不必要的用户数据损失作为最高设计目标之一。除上述文件外，`appifi`不额外使用任何数据库软件或嵌入式数据库存储重要的系统信息。在系统遇到无法回复的数据错误时，用户可以很方便的根据上述描述找回文件和文件系统结构，避免不必要的损失。

## users.json

该文件为json格式。整个文件为一个数组，数组内存储了每个用户的信息：

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

上述信息不应该手动修改，如果文件损坏或者恢复系统数据，用户可以考虑手工编辑，不会因为文件格式错误或信息错误直接损坏系统的其他部分数据；手动修改前用户应该保留旧有版本。

## drives.json

该文件为json格式。整个文件为一个数组，数组内存储了每个虚拟盘的信息。

`appifi`内置有两种虚拟盘：私有盘和共享盘。两种数据格式有差异，下面是一个私有盘和一个公有盘的例子。

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

### 私有盘

包含如下属性：
- uuid: 唯一标识
- type: 类型，必须为`private`
- owner: 盘的所有者的唯一标识（UUID）
- tag: 使用方式，目前仅支持`home`

系统目前未提供用户独立创建私有盘功能，每个用户在创建时自动创建一个私有盘；该文件系统内的内容仅有该用户可见，包括系统管理员也不可以访问他人私有盘内的内容；私有盘的所有者属性不可修改。

### 公有盘

包含如下属性：
- uuid: 唯一标识
- type: 类型，必须为`public`
- writelist: 所有可以访问该盘内容且具有写权限的用户的UUID列表
- readlist: 目前未使用，应设置为`[]`
- label: 该盘的文字标识，用于客户端显示和samba访问时的share名称

具有系统管理员权限的用户可以通过客户端创建公有盘，所有位于writelist中的用户对该盘有可写访问权限；管理员不缺省具有盘内文件系统的访问权限，但是它可以把自己加入writelist获得访问权限。

### 目录

无论公有盘还是私有盘，其文件存储均位于上述`wisnuc/fruitmix/drives`目录下，对应的目录名是盘的唯一标识（uuid属性）。