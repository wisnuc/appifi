## Structure

`appifi` project contains three loosely coupled components: `system`, `appifi`, and `fruitmix`.

Originally there are two separate projects: `appifi` and `fruitmix`. Then the latter are merged into the former (this one). After some refactoring, the system level functionalities are extracted from `appifi` code base to form a separate layer. In future, they may be split into three separate projects.

`system` component is responsibile for traditional NAS functionalities, including probing system, especially block devices, configuration networks, etc. If the target system is managed by `appifi` project (this project is deployed to a dedicated device), system layer is must-have.

After `system` layer extracted out of `appifi`, now `appifi` component is a standalone docker client. It communicates to docker daemon throught docker remote api (restful). and providing a set of simplified rest api to pc or mobile clients.

`fruitmix` provides the core function for `wisnuc private cloud`. It manages and maintains users, virtual drives, files, media, file system or in-file metadata, media sharing, as well as media talks (comments on media files).

In current stage, three components are tightly coupled, so they are put into one project repository.

The aim is: both appifi and fruitmix will be deployed separately, as a standalone software.

This is a very brief view of the whole system. The documentation starts from `fruitmix` component.
