# Drive

There are several things called `Drive` in Fruimix, and here is the clarification.

First, there is a `Drive Definition`, which is a static definition of drives. `Drive Definition` is represented by `Drive Definition Model`, or `Drive Model` for short.

Second, there is a `Drive Tree`, which is essentially a file system cache, similar to the vfs cache in the kernel.

Third, there is run-time information on a virtual drive, including:
* status, if the drive is online, if it is cached (indexed);
* real system path, mounting point, etc.
* transient state information, such as indexing.

All these three things combines into a `Drive Object`, that is:

```
# Drive object
{
  definition: reference to a DriveDefinition object,
  tree: reference to a DriveTree object, or null

  // other props for run-time status.
  status: 'offline', 'online'
  index: 'none', 'indexing', 'indexed'

  // if peripheral drive
  device: eg. '/dev/sda1',
  path (mountpoint): '/run/wisnuc/ext4/xxxx'
}
```

# Repo

The singleton `Repo` holds:
* a list of `Drive Object`,
* a list of `Drive Definition Object`,
* a list of `Drive Tree Object`,
* a `Permission Object`,
* a `Digester`,

to fulfill its job.

Most file operations are forwarded to `Drive Tree` after permission check.

Creating, updating, or deleting `Drive Object`, will in turn create, update or delete corresponding `Drive Definition Model Object`. It is also involves the creation or deletion of folders. This provides an interface to add, remove and modify the `Drive` as RESTful resources.

Repo also signals events to `Media` layer, `DIGEST_UPDATED` should be the most important event for `Media` layer to start its action.

Repo also responds to external events, mainly for mounting and unmouting virtual drives.

Repo holds tree lists and drive definition object lists. The former is totally maintained by repo; the later should be used to construct Repo (DI).

Indexing may be a long operation, and resource-sensitive.

Indexing may be persistent (serialized).

# Creating Drive

Creating a system drive

Creating a peripheral drive

# How digester works

readXstat is responsible for identify if a digest should be calculated, by providing a `fileType` property of file node.

If `fileType` matches item in predefined list ('animation', 'audio', 'images', for now), and digest unavailable, a request is queued for later calculation.

If a digest is updated, either by readXstat return, or by digester update, an event is fired, for `Media` layer to take action. Say, extract metadata and save to hash pool.

# Drive api

Providing a user interface to create, read, update, and delete drives.

Also, Appifi uses this interface to create or remove appifi drive.

# File api

Operating Files

# Library api

Upload files to certain drive, and folder.

# How Media API works

tree visitor
