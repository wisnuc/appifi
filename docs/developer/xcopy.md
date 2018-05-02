# xcopy

`xcopy` module provides the functionality of copying/moving a collection of files and directories from a source directory to a destination directory.



## Create Xcopy Task

The client provides the following parameter to create a `xcopy` task on the server:

+ `mode`, indicating the operation mode of the task. Mode can be `copy`, `move`, `import`, or `export`. 

  + for `copy` and `move`, both source and destination directories are located in frutit fs.
  + for `import`, the source directory is located in fruit fs, and the destination directory is in native file system. vice versa for `export`. Both of them are copy operation. No move function implemented.

+ `src` and `dst` are objects containing the location of source and destination directory.

  + the object contains two properties, `drive` and `src`

    ```javascript
    {
      drive: 'string',
      dir: 'string'
    }
    ```

  + when located in fruit fs, both `drive` and `dir` are UUID string.

  + when located in native fs,

    +  `drive` is the unix block device name (representing the block device containing the file system) , such as sda1
    +  `dir` is a path **relative** to the mount point of the block device (so it must NOT start with `/`)

+ `entries` includes an array of designated files or directories to be copied or moved (aka in the source directory)

  + when source directory is located in fruit fs, entries is an array of UUID string.
  + when source directory is located in native fs (for `import`), entries is an array of name string.

+ `policies`, the global name conflict resolution policy used in this task.

  + policies is an object containing two optional properties: `dir` and `file`.

    ```javascript
    {
        dir: [],
        file: []
    }
    ```

  + policies can be null or `{}` if no policies are set at the beginning.
  + see below for detailed explanation for `policy`.




## Name Conflict and Resolution Policy

xcopy provides the following policy to resolve name conflict:

1. `null`, no policy. The sub-task enters conflict state when there is a target having the same name with source.
2. `skip`, target is intact. If source and target are directories, xcopy won't continue to copy/move contents inside source directory.
3. `merge`, only applicable when both source and target are directories. The target is intact, but xcopy will continue to copy/move contents inside source directory.
4. `replace`, remove target and continue copy/move operation.
5. `rename`, automatically allocate a new name.

### Policy Object

A policy object is a 2-tuple of names listed above. It is represented by an array, like `[null, 'skip']` in code. The first one applies when target has the same type with source. The latter one applies when target has a different type from source. Generally we denote a policy object as `[same, diff]`, where same and diff can be `null`, `skip`, `replace`, and `rename`. `merge` works only when source is a directory and can only be the `same` policy.



### Global and Local

Each sub-task has its own policy object, initialized as `[null, null]`. There is also a global policy for the whole task, which can be set at the beginning, or is updated during operation.



When a sub-task is scheduled to work and encounters a name conflict, it first examines it's local policy, and if it is unset, it tries the global policy. In either case, if there is a policy, the conflict should be resolved and it returns with a success.



### Init and Update Policies

The global policies can be set at the beginning.



When a sub-task enters conflict state, the client can update it's policy. 



The update takes the `merge` policy. A non-null value can overwrite a null value or a non-null value, but a null value can NOT remove an existing non-null value.



When updating a a single conflict sub-task, the client can also provide an optional boolean parameter: `applyToAll`. If set, the corresponding global policy will also be updated.



When the policy of a conflict sub-task is updated, it will enter working state again and the new policy applies.

















xcopy是包含层级结构对象的组合状态机。



xcopy操作分为copy，move，import和export四种类型。



用户操作包括：

1. 创建xcopy任务
2. 销毁任务
3. 更新节点或节点和全局冲突设置（两者可以独立实现但客户端使用该策略）
4. 重试




冲突状态

遇到名称冲突的节点会进入冲突状态



策略





错误

1. 执行错误
2. 执行错误可能隐含结构性错误或其可能性
   1. 权限错误，因为权限错误是顶级容器错误，它会直接导致整个任务失败。不应重试。
   2. 源文件路径错误
      1. 应立刻同步检查源文件系统，最终导致某个文件夹或文件节点发生错误；如果是文件夹，其子文件夹和文件全部销毁；
   3. 目标文件路径错误
      1. 处理方式同2，但检查的是目标文件系统




错误处理的测试需详细定义，根据定义逐一测试；错误可以使用sinon模拟；结构性和上下文错误应该在冲突状态下模拟。





## 单元测试

### 1. 单例








