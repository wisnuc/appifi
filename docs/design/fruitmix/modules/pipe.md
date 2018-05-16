<!-- TOC -->

<<<<<<< HEAD
- [1. 概述](#1-概述)
- [2. 依赖](#2-依赖)
- [4. 数据结构](#4-数据结构)
- [5. Code Review](#5-code-review)
- [6. Unit Testing](#6-unit-testing)
  - [6.1 validate message](#61-validate-message)
  - [6.2 check user](#62-check-user)
  - [6.3 request Cloud API](#63-request-cloud-api)

<!-- /TOC -->

# 1. 概述

当message.type === 'pip', 处理 message 数据结构；根据 urlPath 解析出Resource，调用本地 API 并将数据资源返回给 cloud

# 2. 依赖
=======
- [概述](#概述)
- [依赖](#依赖)
- [数据结构](#数据结构)
- [Code Review](#code-review)
- [Unit Testing](#unit-testing)
  - [validate message](#validate-message)
  - [check user](#check-user)
  - [request Cloud API](#request-cloud-api)

<!-- /TOC -->

# 概述

当message.type === 'pip', 处理 message 数据结构；根据 urlPath 解析出Resource，调用本地 API 并将数据资源返回给 cloud

# 依赖
>>>>>>> 921e5d886704e2d87900a4ed27c18aaa26355e13

- Fruitmix (Pipe 可能先于 fruitmix 实例化)
- cloudConf (auth, cloudToken, device)
- boot (boundUser)

<<<<<<< HEAD
# 4. 数据结构
=======
# 数据结构
>>>>>>> 921e5d886704e2d87900a4ed27c18aaa26355e13

message 数据结构定义

```js
{
  type: 'pip',
  msgId: '123456',     // message uuid
  packageParams: {
    sendingServer: '127.0.0.1', // 发送的服务器地址
    waitingServer: '127.0.0.1',  // 回复的服务器地址
    uid: '123456'      // phicommUserId
  },
  data: {
    verb: 'GET',       // req.method， ['GET', 'POST', 'PATCH', 'DELETE', 'PUT']
    urlPath: '/token', // 与本地 API 一致
    body: {},          // req.body
    params: {}         // req.params
  }
}
```

Pipe 数据结构定义

```js
{
  ctx: {
    fruitmix: () => fruitmix, // fruitmix 模块
    config: {
      auth: () => auth,       // auth 模块
      cloudToken,             // token for request cloud API
      device: {
        deviceSN: 'deviceSN'  // deviceSN
      }
    }
  }
}
```

<<<<<<< HEAD
# 5. Code Review
=======
# Code Review
>>>>>>> 921e5d886704e2d87900a4ed27c18aaa26355e13

1. error handling
2. jsdoc
3. 请求 cloud 返回的数据格式 (data)
4. eslint

<<<<<<< HEAD
# 6. Unit Testing

## 6.1 validate message
message 中 msgId, packageParams.waitingServer, packageParams.uid 缺一不可，否则无继续调用本地 API 以及无法 request cloud API； 若缺少其他参数， 则反馈给 cloud 的 error.status = 400

## 6.2 check user
=======
# Unit Testing

## validate message
message 中 msgId, packageParams.waitingServer, packageParams.uid 缺一不可，否则无继续调用本地 API 以及无法 request cloud API； 若缺少其他参数， 则反馈给 cloud 的 error.status = 400

## check user
>>>>>>> 921e5d886704e2d87900a4ed27c18aaa26355e13
通过 uid 获取 user
- fruitmix === null => user = boot.view().boundUser
- fruitmix 存在， user = fruitmix.getUserByPhicommUserId(uid), 若 user 不存在， 反馈给 cloud 的 error.status = 401

<<<<<<< HEAD
## 6.3 request Cloud API
=======
## request Cloud API
>>>>>>> 921e5d886704e2d87900a4ed27c18aaa26355e13
- token 校验
- 正确请求 httpCode = 200
- 错误请求 httpCode != 200











