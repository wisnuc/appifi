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
  - [5.1. readXstat](#51-readxstat)
    - [5.1.1. 测试](#511-测试)

<!-- /TOC -->


# 1. 概述

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

`xstat`模块不负责清理失效的tag id；该设计考虑了如下因素：

1. 解除了`xstat`对`tag`模块的依赖；
2. 即使`xstat`模块清理失效的tag id，vfs在向客户端返回xstat时仍然要filter；
3. 考虑到实际使用tag的数量不会很大，只要tag模块不采用回首tag id的做法，就不会有tag id的冲突；
4. 暂不考虑xattr的tag id数据回收；

# 5. 函数

## 5.1. readXstat

**参数**

+ target: 文件或文件夹路径

**返回**

错误或xstat数据结构




### 5.1.1. 测试



