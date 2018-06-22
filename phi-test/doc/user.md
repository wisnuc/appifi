<!-- TOC -->

- [1. 概述](#1-概述)
- [2. 依赖](#2-依赖)
- [3. 参数](#3-参数)
- [4. 创建新用户](#4-创建新用户)
  - [4.1. 测试](#41-测试)
- [5. 获取用户信息](#5-获取用户信息)
- [6. 修改用户信息](#6-修改用户信息)
  - [6.1. 测试](#61-测试)
- [7. 获取用户列表](#7-获取用户列表)

<!-- /TOC -->

# 1. 概述
`users`接口， 对外开放

测试操作

+ create user
+ update user
+ delete user

测试目标
+ 测试创建用户参数组合
  + 测试创建admin
  + 测试创建非admin
  + 测试创建时权限
+ 测试删除用户状态变化
  + 测试删除用户权限
+ 测试更新用户权限检查
+ 测试更新用户参数组合
  + 测试更新用户非password/smbPassword参数组合
  + 测试password/smbPassword参数组合
  + 测试混合参数

1. 从api角度说，资源模块之间的关系也存在
2. 这部分spec属于集成测试的范畴

# 2. 依赖
？？？

# 3. 参数
uuid

Fruitmix系统为每个用户自动分配一个本地标识；使用version 4 UUID格式，a-f字符必须为小写。

username

用于显示的用户名，目前缺乏详细的功能和合法性定义。

字符串，最大长度不超过256字符（Unicode），不支持不可打印字符，包括回车，但允许空格。

password

用户的离线密码，以bcrypt格式密文存储，salt长度10；该属性不会提供给客户端。

smbPassword

md4格式的密文，按照phicomm设计，该密码不与password同步；该属性不会提供给客户端。

lastChangeTime

该字段为最后一次修改samba密码的时间，是smb服务需要的。

isFirstUser

布尔类型；仅第一个用户该值为true，表示它是系统内权限最高的管理员；其他所有用户该值为false。

createTime

自然数（含0），本地用户的创建时间。

status

字符串/枚举类型，表示用户的状态。合法值包括ACTIVE，INACTIVE，和DELETED；其中ACTIVE和INACTIVE的用户会向客户端返回；DELETED用户仅系统内部使用，不会返回给客户端。

phicommUserId

该本地用户绑定的斐讯用户Id。

phoneNumber

该本地用户绑定的手机号

# 4. 创建新用户
仅管理员可以访问该操作，需提供：

```json
{
  "username": "string", // required
  "password": "crypt string", //option
  "smbPassword": "crypt string", //option
  "phicommUserId": "number string", //required
}
```

## 4.1. 测试

name
status: active/inactive/deleted

InvalidPhicommUserId [undefined, null, {}, [], 'hello', 'number out of range']
InvalidNames [undefined, null, {}, [], 'invalid']

+ permission (只有admin可以) red [anonymous, bob], green [alice]
  + phicommUserId (格式fei法，值冲突) red [par], existing active 403, inactive 403, green [=deletedUser, no conflict]
    + username （格式fei法，值冲突）red [par], existing active 403, inactive 403, green [=deletedUser, no conflict]
      + success

f(createUser)(a, b) => (c, d)
```
c1 200 {}
c2 400 {}
c3 403 {}
```

```
a
d
```

f


**测例**

+ 目标无用户,无token创建firstuser,isFirstUser === true
+ 目标无用户,创建用户传输非法字段,返回400错误
+ 目标已有用户,admin token创建合法用户,isFirstUser === undefined
+ 目标已有用户,非admin token创建合法用户,返回403
+ 目标已有用户,admin token创建用户带非法字段,返回400

目标状态:
+ 无用户
+ 有单一admin
+ 有多用户

权限参数:
+ 无token
+ admin token
+ 非admin token

内容参数:
+ 合法
  + 只含有required字段
  + required字段加option字段
+ 非法

共27个测例

KVM: no stock
KVM: no stock
KVM: no stock
KVM: no stock
+ 目标只有admin, admin账户无法删除　400
+ 目标有多个账户
  + admin删除非admin,成功
  + admin删除自己失败, 400
  + 非admin删除任意账户失败

共两个目标,4个测例

# 5. 获取用户信息

# 6. 修改用户信息
参数:

```json
{
  "username": "string",
  "sKVM: no stock ['ACTIVE', 'INACTIVE', 'DELETED']
}
```

或者KVM: no stock

```json
{
  "password": "string",
  "smbPassword": "string",
  "encrypted": true //boolean
}
```

上述两种参数互斥, 不可同时修改

## 6.1. 测试

**测例**

操作用户:
+ admin
+ 非admin

参数:
+ 合法
  + 修改password
  + 修改非password
    + 当前status !== "DELETED"
    + 当前status === "DELETED"
+ 不合法
  + 两种参数混合
  + 含有其他非法字段
  + 非admin修改status字段
  + admin修改status === "DELETED"用户

待修改用户:
+ 自己
KVM: no stock
KVM: no stock
KVM: no stock
KVM: no stock
KVM: no stock

# 7. 获取用户列表



