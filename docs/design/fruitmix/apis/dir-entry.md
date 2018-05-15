<!-- TOC -->

- [1. Overview](#1-overview)
- [2. MKDIR](#2-mkdir)
  - [2.1. Tests](#21-tests)
    - [2.1.1. 单例](#211-单例)
- [3. REMOVE](#3-remove)
  - [3.1. Tests](#31-tests)
    - [3.1.1. 单例](#311-单例)
- [4. RENAME](#4-rename)
  - [4.1. Tests](#41-tests)
    - [4.1.1. 单例](#411-单例)
- [5. NEWFILE](#5-newfile)
  - [5.1. 测试](#51-测试)
    - [5.1.1. 参数合法性](#511-参数合法性)
    - [5.1.2. 无Policy单例](#512-无policy单例)
    - [5.1.3. 使用Policy](#513-使用policy)
- [6. APPEND](#6-append)
  - [6.1. 规范](#61-规范)
  - [6.2. 测试](#62-测试)
    - [6.2.1. 参数合法性](#621-参数合法性)
    - [6.2.2. 连续操作](#622-连续操作)
- [7. DUP](#7-dup)

<!-- /TOC -->

# 1. Overview

测试操作：

+ mkdir * ( =toName, toName)
+ remove (fromName, =fromName)
+ rename * (fromName, toName)
+ dup * (fromName, toName)
+ newfile * (=toName, toName)
+ append (fromName, =toName)

**命名冲突策略**

其中（*）操作允许使用命名冲突解决策略

**无UUID的文件操作**

原则上除了新建操作之外都需要客户端提供UUID，保证并发操作的race问题。

对于文件有可能出现连续操作过程，例如：

1. 先newfile一个文件，连续append，用于连续传输大文件；
2. 先newfile一个文件，可选连续append，最后rename，用于先建立临时文件最后命名；
3. 在1或2的场景下最后dup，因为需要操作的文件是

在这些场景下，首次操作无须提供UUID，后续的操作无法提供UUID；API允许这些后续操作不提供UUID；

测试目标：

+ 测试单操作覆盖参数组合
+ 测试组合操作的顺序依赖关系
+ 测试rename策略下允许的不提供UUID操作（仅append）

validity

API

单资源，包含属性
+ 参数合规
  + 401, 400, 403 

ignore read only
password -> update password, ignore other, invalid password 400
 
property conflict name

CRUD property validity

+ 单操作权限

资源关系
+ user - drive
  + user active -> inactive -> deleted
         inactive -> active

         role

  run-time 
  robust (AR)

+ user - tag
  + user active -> inactive -> delete

Internal State
+ 关联
  + LAZY
  + deleting user -> drive -> vfs -> drive -> user (ROBUST)


# 2. MKDIR

参数使用field格式：

+ `name` - 需要建立的文件夹名字
+ `body` - JSON对象

```json
{
  "op": "mkdir",
  "policy": ["skip", null]
}
```

`policy`为可选；

policies:

+ undefined
+ [null, null]
+ [null, skip]
+ [null, replace]
+ [null, rename]
+ [skip, null]
+ [skip, skip]
+ [skip, replace]
+ [skip, rename]
+ [replace, null]
+ [replace, skip]
+ [replace, replace]
+ [replace, rename]
+ [rename, null]
+ [rename, skip]
+ [rename, replace]
+ [rename, rename]

## 2.1. Tests

### 2.1.1. 单例

**文件**

`direntry/mkdir.js`

**测例**

+ 目标不存在，所有合法policy成功，resolved [false, false]
+ 目标存在同名文件夹，same生效
  + same === null，403, EEXIST, EISDIR
  + same === skip，200，resolved [true, false] name/uuid不变
  + same === replace, success, resolved [true, false] name/uuid变化（underlying层定义的replace保留uuid）
  + same === rename, 200, resolved [true, false] 原dir不变，新建一个dir
+ 目标存在同名文件，diff生效
  + diff === null, 403，EEXIST, EISFILE（*）
  + diff === skip, 200, resolved [false, true], name/uuid不变 (*)
  + diff === replace, 200, resolved [false, true], file replaced by dir (*)
  + diff === rename, 200, resolved [false, true], file kept, new dir (*)

17种policy，3种目标状态，计51个测例。

**进度**

1. (*)内容需要用api创建测试文件
2. 所有测例均未验证磁盘内容
3. it描述格式混乱
4. 覆盖不支持的文件格式，例如symlink，未测试

# 3. REMOVE

参数使用field格式：

+ name: 文件或文件夹名称
+ body: JSON对象

```json
{
  "op": "remove",
  "uuid": "需要删除的文件或文件夹的uuid"
}
```

在当前版本中，`uuid`属性无须提供，服务器也不会处理。未来该属性设计为可选属性，使用该属性可以应对一些race场景；但是对用户操作而言，使用`uuid`的意义不大。

该操作使用幂等性设计，即如果目标不存在，视为成功。

## 3.1. Tests

### 3.1.1. 单例

**文件**

`direntry/remove.js`

**测例**

+ /hello-dir/world-dir 删除 /hello-dir/world-dir 成功
+ /hello-dir/world-file 删除 /hello-dir/world-file 成功
+ /hello-dir 删除 /hello-dir/world 成功

# 4. RENAME

参数使用field格式：

+ name: 需要提供"oldname|newname"格式的两个名字
+ body: JSON对象

```json
{
  "op": "rename",
  "policy": [null, null]
}
```

`policy`为可选属性，如不提供，缺省为`[null, null]`。

## 4.1. Tests

### 4.1.1. 单例

**文件**

`direntry/rename.js`

**测例**

+ oldname为文件，newName不存在，所有合法policy成功，resolved [false, false]
+ oldname为文件夹，newName不存在，所有合法policy成功，resolved [false, false]

+ old为文件，存在同名文件，same生效
  + same === null，403, EEXIST, EISFILE
  + same === skip，200，resolved [true, false]
  + same === replace, 200, resolved [true, false]
  + same === rename, 200, resolved [true, false] 

+ old为文件，存在同名文件夹，diff生效
  + diff === null, 403，EEXIST, EISDIR
  + diff === skip, 200, resolved [false, true]
  + diff === replace, 200, resolved [false, true]
  + diff === rename, 200, resolved [false, true]

+ old为文件夹，存在同名文件夹，same生效
  + same === null，403, EEXIST, EISDIR
  + same === skip，200，resolved [true, false]
  + same === replace, 200, resolved [true, false]
  + same === rename, 200, resolved [true, false] 

+ old为文件夹，存在同名文件，diff生效
  + diff === null, 403，EEXIST, EISFILE
  + diff === skip, 200, resolved [false, true]
  + diff === replace, 200, resolved [false, true]
  + diff === rename, 200, resolved [false, true]

# 5. NEWFILE

参数使用file格式。

+ name: 需要创建的文件名称
+ body: 文件数据
+ filename: JSON对象

```json
{
  "op": "newfile",
  "size": 1234,
  "sha256": "sha256 string",
  "policy": [null, null]
}
```

`op`, `size`, `sha256`为必须字段；`policy`可选；允许上传空文件。

## 5.1. 测试

### 5.1.1. 参数合法性

+ name不合法
  - 未提供 (x)
  - 非字符串 (x)
  - 非法字符串 `hello/world`
  - 两个字符串 `hello|world`
+ size不合法
  - 未提供
  - 不是数字 hello, {}, []
  - 不是整数 99.99
  - 小于0 -1
  - 大于1G 1G + 1
+ sha256不合法
  - 未提供
  - 非字符串 1, {}, []
  - 非SHA256字符串 hello
  - 在size为0时不是空SHA256 (TODO)
+ policy不合法
  - 非array 1, 'hello', {}, 
  - 非size = 2 array [], [null, null, null]
  - 包含非法字符串 ['hello', null], [null, 'hello']

### 5.1.2. 无Policy单例

+ 上传0字节文件成功
+ 上传1字节文件成功
+ 上传0.5G字节文件成功
+ 上传(1G - 1)字节文件成功
+ 上传1G字节文件成功

以上6个测试pre和post各测一次，计12个测例。

### 5.1.3. 使用Policy

TODO

# 6. APPEND

## 6.1. 规范

参数使用file格式。

+ name: append的目标文件名称
+ body: append的数据
+ filename: JSON对象

```json
{
  "op": "append",
  "hash": "目标文件当前hash(fingerprint)",
  "size": "append的文件块大小",
  "sha256": "append的文件块的sha256"
}
```

+ 所有属性必须提供；
+ name必须是合法文件名，由sanitize检验；
+ name必须是文件；
+ hash必须是合法的sha256字符串；
+ size必须是大于0小于等于1G的整数；
+ sha256必须是合法的sha256字符串；
+ 目标文件的hash必须与参数提供的hash一致；

## 6.2. 测试

### 6.2.1. 参数合法性

> 标注x的客户端库或协议无法实现，标注(-)的为不同测试组


- name不合法
  - 未提供 (x)
  - 非字符串 1 (x)
  - 非法字符串 `hello/world`
  - 提供了两个 `hello|world`
  - name不是文件 (-)

- hash不合法
  - 未提供
  - 非字符串 1
  - 格式非法 
    + hello
    + uppercase 
  - 与目标文件不一致 (-) ???

- size不合法
  - 未提供
  - 非数字 hello
  - 非证书 99.99
  - 小于0 -1
  - 等于0 
  - 大于1G 1G + 1
  - 实际传输大小比size大（oversize）(-)
  - 实际传输的大比size小（undersize）(-)

- sha256不合法
  - 未提供
  - 非字符串 1
  - 非sha256字符串 hello
  - 与传输文件不一致 (-)

- 目标文件
  - 403 目标文件不存在
  - 403 目标是文件夹
  - 403 目标是符号链
  - 403 目标文件的大小不是1G的整数倍
  - 403 hash与目标文件不一致

### 6.2.2. 连续操作

- 目标 empty
+ 200 append alonzo to empty
+ 200 append 1G to empty







# 7. DUP





