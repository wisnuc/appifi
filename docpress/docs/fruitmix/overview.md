## Objective

### Background on File Service

`Fruitmix` is designed from scratch for consumer users to store, sync, organize, and share their files, especially sharing media files in a social way.

It's not another network file system (nfs, in general sense), such as ftp, samba, nfs, webdav, etc.

Most nfses are designed to be an extension of underlying file system in certain operating system, providing users or client programs the accessibility to file systems remotely.

There are several disadvantages.

First, in a multiple user environment, the permission system must be implemented. Most existing nfs implementation chooses to reuse the underlying operating system permissions, since the file system is a fundamental component in operating system and is tightly coupled with user permissions. This is the most intuitive and convenient way. Users or system maintainers do not need to maintain two independent set of user accounts and permission rules.

Second, there is no way to identify a file instance universally. Linux file system provides the inode number for each file. But inode number is reused and is unique only inside a file system (a block or a mountpoint). If files are moved from one file system (block device) to another, they cannot be identified uniquely.

Third, most file system does not provides checksum or hash value for files. A few (cow-based) file systems, such as ZFS, provide block-level checksum for each file, and they are calculated in real-time (in-band on write path). But this is extremely expensive in terms of cpu resource for large files.

Many userspace applications also implement file hash calculation, but if there is no robust way to uniquely identify a file, using path string as the reference to file object can be easily broken. Especially when the application is designed to be a file repository manager for users. Files are added, deleted, moved and shared frequently.

Fourth, needless to say the significance of in-file metadata management for consumer applications. File system does not provide such utilities. They are considered to be a task for userspace programs. Extracting such info is not hard. But again, it's hard to maintain such data if there is no robust way to identify files.

Fifth, as a real-world, one-for-all system or application, it is impossible to force user abandoning their existing habits. That is, the popular nfs, such as samba, ftp, should also be provided.

This makes things worse, even it's not to hard to monitor what those nfs servers do, being compatible means:

1. the system must keep a REAL underlying file system, for various nfs server programs. If this is not mandatory, keeping all files inside a managed repository and building a virtual folder hierarchy to clients is much easier, like most web drives do.

2. Since users can modify the file system in out-of-band way, the underlying file system must be considered as UNCONTROLLED and VOLATILE, and actively MONITORED.

`inotify` is not the cure, since it requires significant system resources. It's also not quite reliable and not cross-platform. Some degraded methods must be designed, sacrificing the responsiveness to some (acceptable) extent.

All metadata management must also be robust and responsive enough to underlying file system change. This is a traditional pain for many file indexing applications, such as file indexing service (for in-file keyword search), multimedia library management programs, etc. Many (metadata) records in database may be broken due to file system change. Re-indexing is time consuming. It's hard to build good user experience for social sharing on top of such fragile underlying data.

## Design

Keeping all those problems in mind, the `fruitmix` is designed layer by layer. Each layer attacks certain problem.

The fruitmix core can be broadly considered to be two layers: `file layer` and `media layer`, based on the same set of user accounts.

`file layer` manages all file operations, decorating the underlying file system (in operating system) with extra information, such as uuid, permissions, hash, and magic (file type extracted from in-file data).

It directly backs the `drive` and `file` restful apis for web drive functionality.

The file layer has its own file permission system, designed to be similar with web drive, which allows implicit file permissions (that is, files or folders without explict permission settings, inherits permissions from its parents or ancestors).

`media layer` builds its business logic and own data object (such as media sharing, albums etc) on top of a FLATTENED media collection. Such collection is inherently an file indexing, using `file hash` as key. Also, extra media in-file metadata are decorated onto such media object.

`!!IMPORTANT` Media layer has its own permission system, for sharing media files, creating albums or media shares (like a twitter post containing several media), etcs.

This is necessary because:

1. file-level permissions are designed for sharing files in a file management context. They are cumbersome for social sharing. This is a user experience problem.

2. file-level permissions are hierarchical and spiral, they are hard to sync changes among multiple devices or even cross-host (nas-to-nas sharing). This is an implementation and performance problem.

From the viewpoint of clients, including pc clients (based on Electron), ios or android apps, when they are operating on files or folders through file manager / file apis, they use file-level permission systems.

When they are accessing media files (or thumbnails), the server will mix the result of two different and independent permission systems, and serve the client `all I can view` medias.

When they are accessing media layer data objects other than media file itself, such as media shares, media talks, or maybe media docs, they use media-level permission systems.

Keep this in mind.

The core idea and mission of fruitmix, is to build a media sharing layer which can be used to share media files remotely, on top of a set of traditional web drive functionality, which shares files locally.

From the viewpoint of a user. He or she has two apps, or two activities in one app. One of them do web drive, and the other do social sharing.

Users can consume their file in either traditional file manager / web drive way, or in a social media way, something like instagram or friend circle in WeChat.

In the perspective of social media app, all file-level permissions are reserved, that is, all files he or she can access from web drive, can be shared to his or her friends. In another word, web drive holds the content he all she can share, just like user pick one or more file from local computer to post to social media set. But the opposite is not true, the user can view media files from his or her friend in social media app. Also a copy is stored in users' nas if it's from a remote friend, he or she can always view it from social media app, but it's not automatically copied to some folders in his or her drive, unless the user manually does so.

### User

`fruitmix` manages users in its own way. Each user is assigned to a random and unique UUID. This decouples its user and permission management from underlying operating system.

### File System Decoration Layer

An extra file-system metadata (not in-file metadata) are `decorated` onto each file or folder, which contains:

1. an UUID to uniquely identify a file or folder.
2. permission rules.
3. file hash and file type info if available.

Such information are stored as linux file extended attributes, usually mentioned as `xattr`. Such feature is supported for most linux distros on most popular file systems, such as btrfs, ext4, ntfs (using alternative stream by ntfs-3g driver). The only exception is FAT.

Also, `xattr` is copied for most file utility programs, unless user deliberately tells the program to do so. This avoids the uuid duplication. Such `uuid` can be considered to uniquely and universally identify a file `instance`. By `instance`, we mean the place where it is stored and named. It is irrelevant to the file content.

`file hash`, on the contrary, uniquely identifies a file content, but not it's place or name (instance). There may be many file instance, stored at different place and named differently, containing the same file content. In such case, they all have the same `file hash`.



















The lowest layer of fruitmix can be considered as a decoration onto underlying file system.

The mission of fruitmix is to manage user's files in a `consumer` way. By `consumer`, we mean:

1. there should be a better way to `IDENTIFY` a file instance, other than the path and name.
2. there should be a simple and intuitive way for average users to share their folders and files.
3. the fingerprint of a file should be provided:wq
