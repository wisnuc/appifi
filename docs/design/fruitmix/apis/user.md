<!-- TOC -->

- [1. Overview](#1-overview)
- [2. Create User](#2-create-user)
- [3. Delete User](#3-delete-user)
- [4. Update User](#4-update-user)

<!-- /TOC -->

# 1. Overview

basic

full

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

# Perspective

1. 从api角度说，资源模块之间的关系也存在
2. 这部分spec属于集成测试的范畴

# 2. Create User

参数使用json格式

合法字段：

```json
{
  "username": "string", // required
  "password": "crypt string", //option
  "smbPassword": "crypt string", //option
  "phicommUserId": "number string", //required
}
```

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

# 3. Delete User

**测例**

+ 目标只有admin, admin账户无法删除　400
+ 目标有多个账户
  + admin删除非admin,成功
  + admin删除自己失败, 400
  + 非admin删除任意账户失败

共两个目标,4个测例

# 4. Update User

参数:

```json
{
  "username": "string",
  "status": "string", // enum ['ACTIVE', 'INACTIVE', 'DELETED']
}
```

或者

```json
{
  "password": "string",
  "smbPassword": "string",
  "encrypted": true //boolean
}
```

上述两种参数互斥, 不可同时修改

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
+ 非自己
