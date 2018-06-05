# 概述

`IncomingForm`处理fruitmix文件上传（writedir）时的formdata：

+ 使用私有传输协议
+ 支持并发处理
+ 支持顺序依赖
+ 强制传输数据的校验

`IncomingForm`内部使用两个类来实现功能，一个是dicer，另一个是party。

# 依赖

`IncomingForm`依赖一组api，该组api由vfs提供，通过`DirEntryApi`组件bound后交给`IncomingForm`使用。

# Party

从外部看，`Party`类似一个对象模式下的`stream.Writable`，它负责接受和处理`part`，可以emit `error`和`finish`事件，在`finish`时通过自身属性返回结果。

但Node提供的`stream.Writable`是顺序处理逻辑，其错误处理方式只能通过`write`方法的`callback`实现，这给错误处理带来困难，发生错误时只能内部记录，等到下一个`write`或`final`调用时，利用其`callback`抛出错误；对于大文件传输来说，这会显著推迟抛出错误的时间。

所以`Party`采用了自己实现的方式。其接口类似`Writable`，提供`write`, `end`和`destroy`方法；但它不是`Writable`，不能用于pipe。


# Job

`Party`内部维护一个`Job`队列，每个`Job`采用状态机实现；

`Job`经历如下状态：

+ heading, 在等待part header
+ parsing, 仅field job，在等待part body
+ piping, 仅file job，在传输part body到临时文件
+ pending, 在等待前置任务完成
+ executing，调用api，执行该任务
+ failed, 失败
+ succeeded, 成功

在heading状态下，任务描述`ctx.args`是一个空对象；



