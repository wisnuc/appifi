# Overview

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


# MKDIR

参数：
+ `name` dir name, such as hello
+ `body` object

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

# One Shot

+ 目标不存在，所有合法policy成功，resolved [false, false]
+ 目标存在同名文件夹，same生效
  + same === null，failed，EEXIST
  + same === skip，success，resolved [true, false] name不变，uuid不变
  + same === replace, success, resolved [true, false] name不变，uuid变化
  + same === rename, success, resolved [true, false] name变化，新uuid，原文件夹不变
+ 目标存在同名文件，diff生效
  + diff === null, fail，EEXIST
  + diff === skip, success, resolved [true, false], name, 
  + diff === replace, success, resolved [true, false],  