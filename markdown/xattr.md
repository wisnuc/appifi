# Extended Attribute

Fruitmix uses Linux file system's Extended Attribute feature to store Fruitmix specific data for files and folders.

All files and folders in `Universe` has an extended attribute named: `user.fruitmix`, but the root folder itself does not necessarily have this data.

`xattr` is a JavaScript library for reading and writing extended attribute data for files and folders. We also use this term to refer to the extended attribute data.

# Extended Attribute Data

There are possibly five or six properties in `xattr` for folders and files, depending on if it is stored on disk, or loaded into memory as an JavaScript object.

When it is stored on disk, it is transformed to JSON format and has an extra property named `htime`. When loaded as program internal state, such data are merged into an `fs.Stats` object with `htime` property dropped (an object named as `xstat`, see blow), since it is not used by upper layer.

```
# example xattr, in JavaScript format, they are actually stored in JSON format

{
  uuid: UUID.v4(),
  owner: [],
  writelist: [],
  readlist: [],
  hash: (SHA256 string),
  magic: (file magic string),
  htime: (a number), // only used in xstat layer and stored in disk
}
```

* `uuid`: string, UUID, version 4, required
* `owner`: uuid array, required, may be empty
* `writelist`: uuid array, or `undefined`, may be empty array
* `readlist`: uuid array, or `undefined`, may be empty array
* `hash`: SHA256 digest, or `undefined`, for file; `undefined` for folder
* `htime`: hash time, epoch time integer, or `undefined` if not computed yet, for file. Reader can compare this with mtime to determine if hash is outdated. undefined for folder. `undefined` for folder.

Notice that owner property has different interpretation for non-root and root node. For non-root node, it is interpreted as **creator**. For root node, owner means who can change the writelist and readlist for any files and folders on drives and libraries he or she owns.

In most cases when user put files into system, either through web interface, or via some sort of network file service, such as samba, fruitmix can determine who is the creator of the file. But there are chances that user put a file into the system manually, bypassing the fruitmix. In such situation, there is no proper logic to force the `creator` to be someone, especially in multiple user owned drives or libraries. The only thing we can do is to leave it empty (`[]`).

# Xstat

`Xstat` is a data structure merged from a fruitmix xattr and `fs.Stats` object, plus a `abspath` property indicating the absolute path for this folder or file.

Example:

```
{
  // properties from fs.Stats, there are also function props not listed here,
  // such as isDirectory(), etc.
  dev: 2114,
  ino: 48064969,
  mode: 33188,
  nlink: 1,
  uid: 85,
  gid: 100,
  rdev: 0,
  size: 527,
  blksize: 4096,
  blocks: 8,
  atime: Mon, 10 Oct 2011 23:24:11 GMT,
  mtime: Mon, 10 Oct 2011 23:24:11 GMT,
  ctime: Mon, 10 Oct 2011 23:24:11 GMT,
  birthtime: Mon, 10 Oct 2011 23:24:11 GMT,

  // properties from xattr
  uuid: ,
  owner: ,
  writelist: ,
  readlist: ,
  hash: ,
  magic: ,
  htime: , <-- being removed!!!

  // the absolute path for this file or folder
  abspath:
}
```
# readXstat (path, opt, callback)

`readXstat` reads the xstat object for given path (in production, abs path recommended).

## design model

`xstat` can be thought of an overlay on system file system layer. It overrides the file instance identity, ownership, permissions of the underlying file system, and add a file digest for file content identity.

## responsibility

It composes the xstat object and passes it to upper layer as a single entity.

It guarantees the object properties are well-formatted, including:

1. must be a file or folder
2. must have a valid uuid
3. owner must be a uuid array, may be empty
4. writelist is either a uuid array or undefined
5. readlist is either a uuid array or undefined
6. writelist and readlist must be either array or undefined at the same time
7. if target is folder, it must have no `hash` property.
8. if target is file, `hash` is either a valid 64-character SHA256 string, composed of only digit and lowercase [a-f], or undefined.

It is not `xstat` layers responsibility to guarantee how upper layer using this fs overlay. For example, a root folder may have further constraints, such as the `owner` must not be empty. This is upper layer policy, irrelevant to `xstat` layer.

## xattr stored

xattr is stored on disk as JSON format.

It is slightly different from object passed to upper layer. The stored version must contains the `htime` properties to detect outdated file digest. The object passed up need not contain this prop.

9. `htime` is an integer number
10. JSON data either contains both hash and htime properties, well-formatted, or contains none of them.



If xattr does not exist, or it's not valid JSON, `readXstat` will construct a new one filled with default value.

The default value is:

```
{
  uuid: UUID.v4(),
  owner: null,
  writelist: null,
  readlist: null,
  hash: null,
  htime: null
}
```

If the xattr on file containing invalid properties, `readXstat` will fix it and save it back.

Here is the list of constraints on xattr object:

* uuid: non-exists or not a uuid, fixed with a new one
* owner: non-exists, or not a uuid or null, fixed with null or default
* writelist: non-exists, or not a uuid array, fixed with null or default
* readlist: non-exists, or not a uuid array, fixed with null or default
* writelist & readlist: both null, or both array, can be fixed with empty array if one of them is null
* hash: must be valid hash string, correct length and regex test [0-9a-f], can be fixed with null
* htime: must be valid integer (epoch time), can be fixed with -1
* hash & htime: both be valid, if one invalid, fix both
* htime & mtime: if htime !== mtime, invalidate both hash & htime

There are two versions of this function.

`readXstat` is used for reading files or folders exclusively inside a `Virtual Root`. This version must be provided with a permission object, which will be used as the default permission settings for the files or folders without Extended Attributes.

`readXstatAnyway` is used for reading the folder of `Virtual Root`.

This version does NOT assume the target folder is a valid `Virtual Root`. If the target does not have valid Virtual Root settings, it simply returns null.

For `Virtual Root`, there are extra rules for validation:

1. The owner property can not be null. It must contains at least one owner.
2. Type, valid value is `homeDrive`, `drive`, `homeLibrary`, `deviceLibrary`

`homeDrive` allows exactly one owner. Cannot be changed. Cannot be deleted unless the user is deleted. Each user has only one `homeDrive`. It is recommended to create `homeDrive` on System Drive and name the folder as the same uuid with user, suffixed by `-drv`.

`drive` allows one or more owners. Admin can add or remove owner. Can be deleted by SysAdmin.

`homeLibrary` allows exactly one owner. Cannot be changed. Cannot be deleted unless the user is deleted. Each user has only one `homeLibrary`. It is recommended to create `homeLibrary` on System Drive and name the folder as same uuid with user, suffixed by `-lib`

~~high~~

**high**

> hello world is the most basic programming
> see NodeJS reference: ......
>
> world


```
{
  uuid: UUID.v4(),
  owner: [...], // non-empty!
  writelist: [...], // non-empty!
  readlist: [...], // non-empty!
  roottype: 'drive', 'library'
}
```

\[
\alpha * \beta
\]
