# xstat

version

## xattr

fruitmix支持两种内容容器，一种是虚拟盘（Virtual Drive），另外一种是群（box）。

fruitmix会为虚拟磁盘内的每个文件和文件夹分配一个UUID，对于文件，还会提取文件类型（magic），计算特征值（fingerprint）；这些信息存储在文件的扩展属性中（Extended Attributes），称为`xattr`。

存储在文件系统的xattr使用`user:fruitmix`作为key，其value为json格式，定义如下：

**文件夹**
```json
{
  "uuid": "uuid string"
}
```

**文件**
```json
{
  "uuid": "uuid string",
  "magic": "JPEG",
  "hash": "fingerprint",
  "time": 0,
}
```

```js
/* js object representation */
{
  // mandatory, must be valid V4 UUID string
  uuid: "d62bc065-233b-4ae4-82ec-969abdae87be",
  // mandatory, file magic or version number
  magic: "JPEG",
  // optional, 
  hash: "fingerprint", 
}
```







文件必须需有`magic`属性，它可以是一个整数（>=0）或字符串。

* 整数表示fruitmix对该文件类型不感兴趣，不会为其建立索引，也不会提取其文件内信息，例如exif；
* 字符串是该文件magic，当作枚举类型使用；

`hash`是文件的特征值，计算方式参见[fingerprint文档](fingerprint.md)。

`time`是开始计算文件特征值时的时间，xstat模块根据该时间判断特征值的有效性，包括更新特征值和读取特征值时；计算特征值的代码应该在计算前先读取文件的mtime，在计算完成后调用xstat模块提供的api更新hash时提供该时间戳。

`hash`和`time`是可选属性，但必须成对出现。

### 旧版本

在旧版本中xattr曾经包含过如下属性：

1. owner, writelist, readlist，用于权限检查；新版本中已经抛弃；
2. 0.9.4之前的版本，xattr具有`htime`属性而不是`time`，修改该属性名是为了区分hash是通过旧定义还是新定义。

这两部分的兼容代码都体现在xstat模块中`readXattr`代码内。

## xstat

xstat模块把`fs.stat`功能和上述`xattr`特性封装在一起，提供`readXstat`函数，读取`xstat`对象，该对象的格式如下：

**文件夹**
```javascript
{
  uuid: 'uuid string',
  type: 'directory',
  name: 'directory name',
  mtime: 0              // stat.mtime.getTime()
}
```

**文件**
```javascript
{
  uuid: 'uuid string',
  type: 'file',
  name: 'file name',
  mtime: 0,                 // stat.mtime.getTime()
  size: 12345,
  magic: 'JPEG' || 0,       // string or number
  hash: 'file fingerprint'  // optional
}
```






