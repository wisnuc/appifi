# Overview

Originally, Fruitmix is a standalone application and deployed as a docker container. Appifi is a thin layer for managing all docker containers, without much knowledge on how application works.

Now, they are going to merge together. So the first question is: how they view the file system?

## Layers

For the sake of simplicity, we assume the following rules as the top level assumption in system design process

### Files and Folders

Only files and folders are considered on the whole file system. Symbolic links, device files, pipes, Unix domain sockets etc. are excluded. They are invisible.

This assumption implies two important things.

First, The whole file system is a tree. Each node has exactly one parent if it is not the root. All parents are folders. The tree is a nested structure without cycles, because we neglect the existence of symbolic link.

#### Host File System

**Host File System** is defined as the file system tree rooted at '/' of the system.

#### Virtual Root or VROOT

**Virtual Root** is a folder, dominating a subtree in the Host File System.

Virtual Root can be a mount point. A mount point is also a folder.

Virutal Root can not be nested.

A **Virtual Root File System (Virtual ROOTFS)** is the file system subtree containing all files or folders dominated by a Virtual Root.

This definition is inclusive (including the root folder itself).

A set of VROOTs is denoted by Set<sub>VROOT</sub>. Each element in this set containing a reference to a VROOT, with SOME related information. **TODO**

A set of VROOTFSes is denoted by Set<sub>VROOTFS</sub>. Each element in this set containing the normal file or folder information, their structural information, and a reference to their common ancestor (VROOT).

#### Universe (Host or Server)

**Universe** is defined as a set containing all files and folders dominated by all VROOTs, that is, it is the union set of ALL Virtual Root File System.

#### Ownership

Each VROOT (or VROOTFS) must be assigned to at least one owner.

Only SysAdmin can change the ownership of a VROOT.

#### Server and Client

From the viewpoint of host (server) program, there will be a Set<sub>VROOT</sub> containing all VROOTs, their corresponding VROOTFS sets form a **Partition** of Universe.

The program can add or delete a VROOT, which is essentially changing the Universe. The program can also change the ownership of any VROOT.

From the viewpoint of client program, it sees only the VROOTs owned by the login user, which is a subset of Host's Set<sub>VROOT</sub>.

#### Other Words

Any file or folder belongs to exactly one Virtual Root.

Since the file types other than normal file and folder are neglected, there is a chance that user want to create a new file or folder, but a device file or unix domain socket with the same name already exists. Both server and client program must take it into account.
