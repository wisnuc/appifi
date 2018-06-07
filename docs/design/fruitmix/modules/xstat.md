<!-- TOC -->

- [1. 概述](#1-概述)
- [2. 依赖](#2-依赖)
- [3. 责任](#3-责任)
- [4. 数据结构](#4-数据结构)
  - [4.1. `xattr`和`xstat`](#41-xattr和xstat)
  - [4.2. 文件](#42-文件)
    - [4.2.1. magic & metadata](#421-magic--metadata)
    - [4.2.2. `xattr`数据结构](#422-xattr数据结构)
    - [4.2.3. `xstat`数据结构](#423-xstat数据结构)
  - [4.3. 文件夹](#43-文件夹)
- [5. tag的处理逻辑](#5-tag的处理逻辑)
- [6. 函数](#6-函数)
  - [6.1. readXattr](#61-readxattr)
    - [6.1.1. 测试](#611-测试)
  - [6.2. readXstat](#62-readxstat)
    - [6.2.1. 实现](#621-实现)
      - [6.2.1.1. EUnsupported错误](#6211-eunsupported错误)
    - [6.2.2. 测试](#622-测试)

<!-- /TOC -->




# 1. 概述

> 重要更新 20180603
>
> xstat加入完整的magic责任


Fruitmix文件系统使用Linux文件系统的文件扩展属性（Extended Attributes）存储文件夹和文件的持久化数据。

`xstat`模块负责读取和持久化存储这些数据。

# 2. 依赖

`xstat`目前不依赖任何fruitmix模块；但未来如果实现tag回收的逻辑，会进化成singleton module。

# 3. 责任

`xstat`模块的责任是负责持久化每个文件和文件夹的如下属性：

1. 文件和文件夹的uuid
2. 文件的hash（按照fingerprint算法）
3. 文件的metadata
4. 文件的tags

在`file api`加入之前，Fruitmix在系统中对文件metadata的维护强制了如下设计规则：

1. 文件的属性分为magic和metadata两个部分；
2. 提取文件metadata的前提是文件已经有hash，且是media类型；
3. 文件的metadata用独立模块(`mediamap`)维护和持久化，与`xstat`无关；

在`file api`加入之后，Fruitmix文件系统对metadata的处理发生了如下变化：

1. 不区分magic和metadata，合并成一个数据维护责任；
2. 持久化在xstat中；
3. 由xstat维护metadata意味着对任何文件而言metadata永远可用；
4. hash和metadata的生命周期无关；
5. 原有media接口和mediamap得以保留，它相当于是一个基于hash做indexing和interning的工作，与forest维护metadata无关；

# 4. 数据结构

## 4.1. `xattr`和`xstat`

`xattr`是存储在扩展属性内的JSON格式数据结构，使用`user.fruitmix`属性名；

`xstat`模块向访问者返回的数据结构混合了`xattr`的部分数据，以及`fs.lstat`返回的`fs.Stats`数据结构，该数据结构也称为`xstat`。

> https://nodejs.org/api/fs.html#fs_class_fs_stats

对于文件和文件夹，`xattr`和`xstat`的定义有差异，分别阐述如下。

## 4.2. 文件

### 4.2.1. magic & metadata

在`file api`和文件uuid索引加入之后，原有的基于magic字符串和number的算法需要拓展。

`magic`和`metadata`的逻辑是memoization；持久化该数据的目的是为了在每次`readXstat`时避免重复计算。

设计需求是：

1. 使用外部工具获得每文件的magic (type)和metadata；
2. 当软件升级时，有办法获知持久化在xattr里的magic/metadata是否需要更新；

新的设计如下：

每个文件的`xstat`内包含`metadata`属性：

```json
{
  "type": "JPG",
  "ver": 0,
}
```

**type**

是一个字符串，为不同的文件类型；对于不支持的文件类型，使用一个underscore(`_`)作为其类型，称未知类型。

**ver**

是一个自然数。针对每个type都有一个版本定义，包括未知类型。

系统在升级时检查每个文件类型对应的版本，如果低于当前软件支持的版本，则废弃`metadata`属性，重新读取。初始版本所有支持的文件类型的ver都是0。


### 4.2.2. `xattr`数据结构

```json
{
  "uuid": "794f8679-7ad8-4695-9283-c8d7c0586a0b",
  "hash": "f6f476cb8dfcc6e565f2079fce780d2e3379ddf403c5c986c7ccfc95c1e5217a",
  "time": 1234, 
  "tags": [1, 2, 3],
  "metadata": {
    "type": "JPG",
    "ver": 0
  }
}
```

**uuid**

必须，符合UUID v4格式的字符串，全小写；Fruitmix文件系统会为每一个文件和文件夹分配一个uuid。

**hash & time**

可选，`hash`为符合sha256格式的字符串，全小写；`time`是正整数，由`new Date().getTime()`产生；

这一对属性必须成对出现；`time`的含义是计算`hash`的开始时间；在更新文件的`hash`时该时间用于和文件当前的时间戳（mtime）做对比。

> 在和云盘同步的需求开始开发时，该属性可能会发生变化，目前的预期是对每个文件存在两种不同的hash算法。

**~~magic~~**

~~必须, `magic`是一个预定义的全大写字符，例如`JPEG`，用于表述文件类型；该文件类型由`file/libmagic`决定。~~

~~对于系统不索引的文件类型，统称为系统不感兴趣的类型；如果文件为系统不感兴趣的类型，`magic`为一个整数，例如`1`，该整数用于版本升级（bumping）。~~

**tags**

可选，tags是一个包含自然数（含0）的数组；如果该属性不存在，视为空数组。

**metadata**

`metadata`是一个对象，见上一节所述。

### 4.2.3. `xstat`数据结构

```js
{       
  uuid: 'uuid string',                   
  type: 'file',         
  name: 'file name',
  mtime: stats.mtime.getTime(),
  size: stats.size,
  hash: 'file hash, optional',
  tags: [],
  metadata: 'metadata object, or, undefined',
}
```

`type`, `name`, `mtime`, `size`来自于文件的`fs.Stats`数据结构;

`uuid`, `hash`, `tags`, `metadata`等属性来自文件的`xattr`;

`xattr`中的`time`属性在模块内部使用，不会返回给访问者;

如果`metadata`是未识别类型，也不返回给访问者；


## 4.3. 文件夹

文件夹的`xattr`数据结构仅包含`uuid`属性。

```json
{
  "uuid": "uuid string"
}
```

文件夹的`xstat`数据结构如下。

```js
{
  uuid: 'uuid string',
  type: 'directory',
  name: 'directory name',
  mtime: stats.mtime.getTime()
}
```

# 5. tag的处理逻辑

`xstat`模块不负责清理失效的tag id；该设计决策考虑了如下因素：

1. 解除了`xstat`对`tag`模块的依赖；
2. 即使`xstat`模块清理失效的tag id，vfs在向客户端返回xstat时仍然要filter；
3. 考虑到实际使用tag的数量不会很大，只要tag模块不采用回首tag id的做法，就不会有tag id的冲突；
4. 暂不考虑xattr的tag id数据回收；

# 6. 函数

## 6.1. readXattr

`readXattr`是一个内部函数，负责读取和修正目标文件的`xattr`；`readXattr`不会修改文件的`xattr`。

**参数**

+ target - 目标文件路径
+ stats - 目标文件的`fs.Stats`对象

**返回**

`xattr`对象；如果`xattr.hasOwnProperty(dirty)`为`true`，该对象与磁盘上的`xattr`不同（新创建或者被修改过）。

如果读取`xattr`操作遇到错误，`readXattr`返回该错误；但`ENODATA`不视为错误。

在下述情况下`readXattr`返回新建的`xattr: { uuid, dirty }`

+ 如果目标文件没有`xattr`
+ 如果目标文件的`xattr`非JSON格式
+ 如果目标文件的`xattr`是合法JSON，但：
  + `xattr`不是JS object
  + `xattr`是null
  + `xattr`是JS Array
  + `xattr`的uuid属性非法

对于文件夹，

对于文件，在下述情况下`readXattr`会修正属性，在返回的attr中定义`dirty`属性为`undefined`：

+ 对于文件
  + 有hash或者time，但hash不合法或time与mtime不一致，会抛弃hash和time
  + magic不合法或过时（低于当前bump version）
  + tags:
      + 不是array会抛弃
      + 是array，会过滤、去重、和排序出其中的自然数(ℕ<sup>0</sup>)
        + 如果得到空array抛弃该属性
        + 如果结果与原始读入结果不符，使用计算的结果

### 6.1.1. 测试



## 6.2. readXstat

**参数**

+ target: 文件或文件夹路径

**返回**

错误或xstat数据结构

### 6.2.1. 实现

1. 使用`fs.lstat`获取`target`的`fs.Stats`数据结构，如果失败返回错误；
2. 如果目标不是普通文件或文件夹，返回EUnsupported错误；
3. 使用`readXattr`读取`xattr`；
4. 如果未读入`xattr`或者`xattr`标为`dirty`，使用`updateXattr`更新`xattr`；
5. 使用`createXstat`合成`xstat`数据结构返回；


#### 6.2.1.1. EUnsupported错误

使用`new Error()`构造。

```js
Error {
  message: 'target is not a regular file or directory',
  code: 'EISBLOCKDEV' // or EISCHARDEV, EISSYMLINK, EISFIFO, EISSOCKET, EISUNKNOWN,
  xcode: 'EUNSUPPORTED'
}
```

### 6.2.2. 测试



