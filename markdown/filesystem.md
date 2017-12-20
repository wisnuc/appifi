# File System Basic

In traditional file system, there are three basic concepts:

1. `path`, the **place** where a file or folder exists. It also implies the hierarchical structure of the file system;
2. `metadata`, including file name, MAC time, size, etc. Metadata can be changed independently without change the real content of the file. For example: renaming a file;
3. `data`, the content of the file.

Furthermore, `path` also plays an important role in the permission design for traditional file system:

1. Every file or folder is assigned a permission, indicating who own(s) it, and who else can read from or write to it;
2. Given a `path`, the permission on every folder/file along the path acts as a chain of **gates**. If a user can pass all those gates, the access is allowed. Otherwise, it is denied.

Such permission design is simple and efficient, at the expense that every file or folder in the system is assigned a permission.

# Network File System

Network File System has a client-server architecture. The client runs on user's computer, providing a file system service, while the 'real' files and folders are stored on the server side. File operations initiated from client side are passed to server for execution.

The main benefit of Network File System is that it enables multiple users to share folders and files over a network. But not all file operations through network file system are as robust or efficient as their counterpart on a local file system.

For example, many document editors read from and write to files frequently. If the file is stored remotely, such operations may be slow. Some network file system (such as samba) tries to ease the problem by caching some part of the file locally. This adds another layer of complexity: a file locking mechanism is required. Such locking mechanism is opportunistic, since there are chances the same files are accessed by another user (or process) from another computer. Also, an notification should be sent from server to client, when a client locked file changed by third party. The client must invalidate local cache, reload latest file content from server, and try their best to merge the latest change made by local user on client computer. They never works as stable and efficient as the file locking mechanism in local file system.

Most network file system service, implemented on Linux, requires a real file system as the back-end. Also, they usually integrate their user account and permission system with existing Linux system users and permissions. This results in the tight coupling between the network file service and the host system.

For a NAS implementation, this also implies that if some Network File Service is provided, and we have no intention to rewrite the service from scratch, there must be a corresponding file system (hierarchy) maintained locally.

# Web Drive

A web drive (in common sense) can be thought of a 'virtual' file system accessed via web interface or web apps.

Unlike a network file system, in web drive implementation, `path` is not necessarily a real file system path on server.

File operations taking single file or folder identifier as the argument, rather than the full path, will show better concurrent performance.

For example, if user C is operating on node c, while user B is renaming it's parent folder node b simultaneously. If the full path is used as operation argument, then there must be a mechanism preventing user B from renaming node b. However if both b and c are assigned a unique identifier and using identifier as argument for the operation, user C and user B can fulfill their jobs simultaneously.

This is exactly the way most popular web drive service designing their REST APIs. Http-based APIs don't need to conform to existing file operation interfaces on operating system.

Also, in a web drive, there is no need to assign permission to all files or folders. Only files or folders with user explicitly stamping a permission upon carries such data. Others may inherit permissions from their parent or ancestor folder.

# FruitMix

In fruitmix, we adopted a design more similar to a Web Drive or private cloud such as ownCloud than to traditional NAS system, such as Synology, OMV or freeNAS.

First, FruitMix establishes its own user and permission system based on database or file, separate from the Linux system. (Decoupling!)

Second, all user files and folders are assigned a UUID as its identifier. This UUID should be perceived as a unique identifier of a `File Instance`, it includes the following information:
1. where the file is placed, this is similar to `path` but is more robust to dynamic change.
2. permissions bound to a file or folder.
3. file digest.

You can think of a file as **a binding of its Instance (where it is stored and how it is accessed) to its Content**. And the file digest is a unique identifier to the content.

File Instance information are stored via Linux file system's Extended Attributes. see other documents.

Third, an in-memory data structure is constructed to representing this model at run-time, which is something like a overlay onto the real file system.

This overlay keeps the existing hierarchical structure of the Linux file system, put its own user and permission system onto it.

This overlay provides the fundamentals to the whole system design. It also enables a far more flexible permissions system, file sharing, as well as super fast, i/o less file system traversal.
