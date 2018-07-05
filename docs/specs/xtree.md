<!-- TOC -->

- [1. Overview](#1-overview)
- [2. Data structures & Algorithms](#2-data-structures--algorithms)
  - [2.1. fstree](#21-fstree)
  - [2.2. xtree](#22-xtree)
    - [2.2.1. xcopy node](#221-xcopy-node)
    - [2.2.2. policy node](#222-policy-node)
    - [2.2.3. xtree](#223-xtree)
  - [2.3. Expansion](#23-expansion)
    - [2.3.1. 初始化](#231-初始化)
    - [2.3.2. recursive expandsion](#232-recursive-expandsion)
    - [2.3.3. 操作类型](#233-操作类型)
    - [2.3.4. Non-Conflict Xcopy Node](#234-non-conflict-xcopy-node)
    - [2.3.5. Conflict Xcopy Node](#235-conflict-xcopy-node)
    - [2.3.6. Policy Node](#236-policy-node)
  - [2.4. Reduction](#24-reduction)
    - [2.4.1. apply-to-all](#241-apply-to-all)
  - [2.5. Extraction](#25-extraction)

<!-- /TOC -->

# 1. Overview

`xtree`是xcopy模块的一个形式化定义，它定义了在无干扰情况下的xcopy行为状态。

无干扰指的是在xcopy任务开始之后，没有以下情况：

1. 用户的访问权限变更导致的文件或文件夹操作失败；
2. 源文件树和目标文件树被用户的并发操作改变；
3. 文件系统变化，例如USB盘被用户拔除；

`xtree`描述的数据结构可以用于批量生成测试用例，通过自动化测试实现测试的完整性。

`xtree`与服务器的实现是否具有确定性无关；但是具有确定性的设计比不具有确定性的设计在测试上方便，应优先完成具有确定性的设计。

# 2. Data structures & Algorithms

## 2.1. fstree

我们用fstree表述一个用于描述文件系统结构的数据结构，它由node构成，包括dir node和file node；dir node可以具有children，表述文件夹的层级结构；dir node的children只能是file node或者dir node。

文件夹节点
```js
{
  type: 'directory',
  name: 'dir name',
  children: []
}
```

文件节点
```js
{
  type: 'file',
  name: 'file name',
  //用于测试时可包含其他文件属性，例如hash
}
```

## 2.2. xtree

xtree包含两种节点，xcopy node或者policy node。

### 2.2.1. xcopy node

xcopy node用于表述一次xcopy操作的结果，或者遇到冲突的状态；xcopy node具有递归结构（top-down）。

一个xcopy node包含st和dt属性，分别表示source tree和destination tree，st和dt都是fstree结构，也都可以是null。

```js
// xcopy node 
{
  st: 'source tree', 
  dt: 'destination tree',
  children: []
}
```

注意st和dt本身也是一个fs tree上的node。

Definition 1: 如果一个fs node的`st.name === dt.name`，称该节点为冲突节点。

如果xcopy node不是冲突节点，它的children仍然是xcopy node，分别表述该xcopy node的st的children的操作结果；如果xcopy node是冲突节点，它的children是policy node。

### 2.2.2. policy node

policy node的格式如下：

```js
{
  policy: [same, diff],
  children: [] 
}
```

policy node的children仅包含1个成员，是policy node的parent node应用policy之后的结果。

### 2.2.3. xtree

由xcopy node和policy node构成的tree，称为xtree。从初始化条件开始展开完整的xtree是一个pure function，这个过程称为expansion。

## 2.3. Expansion

### 2.3.1. 初始化

初始化的参数是一个st和一个dt对象，分别表述源文件夹和目标文件夹。

作为算法测试，初始化的状态并不看作是一个特殊状态。它被看作是一个conflict节点应用了keep策略的状态。

> 在实际代码中，允许用户选择src文件夹内的部分文件或子文件夹进行操作，在算法测试上这一点没有意义。

在这个模型下，创建的第一个xcopy节点可以如下描述：

```js
// the first xcopy node
{
  st: {
    type: 'directory',
    name: '',
    children: []
  },
  dt: {
    type: 'directory',
    name: '',
    children: []
  }
}
```

其中st和dt的name都初始化成空字符串，这样该节点满足冲突的定义；当expand函数应用到该节点上时，它会产生第一个child，且仅应用keep策略：

```js
{
  st: // ...
  dt: // ...
  children: [
    { // the first policy node
      parent: // reference to parent xcopy node
      policy: ['keep', null],
      children: [...]
    }
  ]
}
```

### 2.3.2. recursive expandsion

上一节里创建第一个xcopy节点之后，产生第一个policy节点的过程可以看作一个expansion的过程。

我们假定存在一个expand函数，它既可以应用到xcopy节点上，也可以应用到policy节点上，那么很显然，只要这个expand函数递归式的往子节点上应用，即可以expand整个tree。


### 2.3.3. 操作类型

expansion过程包含两种操作的类型：copy or move。

### 2.3.4. Non-Conflict Xcopy Node

对于无冲突的Xcopy Node，在expand之前：

- st是non-null fs tree (node)
- dt是null

对于copy操作，expand之后

- st不变
- dt = st

对于move操作，expand之后

- dt = st
- st = null

### 2.3.5. Conflict Xcopy Node

对于有冲突的xcopy node，expand函数产生一组能够resolve这个冲突的policy。

|type|src|dst|policies|
|-|-|-|-|
|copy|dir|dir|same: keep, skip, replace, rename|
|copy|file|file|same: skip, replace, rename|
|copy|dir|file|diff: skip, replace, rename|
|copy|file|dir|diff: skip, replace, rename|
|move|dir|dir|same: keep, skip, replace, rename|
|move|file|file|same: skip, replace, rename|
|move|dir|file|diff: skip, replace, rename|
|move|file|dir|diff: skip, replace, rename|

从上表中可以看出，仅仅对于policy而言，不考虑操作的结果，可以合并如下：

|type|src/dst|policies|
|-|-|-|
|copy/move|dir/dir (root)|same: keep|
|copy/move|dir/dir|same: keep, skip, replace, rename|
|copy/move|file/file|same: skip, replace, rename|
|copy/move|dir/file or file/dir|diff: skip, replace, rename|

### 2.3.6. Policy Node

当expand函数应用到Policy Node时，会产生policy node的唯一child，此时expansion的逻辑与policy和policy node的parent xcopy node节点均有关：

```
f(p.policy, p.parent) where p is the policy node
```

**same, keep**

(TBD)

**same, skip**

(TBD)

**same, replace**

(TBD)

**same, rename**

(TBD)

**diff, skip**

(TBD)

**diff, replace**

(TBD)

**diff, rename**

(TBD)

## 2.4. Reduction

在应用了上述expansion逻辑后，通过递归，xtree的root节点展开成完整的tree。

我们可以把未遇到冲突或者解决了冲突的xcopy node考虑成white node，把遇到冲突的xcopy节点考虑成red node，把policy node考虑成black node。

定义：如果一个red node，它的所有的ancestor都是white node，称该node是reducible node。

定义：选择一个reducible node，在它的children（policy node）中，选择一个policy node，用该policy node的唯一child替换reducible node，该操作称为reduce。

xtree的第一个reducible node是root node；经过第一次的reduce操作后，可能有其他的red node节点成为reducible node。这个过程迭代进行，直到xtree上没有red node（此时也不会有black node），此时得到的xtree，就是一次xcopy任务的结果。其中每一次reduce操作，相当于一次policy设置。

### 2.4.1. apply-to-all

apply-to-all是一个动态操作；它和xtree无关。

该操作解释成：apply-to-all并不是在reduce具体某一个red node，而是同时reduce所有可以用该policy reduce的全部red node；

注意它不是只影响reducible节点，作为一个全局设置，当一个非reducible节点成为reducible节点时，如果全局策略生效，它也被自动reduce。

## 2.5. Extraction

Extraction是从xtree开始，抽取所有可能的reduction过程的过程。

假定xtree的3中颜色的node都可以标注一个数字。从leaf node开始。

首先把所有的leaf node都标注为1。

parent node有这样几种情况：

1. xcopy node包含xcopy node，此时parent node的数字是所有children的数字的乘积（无关事件，使用multiplication rule）；
2. policy node有唯一的white node作为其child，policy node的数字就是white node的数字；
3. red node （conflict node）包含black node（policy node），policy之间是互斥关系，所以应用addtion rule，即每个red node的数值是它所有children的数字之和；

经过这样的计算之后root node的数字就是全部可能的Reduction结果数量。









