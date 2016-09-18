# Virtual Root

`Virtual Drive` is the concept modeling the root folder and its hierarchical file system.

# Personal Drive or Shared Drive

`Personal Drive` is a drive with fixed owner belongs to exactly one user and this cannot be changed. There is a default home drive created for each user and a default lib drive created for each user. They are both `Personal Drive` and its owner cannot be manipulated by other than owners, including `admin`.

`Shared Drive` is a drive with variable owner, it may belongs to zero, one or several users. [owner] can be changed by users who is `admin`.

# System Drive and Peripheral Drive

`System Drive` is the drive resides in system folder. This folder is located in the system volume or partition's `/wisnuc/system/drives`.

`Peripheral Drive` is the drive outside system volume or partition.

This is no specific file to preserve `System Drive` information. When fruitmix starts, it traverses the `/wisnuc/system/drives` folder to retrieve all system drives and maintains a list in memory.

For `Peripheral Drive`, since the mount point may be changed. Also, it may be hot-plugged. So we use a separate file to maintain their information. The file is located at `/wisnuc/system/core` and named as `peripheralDrives.json`. It is in JSON format.

For `User Drive`, the identity consists of at least the following information:

```
{
  resident: // resident disk, partition or file system, to be determined.
  path: // path to folder. The folder does not need to be stamp on xattr info, we can do so.

  // it is easy to think that there should be a hotplug flag. But you really can not rely on the pre-configured setting to work.
  // an ata disk may be plugged into a usb adapter to work. And we can always get the correct information how a disk is plugged into system,
  // by the help from appifi.

  there may be other configurations, but as less as possible, please.
}
```

# Library

Originally there are a concept of Library, at the same level to drive. In new design, we remove this concept from file system layer, but preserved library http api.

Internally, library use a top level folder inside a drive.
