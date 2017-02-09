## Overview

Fruitmix consists of three main functionality domains.

First, it provides several groups of restful apis. Each groups of apis provides certain functionalities to client devices, including but not limited to pc (Electron) and mobile devices, for accessing files and photos stored on nas server.

Second, it has built-in module to communicate with cloud server. The cloud server acts as a public domain proxy, bridging the communication between clients devices and fruitmix (nas), as well as the communication between nas servers (on behalf of trusted users).

Finally, it is observable. Fruitmix is kept small and can be deployed independently. Observer pattern is used to integrate fruitmix with other system level components, such as docker and system level file management (eg. import / export).

So from the viewpoints of external devices, or external components inside the same system:

```
    local
      client device ----> [fruitmix restful apis]

    remote access (client / nas)
      client device ----> [cloud] <----> [fruitmix]

    remote access (nas / nas)
      nas_a ---> [cloud for nas_b] <----> [nas_b fruitmix]
      nas_b ---> [cloud for nas_a] <----> [nas_a fruitmix]

    inside system
      system w/ appifi ----> [fruitmix]
      system w/ appifi <-- notification -- [fruitmix]
```

This document is going to describe the responsibility of each module (file level), as well as all external interfaces.

## Responsibilities

This is a very brief description.

### Client Access
For local client access, fruitmix provides the following functions:

1. User management
2. Virtual drives management. Virtual drive is an abstraction of users private file system hierarchy. Unlike cloud drive, it is backed by a real file system hierarchy (folder). This brings in some difficulties in implementation but can be compatible with existing network file system, such as samba, ftp, dlna.
3. File access (inside virtual drive).
4. File permissions and file level sharing.
5. Media file metadata and indexing.
6. Media share and permissions.
7. Media access based on both file level permissions and media share permissions.
8. Media talk (comments)

### Cloud

There exists a cloud service (either a centralized service or a standalone server or container) controlled by NAS, named `waterwheel`.

#### Terminology

* `waterwheel` server: the server (or container) implements `waterwheel`.
* `waterwheel` clients: all clients accessing `waterwheel` server, including nas, pc clients, as well as mobile devices.
  * `host` refers to the NAS device controlling the `waterwheel`. Each `waterwheel` has exactly one host, and `server-push channel` can only be established between `waterwheel` server and the `host`-roled client.
  * `guest` refers to all other client devices except `host`.

Virtually, `waterwheel` bridges `guests` and `host`. `guests` are isolated from each other, but host can respond to them all.

`server-push channel` may be implemented via socket, websocket, http polling and long-polling, server-side events etc. Performance wise, the priority should be:
  * robustness
  * scalability
  * easy to use in client-side
  * easy to develop in server-side

#### Responsibility (w/ performance)
1. `waterwheel` is designed to break a **stateful** three-party bidirectional communication into two **stateless** unidirectional communication.
2. `waterwheel` client (either a device or another nas) issues request (may be divided into smaller parts) to `waterwheel`.
3. NAS observes `waterwheel`, updating request by posting corresponding response.
4. Initially `waterwheel` use websocket or socket io to push message from cloud to nas device. In future this should be changed to polling, long-polling or server side message stream to make load balancing easier.




















So for nas client device, the local access api can not be directly reused, but the functionality is almost identical.
