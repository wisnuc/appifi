# 概述

nfs代表native file system。

nfs模块是一个轻量级模块。它只在内存中维护一个用户可访问的文件系统的列表，且无持久化要求。

nfs内部维护的文件系统对象称为drive，服务PhyDrives资源。

nfs的数据来源是fruitmix外部的storage；侦听和注入该数据的责任属于fruitmix，NFS不需要自己侦听storage；

# 依赖

+ user



