# xstat

## xattr

fruitmix使用Linux文件系统的Extended Attributes (`xattr`)存储文件的特征值（fingerprint）和uuid。

在最底层，检查文件属性的模块（lib/xstat.js）把xattr和文件的stat属性merge在一起返回给上层模块，merge在一起的对象称为xstat（extended stat）。

存储在文件系统的xattr使用`user:fruitmix`作为key，其value为json格式，定义如下：

**文件夹**
```json
{
  "ver": 1,
  "uuid": "uuid string"
}
```

**文件**
```json
{
  "ver": 1,
  "uuid": "uuid string",
  "magic": "JPEG",
  "hash": "fingerprint",
  "htime": 0,
}
```
`ver`是数据结构版本，目前为1。

文件或文件夹均具有`uuid`属性。

文件必须需有`magic`属性，它可以是一个integer（>=0）或string。
* 如果是整数，意味着fruitmix系统不支持该文件类型，不会为其建立索引，不会提取其in-file metadata
* 如果是字符串，它是该文件的magic type

`hash`是文件的特征值，使用hash而不是fingerprint作为属性名称是因为历史原因；

`htime`是开始计算文件特征值时的时间，xstat模块根据该时间判断特征值的有效性，包括更新特征值和读取特征值时。

`hash`和`htime`是可选属性，但必须成对出现。



