# 概述

Tag维护文件Tag。



# 责任

1. 维护Tag数据结构，持久化
2. 提供Tag API

# 依赖

+ 使用DataStore存储
+ 依赖user模块（从constructor传入）
  + user update时要清除对应的tag数据结构

# 配置

配置1: 全局所有用户共享tag
配置2: 每用户私有tag

# 静态数据结构

一个Tag对象的内部数据结构定义

```
Tag {
  name: "string",                             
  color: "#AABBCC",
  id: 1,            // number
  group: null,      // reserved
  creator: "user uuid",
  ctime: 1234,      // new Date().getTime()
  mtime: 1234,      // same as above
}
```

id
creator

definition: broken tag
1. id 不合法
2. creator不合法（creator不存在？？？，需要user，和drive一样observe status，暂缓讨论）

3. id dup

# 持久化

## Tag数据结构

持久化在`tags.json`文件中。

```js
{
  index: 123,     // 已经使用的最大index
  tags: []
}
```
## 文件Tag

文件的Tag持久化在xattr中，属于xstat模块责任。

```
xattr {
  //...
  tags: [1, 2, 5]   // tag id
}
```

## Rules/Specs

1. tag name禁止全局重复（使用全局配置时）
2. delete幂等

需要一个载入时的validation rule, permissive

## 算法

index分配

## Code Review

1. 配置仅支持全局共享，考虑在configuration中设置策略
2. jsdoc
3. 返回错误 400/404/403
4. eslint

5. error handling code位置，顺序

## Unit Testing

+ it描述
  + context, what, expect
+ assert


describe /tags

it 

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









