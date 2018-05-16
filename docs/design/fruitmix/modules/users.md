<!-- TOC -->

- [1. 概述](#1-概述)
- [2. 责任](#2-责任)
- [3. 依赖](#3-依赖)
- [4. 设计](#4-设计)
- [5. 配置](#5-配置)
- [6. 静态数据结构](#6-静态数据结构)
- [7. 持久化](#7-持久化)
  - [7.1. User数据结构](#71-user数据结构)
  - [7.2. Unit Testing](#72-unit-testing)

<!-- /TOC -->

# 1. 概述

User维护系统所有用户信息和用户密码。

# 2. 责任

1. 维护User数据结构，持久化
2. 提供User API

# 3. 依赖

+ 使用DataStore存储
+ 依赖配置(从constructor传入)
  + 斐讯模式/wisnuc模式
  + 数据持久化位置和临时目录位置
+ 依赖drive反向通知(清理回收已删除的资源)

# 4. 设计

# 5. 配置

配置1: 斐讯用户体系
配置2: 闻上用户体系
配置3: 数据存储位置

# 6. 静态数据结构

一个User对象的内部数据结构定义

```
User {
  uuid: "uuid string",
  username: "string",
  isFirstUser: true, // boolean
  phicommUserId: "string",
  password: "crypt string",
  smbPassword: "crypt string",
  status: "ACTIVE"  // enum ["ACTIVE", "INACTIVE", "DELETED"],
  lastChangeTime: 1526438386342 // number
  createTime: 1526438386342 // number
}
```

**uuid**

+ 强制
+ uuid, v4

**username**

+ 强制
+ 字符串
  + 不可以为空
  + 最大长度，256个字符（unicode）
  + 只接受可打印字符（包括空格，但不包括其他不可见字符例如回车，Tab等等）
  + 无缺省值
+ 不重复

**isFirstUser**

+ 非强制
+ 布尔类型
+ 独一
  + 只有admin/boundUser 才可以为true
  + 上述user在系统只能存在一个
+ 缺省是undefined

**phicommUserId**

+ 在斐讯用户配置下为强制
+ 在wisnuc用户体系下无此字段
+ 全数字字符串
  + 不可重复
  + 无缺省值

**password & smbPassword**

+ 在斐讯用户下非强制
+ 在闻上用户下强制
+ 字符串
  + 加密后的字符串


**createTime & lastChangeTime**

+ 强制
+ 自然数含0 Number.isInteger(x) && x >= 0

**status**

+ 强制
+ enum
+ 只有admin可以修改这个字段
  + ACTIVE 和　INACTIVE 直接可以翻转
  + DELETED 不可翻转

# 7. 持久化

## 7.1. User数据结构

持久化在`users.json`文件中。


```js
[
  {
    // a user object
  }
]
```

## 7.2. Unit Testing
