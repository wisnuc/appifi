本文档描述xcopy模块的设计。

<!-- TOC -->

- [1. Overview](#1-overview)
- [2. xdir状态设计](#2-xdir状态设计)
  - [2.1. Mkdir/Mvdir](#21-mkdirmvdir)
  - [2.2. Conflict](#22-conflict)
  - [2.3. Preparing](#23-preparing)
  - [2.4. Parent](#24-parent)
  - [2.5. Failed & Finish](#25-failed--finish)
- [3. xfile状态设计](#3-xfile状态设计)
  - [3.1. Working](#31-working)
  - [3.2. Conflict](#32-conflict)
  - [3.3. Failed & Finish](#33-failed--finish)
- [4. 行为多态](#4-行为多态)
  - [4.1. copy文件](#41-copy文件)
  - [4.2. move文件](#42-move文件)
  - [4.3. copy文件夹](#43-copy文件夹)
  - [4.4. move文件夹](#44-move文件夹)
    - [4.4.1. rename方式](#441-rename方式)
    - [4.4.2. copy + remove方式](#442-copy--remove方式)

<!-- /TOC -->

# 1. Overview

xcopy支持10种操作，其中8种基础操作和2种组合操作。

在基础操作中，xcopy把源文件夹内的一组文件或子文件夹，复制或移动到目标文件夹内；包括：

1. copy/move, src和dst均为vfs文件夹
2. icopy/imove, src为nfs文件夹，dst为vfs文件夹
3. ecopy/emove，src为vfs文件夹，dst为nfs文件夹
4. ncopy/nmove，src和dst均为nfs文件夹，可能位于相同或不同的文件系统

在组合操作中，xcopy把位于vfs中的一组文件或文件夹（可以位于不同的源文件夹），复制或移动到目标文件夹内；包括：

1. sink，目标文件夹位于vfs
2. nsink，目标文件夹位于nfs

组合操作会产生一个job queue，每个job是一个xcopy基础操作，job按照先后顺序执行。

每个job可以是copy/move，或者ecopy/emove，但不会是icopy/imove或ncopy/nmove。

---

# 2. xdir状态设计

## 2.1. Mkdir/Mvdir

该状态为创建（copy）或移动（move）一个文件夹。

该状态为初始状态之一。

## 2.2. Conflict

遇到name conflict

## 2.3. Preparing

该状态读取源文件夹内的全部内容，并试图批量创建或移动其中的子文件夹到目标文件夹。

该状态为初始状态之一。

在工作完成后，该状态具有三个集合：

1. 已经成功创建或移动至目标文件夹的子文件夹集合，以stats表述；
2. 在创建或移动过程中发生冲突的子文件夹集合，以stats表述；
2. 源文件夹中的文件集合，以stats表述；

## 2.4. Parent

在Parent状态中，xdir除生命周期方法外无其他行为责任。

从Preparing进入Parent状态时：

1. 在Preparing状态下批量创建失败的子文件夹，会创建xdir对象成为任务树的子节点，初始化为Conflict状态；
2. 已经成功创建或移动至目标文件夹的子文件夹集合保存为dstats成员；
3. 尚未复制或移动的文件集合，保存为fstats成员；

用户操作负责更新Conflice状态的子节点状态；全局调度器负责从dstats/fstats队列提取数据创建子节点（lazy）。

## 2.5. Failed & Finish

失败或成功的结束


# 3. xfile状态设计

## 3.1. Working

复制或移动一个文件

## 3.2. Conflict

遇到命名冲突

## 3.3. Failed & Finish

失败或成功结束

# 4. 行为多态

## 4.1. copy文件

责任属于`xfile`的`Working`状态。

对于文件的`copy`操作，基于btrfs clone特性实现；

> 对于nfs上的copy也可以尝试用reflink方式；

copy文件不会产生子任务。

## 4.2. move文件

责任属于`xfile`的`working`状态。

当源文件和目标文件位于同一个文件系统时，可以使用rename；否则只能使用先copy再删除源文件的逻辑完成。

能够使用rename优化的情况包括：

1. vfs to vfs move
2. nmove时，源文件和目标文件位于同一个文件系统（nfs drive）

`skip`策略对move文件的结果有影响，如果`skip`生效，则源文件不被删除。

move文件不会产生子任务。

## 4.3. copy文件夹

copy文件夹是先创建一个目标文件夹，然后递归copy源文件夹内的子文件夹和文件的过程。

`skip`策略对copy文件夹是否产生子任务有影响。如果`skip`生效，则不会产生子任务。

1. Preparing -> Parent，应drop所有`skip`生效的情况。
2. Conflict -> Mkdir成功时，应在`skip`生效的情况下，直接迁移到`Finish`而不是`Parent`。

copy文件夹不会对源文件夹产生影响。

## 4.4. move文件夹

和move文件类似，move文件夹在vfs to vfs move和nmove时如果源文件夹与目标文件夹位于同一个文件系统时，可采用rename逻辑；否则使用先copy再remove的逻辑。

### 4.4.1. rename方式

在可以使用rename方式时，move不产生子任务，除了`keep`策略生效的情况。这意味着：

1. 在xdir从Preparing->Parent时，same策略为keep时，成功的文件夹会传入Parent，否则抛弃；
2. 在xdir从Conflict->Mkdir/Mvdir后，操作成功时，如果same策略为keep且生效，该xdir进入Parent状态，否则迁入finish。

`skip`策略对move文件操作的结果有影响，如果`skip`策略成功，源文件夹不会被删除，在rename方式下，没有额外的代码负担。

### 4.4.2. copy + remove方式

在使用该方式时，move退化成了copy操作，除非`skip`策略生效，否则将产生子任务。逻辑与copy文件夹一致：

1. Preparing -> Parent，应drop所有`skip`生效的情况。
2. Conflict -> Mkdir成功时，应在`skip`生效的情况下，直接迁移到`Finish`而不是`Parent`。

remove操作在文件夹结束时发生，注意不应使用rimraf操作，应代之以rmdir命令，该命令无法移除非空文件夹。


