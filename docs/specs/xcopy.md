# XCOPY

# XCOPY interface

# 行为

1. 创建任务
2. 获取任务状态
3. 解决冲突


1. 复制或移动
2. 命名冲突
3. 取消
4. 暂停和恢复
5. 错误
6. 统计

XCOPY的基础任务类型包括8种，其中4种copy，4种move；

4种move中在vfs上的move和在nfs上同一物理文件系统上的move是用fs.rename实现的；其余是用copy + rename操作实现的。 

在客户端角度看，XCOPY的状态表述是无穷的，因为文件系统的递归结构所致。

输入参数

1. source tree (st)
2. destination tree (dt)


step 1

linearize in previsit mode, predict first conflict

step 2

pick one policy (including options)

the policy may:

1. resolve the current conflict but have no future impact
2. resolve the current conflict and have future impact
3. (bypass) not resolve the current conflict but have future impact
4. (bypass) have no effect at all  

the last one can be tested randomly, like a nop (or no-op) command

step 3

go to step 1 and repeat, until the task finished.

This algorithm has no assertion on disk file after each step.

This algorithm is not used to test directly. Instead, it generates a list of steps for a bunch of tests for given st and dt.

---

1. init st, dt
2. predict next conflict (who)
3. pick (and apply) a policy


st0, dt0


























