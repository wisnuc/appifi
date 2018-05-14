<!-- TOC -->

- [1. 概述](#1-概述)
- [2. 责任](#2-责任)
- [3. 依赖](#3-依赖)
- [4. 设计](#4-设计)
- [5. 配置](#5-配置)
- [6. 静态数据结构](#6-静态数据结构)
- [7. 持久化](#7-持久化)
  - [7.1. Tag数据结构](#71-tag数据结构)
  - [7.2. 文件Tag](#72-文件tag)
  - [7.3. Code Review](#73-code-review)
  - [7.4. Unit Testing](#74-unit-testing)

<!-- /TOC -->

# 1. 概述

Tag维护文件Tag。

# 2. 责任

1. 维护Tag数据结构，持久化
2. 提供Tag API

# 3. 依赖

+ 使用DataStore存储
+ 依赖user模块（从constructor传入）
  + user update时要清除对应的tag数据结构

# 4. 设计

设计变更：

(1) tags模块

1. id: 0 -> 无穷大
2. v8从哪个版本开始支持big int

(2) configuration支持

1. 先遵循斐讯逻辑
2. 加入configuration，让代码根据configuration同时支持两种不同逻辑；

(3) 支持deleted属性 

1. 先支持append-only
2. 然后再考虑启动时回收




# 5. 配置

配置1: 全局所有用户共享tag
配置2: 每用户私有tag

# 6. 静态数据结构

一个Tag对象的内部数据结构定义

```
Tag {
  name: "string",                             
  color: "#AABBCC",
  id: 1,                // number
  creator: "user uuid",
  ctime: 1234,          // new Date().getTime()
  mtime: 1234,          // same as above
  deleted: false        //
}
```

**name**

+ 强制
+ 字符串
  + 不可以为空
  + 最大长度，256个字符（unicode）
  + 只接受可打印字符（包括空格，但不包括其他不可见字符例如回车，Tab等等）
  + 无缺省值
+ 不重复
  + 对phi设置：每个人不重复
  + 对wisnuc设置：全局不重复

**color**

+ 强制
+ 字符串
+ 合法格式
  + 7个字符
  + 第一个是`#`
  + 必须是[0-9][A-F]
  + A-F必须大写
+ 缺省是 #66666

**creator**

+ 强制
+ uuid, v4

**ctime & mtime**

+ 强制
+ 自然数含0 Number.isInteger(x) && x >= 0

**deleted**

+ 强制
+ boolean


# 7. 持久化

## 7.1. Tag数据结构

持久化在`tags.json`文件中。


```js
[
  {
    // a tag object
  }
]
```

## 7.2. 文件Tag

文件的Tag持久化在xattr中，属于xstat模块责任。

normalize tag -> ordered set

let normTags = Array.from(new Set(tags)).sort()

xattr里不接受空数组，只允许无属性；

```
xattr {
  //...
  tags: [1, 2, 5]   // tag id
}
```



## 7.3. Code Review

1. 配置仅支持全局共享，考虑在configuration中设置策略
2. jsdoc
3. 返回错误 400/404/403
4. eslint

5. error handling code位置，顺序

## 7.4. Unit Testing

+ it描述
  + context, what, expect
+ assert


describe /tags



group 1: alice and empty tags.

user = alice
empty tags [] <- nested describe

GET []
POST create new
PATCH (non-existent tagId) error 404
DELETE (non-existent tagId) 200 (if idempotent)


group 2 alice and one tag.

user = alice
existing tags [{
  createor: alice
}] 

GET, POST, PATCH, DELETE

urgent:

1. attack index分配算法（！）
2. 载入和写入（全依赖DataStore）？
  + validation? undefined
3. race 如果要测的话是在测DataStore的race，暂缓









