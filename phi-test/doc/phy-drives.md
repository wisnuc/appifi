<!-- TOC -->

- [1. 概述](#1-概述)
- [2. 依赖](#2-依赖)
- [3. 参数](#3-参数)
  - [3.1. id](#31-id)
    - [3.1.1. 测试](#311-测试)
  - [3.2. path](#32-path)
- [4. 获取物理盘列表](#4-获取物理盘列表)
  - [4.1. 测试](#41-测试)
- [5. 获取文件或文件夹](#5-获取文件或文件夹)
  - [5.1. 测试](#51-测试)
- [6. 创建文件夹或文件](#6-创建文件夹或文件)
  - [6.1. 测试](#61-测试)
    - [6.1.1. qs path](#611-qs-path)
    - [6.1.2. prelude path](#612-prelude-path)
- [7. 重命名](#7-重命名)
- [8. 删除](#8-删除)
  - [8.1. 测试](#81-测试)

<!-- /TOC -->

# 1. 概述

`phy-drives`接口在系统内部由nfs模块提供；nfs代表native file system，与fruitmix fs的名称对应。

# 2. 依赖

`phy-drives`是storage数据流的观察者，同时需要外部注入boundVolume的uuid。

在测试时，被测单元包含fruitmix，nfs由fruitmix构造和注入boundVolume uuid，fruitmix自己则需要boundVolume数据结构。

# 3. 参数

## 3.1. id

+ 未发现drive，返回404

### 3.1.1. 测试

```js
const invalidIds = ['hello', boundVolume.uuid]
```

## 3.2. path

path是字符串，值是一个相对路径，格式是以'/'分割的合法文件夹和文件名

+ 合法文件夹和文件名满足sanitize检查
+ '/'不得作为开头和结尾字符，也不允许连续出现多个
+ 如果指定根文件夹，使用空字符串或不提供path
+ path允许不提供，不提供解释为''

+ 如果提供path，但path不是字符串，或者不是合法字符串，返回400
+ 如果提供的path不符合具体的api要求，返回403

```js
const invalidPaths = [
  '*',            // sanitize
  '/hello',       // leading slash
  'hello/',       // trailing slash
  'hello//world', // successive slash
]
```
# 4. 获取物理盘列表

该API为只读API，返回结果取决于系统内部存储设备状态和访问规则。

## 4.1. 测试



# 5. 获取文件或文件夹

参数：

+ id: 
+ path: 路径

返回

+ 如果路径是文件夹，返回文件夹内容（direntry）；
+ 如果路径是文件，返回文件内容；
+ 如果drive不存在，返回404；
+ 如果路径非法，返回400；
+ 如果路径存在但不是文件夹或者文件，返回403, EUNSUPPORTED；
+ 如果路径不存在，返回404，ENOENT/ENOTDIR

## 5.1. 测试

+ id red
+ path red
  + invalid name
  + non-existent
    + hello on /
    + hello/world on /hello (dir)
    + hello/world on /hello (file)
  + path is symlink
+ path green
  + file
  + directory
    + empty directory
    + has file, directory, symlink

# 6. 创建文件夹或文件

该接口可以支持创建新文件夹和上传文件，使用multipart/form-data；

**参数**

请求参数包括id/path；id/path指定的目标必须为文件夹；在使用prelude的时候path从prelude传递；

prelude body是JSON对象，包含path属性；

directory part，name为`directory`，body包含的字符串为新建文件夹名称。

file part，name为`file`，filename包含的字符串为新建文件名称，body为新建文件内容，可以为空。

## 6.1. 测试

该api支持两种工作模式：通过query string和通过prelude提供path参数，该不同会导致API的执行序有差异。所以我们把SPEC空间分开描述，其中可能有重复测试。

part/op部分为手工代码，只能pick one。未来需要实现agent test，测试组合。

### 6.1.1. qs path

+ id red (hello, uuid)
+ id green (uuidde)
  + path red 
    + invalid name, 
    + non-existent 
      + hello on /
      + hello/world on /hello (dir)
      + hello/world on /hello (file)
    + not a directory
      + hello on /hello (file)
      + hello/world on /hello/world (file)
  + path green (empty string, existent hello)
    + part red
      + 400 invalid part name
      + 400 invalid dir name
      + 400 invalid file name
    + part green
      + 200 file, no conflict
        + hello on /
        + world on /hello
      + 200 directory no conflict
        + hello on /
        + world on /hello
      + file/directory name conflict
        + 403 new file hello on / if /hello is file EEXIST
        + 403 new file hello on / if /hello is directory EISDIR
        + 403 new file hello on / if /hello os symlink EISSYMLINK
        + 403 new file world on /hello if /hello/world is file EEXIST
        + 403 new file world on /hello if /hello/world is directory EISDIR
        + 403 new file world on /hello if /hello/world is symlink EISSYMLINK
        + 200 new directory hello on / if /hello is directory 
        + 200 new directory world on /hello if /hello/world is directory
        + 403 new directory hello on / if /hello is file EISFILE
        + 403 new directory world on /hello if /hello/world is file EISFILE
        + 403 new directory hello on / if /hello is symlink EISSYMLINK
        + 403 new directory world on /hello if /hello/world is symlink EISSYMLINK        

### 6.1.2. prelude path

+ id red
+ id green (uuidde)
  + first part
    + first part is not prelude 
      + bad name
      + directory
      + file
    + first part is valid prelude
      + path red, invalid name
        + 400 [] invalide names
      + path red, non-existent target
        + 403 if path hello on /
        + 403 if path hello/world on /hello (dir)
        + 403 if path hello/world on /hello (file)
      + path red, target is file
        + 403 if path is hello on /hello (file)
        + 403 if path is hello/world on /hello/world (file)
      + path green
        + 200 if prelude is {}
        + 200 if prelude is { path: '' }
        + 200 if prelude is { path: 'hello' }
  + second part
    + red, second part is invalid
      + 400 bad name
      + 400 prelude
      + 400 invalid dir name
      + 400 invalid file name
    + green, no name conflict
      + 200 file, no conflict
        + hello on /
        + world on /hello
      + 200 directory no conflict
        + hello on /
        + world on /hello
    + red, name conflict
      + 403 new file hello on / if /hello is file EEXIST
      + 403 new file hello on / if /hello is directory EISDIR
      + 403 new file hello on / if /hello os symlink EISSYMLINK
      + 403 new file world on /hello if /hello/world is file EEXIST
      + 403 new file world on /hello if /hello/world is directory EISDIR
      + 403 new file world on /hello if /hello/world is symlink EISSYMLINK
      + 200 new directory hello on / if /hello is directory 
      + 200 new directory world on /hello if /hello/world is directory
      + 403 new directory hello on / if /hello is file EISFILE
      + 403 new directory world on /hello if /hello/world is file EISFILE
      + 403 new directory hello on / if /hello is symlink EISSYMLINK
      + 403 new directory world on /hello if /hello/world is symlink EISSYMLINK   



# 7. 重命名

目标可以为文件、文件夹、不支持的类型

该api仅能够完成在一个盘内的重命名和移动情况，不能处理跨物理盘的移动。后者应该通过xcopy模块实现。

**参数**

oldPath, newPath

```
{
  oldPath: 'path string',
  newPath: 'path string'
}
```

**返回**



# 8. 删除

path可以为文件、文件夹、不支持的类型。

path必须提供且不得为空。

**参数**

id, path

**返回**

200 成功
404 id not found
400 path invalid, path not provided or emtpy
403 ENOTDIR 
500 其他错误

## 8.1. 测试

+ 非法
  + 非法id 404
  + 非法path 400
  + path为空 400
  + path未提供 400

+ 成功 200
  + delete /hello on /
  + delete /hello on /hello
  + delete /hello/world on /
  + delete /hello/world on /hello
  + delete /hello/world on /hello/world

+ 路径错误 403
  + delete /hello/world on /hello (file)




