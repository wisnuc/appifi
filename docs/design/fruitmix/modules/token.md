<!-- TOC -->

- [概述](#概述)
- [依赖](#依赖)
- [数据结构](#数据结构)
- [Code Review](#code-review)
- [Unit Testing](#unit-testing)

<!-- /TOC -->

# 概述

secret string for JWT token
- basic auth
- jwt auth
- 生成本地访问的 token
- 生成远程访问的 token

# 依赖

- Fruitmix (fruitmix.users)

# 数据结构

本地访问的 token
```js
{
  type: 'JWT',
  forRemote: false,   // for remote user
  token: jwt.encode({
    uuid: user.uuid
  }, this.secret)
}
```

远程访问的 token
```js
{
  type: 'JWT',
  uuid: user.uuid,  //user uuid
  forRemote: true,
  token: jwt.encode({
    uuid: user.uuid,
    phicommUserId: user.phicommUserId,
    timestamp: new Date().getTime()    // timestamp
  }, this.secret)
}
```

# Code Review

- error handling
- jsdoc
- eslint

# Unit Testing








