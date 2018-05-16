<!-- TOC -->

- [1. Overview](#1-overview)
- [2. Create Drive](#2-create-drive)

<!-- /TOC -->

# 1. Overview

测试操作：

- create drive
- update drive
- delete drive
- get drive
- list drives

private drive 数据结构:
```js
{
    "uuid": "系统为每个盘分配一个uuid",
    "type": "private",
    "owner": "user uuid",
    "tag": "home"
}
```

public drive 数据结构:
```js
{
    "uuid": "系统为每个盘分配一个uuid",
    "type": "public",
    "writelist": ["user uuid"],
    "readlist": ["user uuid"],
    "label": "显示给用户的盘名称",
    "tag": ""
}
```
测试目标：
- 测试创建 drive
  - 测试只能创建 public drive
  - 测试非 admin 创建 public drive
  - 测试 admin 创建 public drive
  - 测试创建时 writelist 为 []
  - 测试创建时 label 为 null
- 测试更新 drive
  - 测试只能更新 public drive
  - 测试非 admin 更新 public drive
  - 测试 admin 更新 public drive
  - 测试更新时 writelist 为 []
  - 测试更新时 label 为 null
- 测试删除 drive
- 测试获取一个 drive
  - public drive
    - 测试获取时 user 不在 writelist
    - 测试获取时 user 在 writelist
  - private drive
    - 测试获取时 user 不是 owner
    - 测试获取时 user 是 owner
- 测试获取集合 drives
  - 测试非 admin 获取 drives
  - 测试 admin 获取 drives

# 2. Create Drive

仅管理员可以执行该操作

参数使用field格式：

- `writelist` - Array - 用户uuid的数组，表示哪些用户对此盘具有写权限
- `readlist` - Array - 暂未使用，该数组永远为空
- `label` - String - 显示的名称，也用于Samba显示

**测例**

- 测试只能创建 public drive
- 测试非 admin 创建 public drive
- 测试 admin 创建 public drive
- 测试创建时 writelist 为 []
- 测试创建时 label 为 null




