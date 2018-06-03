<!-- TOC -->

- [1. 概述](#1-概述)
- [2. 依赖](#2-依赖)
- [3. 数据结构](#3-数据结构)
  - [3.1. `xattr`和`xstat`](#31-xattr和xstat)
  - [3.2. 文件](#32-文件)
    - [3.2.1. `xattr`数据结构](#321-xattr数据结构)
    - [3.2.2. `xstat`数据结构](#322-xstat数据结构)
  - [3.3. 文件夹](#33-文件夹)
- [4. tag的处理逻辑](#4-tag的处理逻辑)
- [5. 函数](#5-函数)
  - [5.1. readXattr](#51-readxattr)
    - [5.1.1. 测试](#511-测试)
  - [5.2. readXstat](#52-readxstat)
    - [5.2.1. 实现](#521-实现)
      - [5.2.1.1. EUnsupported错误](#5211-eunsupported错误)
    - [5.2.2. 测试](#522-测试)

<!-- /TOC -->




# 1. 概述

>
> 重要更新
>

Fruitmix文件系统使用Linux文件系统的文件扩展属性（Extended Attributes）存储文件夹和文件的持久化数据。

`xstat`模块负责读取和持久化存储这些数据。

# 2. 依赖

`xstat`不依赖任何fruitmix模块。

# 3. 数据结构

## 3.1. `xattr`和`xstat`

`xattr`是存储在扩展属性内的JSON格式数据结构，使用`user.fruitmix`属性名；

`xstat`模块向访问者返回的数据结构混合了`xattr`的部分数据，以及`fs.lstat`返回的`fs.Stats`数据结构，该数据结构也称为`xstat`。

> https://nodejs.org/api/fs.html#fs_class_fs_stats

对于文件和文件夹，`xattr`和`xstat`的定义有差异，分别阐述如下。

## 3.2. 文件

### 3.2.1. `xattr`数据结构

```json
{
  "uuid": "794f8679-7ad8-4695-9283-c8d7c0586a0b",
  "hash": "f6f476cb8dfcc6e565f2079fce780d2e3379ddf403c5c986c7ccfc95c1e5217a",
  "time": 1234, 
  "magic": "JPEG",
  "tags": [1, 2, 3]
}
```

**uuid**

必须，符合UUID v4格式的字符串，全小写；Fruitmix文件系统会为每一个文件和文件夹分配一个uuid。

**hash & time**

可选，`hash`为符合sha256格式的字符串，全小写；`time`是正整数，由`new Date().getTime()`产生；

这一对属性必须成对出现；`time`的含义是计算`hash`的开始时间；在更新文件的`hash`时该时间用于和文件当前的时间戳（mtime）做对比。

**magic**

必须, `magic`是一个预定义的全大写字符，例如`JPEG`，用于表述文件类型；该文件类型由`file/libmagic`决定。

对于系统不索引的文件类型，统称为系统不感兴趣的类型；如果文件为系统不感兴趣的类型，`magic`为一个整数，例如`1`，该整数用于版本升级（bumping）。

**tags**

可选，tags是一个包含自然数（含0）的数组；如果该属性不存在，视为空数组。

### 3.2.2. `xstat`数据结构

```js
{       
  uuid: 'uuid string',                   
  type: 'file',         
  name: 'file name',
  mtime: stats.mtime.getTime(),
  size: stats.size,
  magic: 'string or number',
  hash: 'file hash, optional',
  tags: []
}
```

`uuid`, `hash`, `magic`, `tags`等属性来自文件的`xattr`；`type`, `name`, `mtime`, `size`来自于文件思`fs.Stats`数据结构。

`xattr`中的`time`属性在模块内部使用，不会返回给访问者。

## 3.3. 文件夹

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

# 4. tag的处理逻辑

`xstat`模块不负责清理失效的tag id；该设计决策考虑了如下因素：

1. 解除了`xstat`对`tag`模块的依赖；
2. 即使`xstat`模块清理失效的tag id，vfs在向客户端返回xstat时仍然要filter；
3. 考虑到实际使用tag的数量不会很大，只要tag模块不采用回首tag id的做法，就不会有tag id的冲突；
4. 暂不考虑xattr的tag id数据回收；

# 5. 函数

## 5.1. readXattr

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

### 5.1.1. 测试



## 5.2. readXstat

**参数**

+ target: 文件或文件夹路径

**返回**

错误或xstat数据结构

### 5.2.1. 实现

1. 使用`fs.lstat`获取`target`的`fs.Stats`数据结构，如果失败返回错误；
2. 如果目标不是普通文件或文件夹，返回EUnsupported错误；
3. 使用`readXattr`读取`xattr`；
4. 如果未读入`xattr`或者`xattr`标为`dirty`，使用`updateXattr`更新`xattr`；
5. 使用`createXstat`合成`xstat`数据结构返回；


#### 5.2.1.1. EUnsupported错误

使用`new Error()`构造。

```js
Error {
  message: 'target is not a regular file or directory',
  code: 'EISBLOCKDEV' // or EISCHARDEV, EISSYMLINK, EISFIFO, EISSOCKET, EISUNKNOWN,
  xcode: 'EUNSUPPORTED'
}
```

### 5.2.2. 测试



