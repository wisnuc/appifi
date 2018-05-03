# 概述

mediamap在内存中维护所有的media metadata

# 数据结构

## Meta

Meta包含：

1. 与一个文件hash对应的magic和文件内metadata数据；
2. 具有该文件的vfs文件对象和box的blob对象；

换句话说，一个Meta对象维护了一个Metadata和文件/blob对象之间的关系；

```js
Meta {
  ctx: {},      // container
  key: "fingerprint",
  magic: "magic string",
  metadata: {}  // metadata
  boxes: [],    // array of boxes containing this media
  files: [],    // array of files (file object in VFS)
}
```

一个Meta具有如下静态和运行时状态：

|metadata|source|comment|state|
|--|--|--|--|
|yes|no|源文件被删除或载入后尚未发现对应源文件|Unbound|
|no|yes|源文件存在但尚未取出Metadata|NoMetadata(Pending/Running)|
|yes|yes|无信息缺失|Bound|

会导致Meta发生状态迁移的原因是源的增加和消失，包括`addFile`和`removeFile`；

注意Meta是集合类对象，`addFile`和`removeFile`可能导致Meta的创建和销毁；

对单例而言：

+ addFile
  + Unbound，增加源，进入Pending状态；
  + Pending，增加源
  + Running，增加源
  + Bound，增加源

+ removeFile
  + Unbound，n/a
  + Pending，删除源，可能迁移至Unbound状态；
  + Running
    + 如果当前worker正基于该源工作，放弃任务；
    + 删除源
    + 如果尚有其他源，启动worker，停留在该状态；
    + 如果没有其他源，迁移至Unbound状态；

对集合而言：

+ addFile
  + 如果找到对应Meta，调用单例的addFile方法
  + 如果没找到对应Meta，创建该Meta，Bound状态

+ removeFile，找到对应Meta，调用removeFile方法

其他事件

`fileNameUpdated`

调度

调度的目的是让Pending状态的Meta进入Running状态

模块问题：

1. 是否该为静态资源组合建立状态？
2. 状态机的代码形式奇怪。



