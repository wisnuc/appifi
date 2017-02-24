
**This document is confidential**

## Version

* 2017-02-16 Draft (lewis)
* 2017-02-17 Draft, breaking change in media layer "all I can share"

## Philosophy and Trade-Offs

Before introducing the *wisnuc os* conceptual model, let's have a brief talk on top-level design philosophy and trade-offs.

### Permission and Sharing
First, there are two-related but different concepts: `permission` and `sharing`.

`Permission` is a concept deeply rooted in almost all multi-user systems. It means *how to authorize some user to access (or take certain action on) some resources*. The resources include, but are not limited to, files, directories, processes, memory spaces, network connections, etc. The design purpose is to implement a mechanism that can protect system's and user's resources from accidental malfunction and prevent malicious users from stealing or damaging system's or other users' resources.

`Sharing` is a user intention and action to allow other users to access some resources **owned** by the user. It is **functionality**.

It is possible to implement `Sharing` via existing permission system.

Most file sharing services, such as samba, nfs, ftp, etc., are built on top of the underlying system with permission implemented and reuse existing permission rules and user authentications.

The advantage of this approach is the permission rules are compatible and one-for-all. (Most NAS operating systems work in this way)

One disadvantage of such approach is that the system level permission rules are usually technically-oriented and comprehensive. They are powerful, versatile and efficient for system jobs, but are hard to be thoroughly understood for average users, especially for users who have little knowledge on desktop operating systems.

Another disadvantage is that the permission rules are usually attached to single (atomic) resource directly (eg. file permission), for the sake of efficiency and granularity (no doubt both are important for operating system). But they are cumbersome to manage since the data are spread over multiple resources.

For example: I want to share all files that I had shared with Alice also with Bob. How to do it?

So we argue that: **sharing isn't permission**. Sharing is functionality-oriented, user-oriented (with whom I share something), and should be simple, intuitive, and easy to understand. While permission is system-oriented, resource-oriented, and should be efficient, scalable and fine-grained.

They are two different things.

### File Layer and Media Layer

*wisnuc os* is developed from scratch for home users. It creates its own user management and authentication mechanism, separate from that of underlying system.

It also has the abstraction of virtual drives, containing directories and files, since web drive is a must-have feature.

One of the greatest ambition of *wisnuc os* is to implement the cross-domain sharing among users located on different *wisnuc os* servers. However, it's difficult to extend the complex or recursive permission rules or file system hierarchy to another domain in terms of security.

So we divide the resources inside the *wisnuc os* system into two layers: the bottom layer is `file layer` and on top of it is the `media layer`.

From the viewpoint of permission and sharing, the main difference is:

* file layer:
  * manages resources
  * hierarchical view for resources, as most file systems do
  * implements both sharing and permission, named as `file share` and `file layer permission`, respectively
  * sharing is `local`. (this is a policy)
* media layer:
  * does not manage resources, instead it manages **references** to file layer resources
  * flat view, like a collection, immune to resource location or name change
  * implements sharing, named as `media share`
  * sharing is `global`, that is, it works cross-domain.

The following diagram illustrates the layered design, as well as the dependency among three UAC-enforced modules. Both `media share` and `file share` implement their UAC on top of underlying `file layer permission`, which is basic and simple.

```
=========================================================================
‖                                                                       ‖
‖       media layer (maintains references)                              ‖
‖                                                                       ‖
‖                 --------------------                                  ‖
‖                 |    media share   |                                  ‖
‖=======================================================================‖
‖                 |                  |    file share    |               ‖
‖                 |                  --------------------               ‖
‖                 |        file layer permission        |               ‖
‖                 ---------------------------------------               ‖
‖                                                                       ‖
‖       file layer (maintains files and directories)                    ‖
‖                                                                       ‖
=========================================================================

```

### Access Rules and Operations in General

**<a name="def1000">Definition 1000</a>** An `access rule` is defined as a *mathematical function* with the following signature:

```
access rule :: (User, Operation, Resource) => Bool
```

It can be interpreted as: given a user, an operation, and a resource (a directory or file for file layer, or a media identifier in media layer), an access rule returns whether the user can apply the operation to the resource or not, according to this rule.

> Defining a rule as a function may seem counter-intuitive for developers. Usually they are defined as a table of data records, with user, operation, or resource identifier as column or field name. If such a record exists, we can always convert it into a function that tests if each argument equals to a predefined value and returns true or false accordingly. In this way, they are equivalent.

For all modules that implements user access control, a *Rule Set* can be defined as the set containing all access rules.

> Rule Set { all access rules }

**Definition 1001** A user is said to be *allowed* to apply certain operation to certain resource, if and only if there exists at least one access rule in the Rule Set that evaluates to True for the given user, operation and resource.

```
access check :: (User, Operation, Resource) => Bool
access check = ∃rule ∈ Rule Set, rule(User, Operation, Resource) == True
```

The definition of possible values for `Operation` is a policy rather than logic. It differs from module to module.

In *wisnuc os*, three possible values are defined for operation: `READ`, `WRITE`, and `SHARE`. Not all modules use them all.

> operation ∈ { READ, WRITE, SHARE }

The generalized access check function defined by `1001` is important. It translates the definition of access checking to the definition of a set of rules (functions) conforming to the signature defined in `1000`. We will use this method to define access rules and checking function for all UAC-enforced modules.

## Conceptual Model

### device and device role

`device` is a general term referring to a physical device. Sometimes it may also refer to a virtual device, such as a virtual machine, or a service, such as a containerized service in cloud.

A `NAS` (device) is a server, either physical or virtual, running wisnuc os.

A `client` device is a PC or mobile device running wisnuc os client software.

A `cloud` device is a cloud server or container, running wisnuc cloud sofware, codenamed `waterwheel`.

### user

`user` represents a user account maintained in a NAS.

Internally, a user:

* is represented by a data structure with a bunch of properties
* has some resources, such as files or documents
* may access resources under various sets of access control rules
* may participate sharing activities



If a user is explicitly created by the system administrators and may access the NAS, we say the user is *hosted* in the NAS. The NAS is then the user's *host* device. `local` user is synonymous to `hosted` user for the given NAS.

`remote` user is the user hosted in a NAS other than the given one.

There is a process, named `pairing` (the term is borrowed from Bluetooth technology), to establish a *mutual* relationship between two users hosted in two different NAS. This bidirectional relationship, or `friendship`, is modeled by two unidirectional relations, named `trust`, and maintained by two NAS separately.

Supposing user *a* is hosted in NAS A and user *b* is hosted in NAS B.

*a* trusts *b* means that in NAS A, if there is some request to access *a*'s data, initiated from NAS B, on behalf of user *b*, the request should be fulfilled by NAS A according to *a*'s access rules. Therefore, NAS A must have *b*'s credential (public key) for authentication.

If *a* trusts *b*, we say *b* is *a*'s `friend`.

If *a* trusts *b* and *b* trusts *a*, we say *a* and *b* are `mutual` friends.

### drive

In *wisnuc os*, we consider both directories and files as resources. The term `Universe` refers to the *set* containing all resources in file layer.

> Universe { all directories and files }

Universe are **partitioned** into `drives`.

> In mathematics, a partition of a set is a grouping of the set's elements into non-empty subsets, in such a way that every element is included in one and only one of the subsets.

From the viewpoint of user, a `drive` represents a virtural or web drive, containing a file system hierarchy. Internally, each drive is defined by a data structure and is backed by a directory located in underlying file system.

#### drive, permission and ownership

In *wisnuc os*, the term `permission` is solely used in file layer, denoting the `access rules` enforced by `drive` configuration. These access rules are preferably mentioned as `permission rules`.

A drive is either `private` or `public`. (this is a policy)

A `private` drive has exactly one user as its `owner`. The drive and resources inside it are said to be *owned* by the owner. Such ownership *implicitly* creates the following permission rules. We say *the drive owner is allowed to apply any operation to resources in the drive*.

```
(for private resources)
permission rule :: (User, Operation, Resource) => Bool
permission rule = User == Resource.Drive.owner
```
In another word, the `ownership` is interpreted as a set of permission rules. There is no other usage of `ownership` elsewhere in *wisnuc os* model.

A `public` drive has no owner (since it's public!). Instead, it has user lists (sets) for certain operation (sharelist, writelist, and readlist) that **explicitly** defining which user can apply which operation on resources inside it. We say *the user is allowed to apply certain operation to resources in public drive if and only if he or she is in the corresponding user list (or their union) suggested by operation*.

```
(for public resources)
permission rule :: (User, Operation, Resource) => Bool
permission rule (User, 'SHARE', Resource) = User ∈ Resource.Drive.sharelist
permission rule (User, 'WRITE', Resource) = User ∈ Resource.Drive.writelist
permission rule (User, 'READ', Resource) = User ∈ Resource.Drive.sharelist ∪ Resource.Drive.writelist ∪ Resource.Drive.readlist
```

The above rules form the Rule Set for file layer permission. By applying the general access check function defined by `1001`, we get a function which can be used to check if any given user can share, write, or read any given resource. We name this function as `permission_check` in the following section.

Noting that both rules are defined in drive scope. That is, resources in the same drive have the same permission rules.

There are no finer-grained permission rules. This greatly simplifies the implementation since there is no recursive check on tree data structure.

It also removes lots of confusion when moving resources from one drive to another (the ownership transfer problem).

### user and drive management

Only system admin can create new `local` user.

`remote` user is not explicitly created by any user. It is automatically created in `pairing` process or according to remote users indirectly sharing (see media share).

Each `local` user has one `home` drive and one `library` drive. Each `remote` user has one `media` drive. All of them are automatically created and can not be modified. All of them are `private` drives.

Only system admin can create `public` drive and manipulate the `sharelist`, `writelist`, and `readlist`.

System admin cannot access other users private drive as well as public drives not listed him or her as users.

### file share

Informally, `file share` is a document that allows a user to share a collection of directories and/or files with other (local) users.

The document has `author`, `writelist`, `readlist` and `collection` as its properties.

Strictly, `file share` is a document that `authorizes` other (local) users to apply certain operation to a collection of resources that **can be shared** (determined by `permission_check`) by the user.

'SHARE' operation is not applicable in `file share` to avoid recursive and even cyclic dependencies.

When creating the `file share`, `permission_check` should be performed on **ALL** resources, since creating a `file share` should be modeled as *a batch of SHARE operations*.

### file share authorization

`file share` has its own access control.

We use `authorization rules` to mention access rules created by either `file share` or `media share` access control.

If user A creates a `file share` including user B (B != A) in user list for certain operation and resource x in resource collection, we say *A authorizes (or allows) B to apply such operation on resource x*, or informally and ambiguously, *A shares x with B*.

Each `file share` creates a collection of authorization rules, but it's more convenient to define them collectively (there are dependencies).

Also notice that the prerequisite condition *resources that can be shared* may not always hold true, so it's necessary to check it each time.

```
(for file share)
authorization rule :: (User, Operation, Resource) => Bool
authorization rule (User, 'WRITE', Resource) = ∃fshare, User ∈ fshare.writelist AND
                                                Resource ∈ fshare.resources AND
                                                permission_check(fshare.author, 'WRITE', Resource)
authorization rule (User, 'READ', Resource) = ∃fshare, User ∈ fshare.writelist ∪ fshare.readlist AND
                                                Resource ∈ fshare.resources AND
                                                permission_check(fshare.author, 'READ', Resource)
```

The above rules form the *Rule Set for file sharing*. The corresponding access check function is denoted as `fshare_auth_check` in the following section.

`file share` provides an easy-to-manage and fine-grained mechanism for users to share their resources to other users. In current stage, we limit the sharing with only local users. This may change in future.

### File API operation

When client device issues an operation request for a given resource on behalf of a user, both `permission` and `file share authorization` should be checked, since in `File API` design, all access to resources are based on resource UUID, rather than context or path. As long as there is an access rule allows, no matter where the rule come from, the operation should be allowed.

```
(for File API operation)
operation check :: (User, Operation, Resource) => Bool
operation check = permission_check(User, Operation, Resource) OR fshare_auth_check(User, Operation, Resource)
```
(TBD)

### media

A `media` represents a file **content**, identified by file digest (sha256) value.

The file content is considered to be *immutable*. Hence it's attributes, such as file type and metadata, are also *immutable* and can be extracted from the file if the file exists anyway.

### media share

Informally, `media share` is a document sharing a collection of `media` among a group of `users`.

A `media share` has `author`, `maintainers`, `viewers`, and `content`, which contains composite objects representing a media and by whom and when it is created.

`media share` allows `remote` user as maintainer or viewer.

### media share content maintenance problem

Clearly, the `media share` author should take the responsibility to maintain the document. All modifications should go there first and are pulled back later to implement an *unidirectional data flow*, which is supposed to be easy and clean in distributed or networked asynchronous computing.

That's OK. But how about the content? who should be responsible to store and serve media files?

It is possible that a content creator (maintainer) has no relation with a viewer.

For example, for a given share, viewer A, author B and maintainer C are hosted on different NAS, then A <-> B and B <-> C must be mutual friends, as least at the moment when C adds a media into the share.

There is no way for A to access C's media file if C takes the responsibility of storing and serving the content.

So we transfer the responsibility to the author. If author X creates a `media share`, and maintainer Y adds a media, **it is author X's responsibility to store the file somewhere, and to serve it to all viewers (members)**.

To implement *somewhere*, it is better to not break the existing file layer policy, in which, each user has private drive and all his or her files are stored there. This implies that in A's host NAS, `remote` users should be created for all `indirect friends`. We mention them as `buddy` or `buddy user`.

#### Security

##### Faking Buddy

For a given share, considering A1 as viewer, B1 as author, and C as maintainer. C added a file into the share. Then nas A has a remote user B1 and C's media file throught mirroring B1.

Now supposing their are a pair of malicious user, A2 and B2. B2 create another share, pretending C is B2's friend (which can not be justified by nas A), adding A2 as viewer. Then it is possible that A2 can view C's file if B2 correctly faked the file hash.

To avoid such problem, A should not simple trust B2's claim for it's friendship, instead, it should check if B transfered the file indeed.

##### Faking Content

### media talk

TBD

### Media Properties

Media properties is a collection of bool-valued field, indicating the properties of given media for a given user. The properties include:

1. Whether or not the user can access any of this media's file instance in file layer.
2. Whether or not the user has shared the media with others.
3. Whether or not the media has been shared with the user by other users.

etc.

## Data Structures and Algorithms
### node, tree, and forest

`node` is an in-memory data object, representing of a directory or file inside the drive as well as the underlying file system.

`tree` is the node hierarchy. It's root node corresponds to a drive.

`forest` is the collection of `trees` for all drives.

### File Level Readable

`fileUserReadable :: (User, Node) => Bool`
* if Node is public && User owns Node, return true (public node)
* if User owns Node, return true (private node)
* return ∃ fshare
  * User ∈ fshare.readerSet AND
  * ∃ node, node ∈ Node.path AND n ∈ fshare.content)

where fshare.readerSet is defined as
  [...fshare.readlist, ...fshare.writelist, fshare.author]

#### fileShareSet

A `file share` essentially created m by n atomic authorization rules, where m is the number of users in `readerSet` and n is the number of shared directories in `content`. Hence single atomic authorization rule can be described by a 2-tuple `(user, dir)`, and can be treated as a vector.

We can build a set or mapset to put all authorization rules into one data structure for efficient permission check. For example, combining user uuid and directory uuid into a composite string and put it into a JavaScript Set. This can avoid the nested loops and reduce the complexity to `O(1)`.

### Media User Readable

`mediaUserReadable :: (User, Media) => Bool`
* ∃ f, f ∈ Media.files AND fileUserReadable(User, f)

### Media User Viewable

`mediaUserViewable :: (User, Media) => Bool`
* ∃ mshare, User ∈ mshare.viewerSet AND Media ∈ mshare.content AND
  * mshare.author can access this media through



## Modules

[world](#def1000)

MediaCollection

IMPORTANT!!! This definition is different from that of previous version


When diving into the implementation details, it's easier to see the difference between permission and sharing. The former should answer the question: "what I can access" and the latter must answer the question: "what I can share".

Here is the definition. Don't worry if you find some concepts not clearly explained. Keep the above diagram and the follow rules in mind, you will find it's much easier to fit a single piece of concept or definition into the whole picture when reading the following sections.

In file layer (FL)
1. "What I can share (by file share)"
  1. all private files I owned.
2. "What I can access"
  1. all private files I owned.
  2. all public files I can access by permission rules.
  3. all files that are shared with me via `file share`.

In media layer (ML):
1. "What I can share (by media share)"
  1. all media files that I can access in file layer.
2. "What I can access"
  1. all media files that I can access in file layer.
  2. all media that are shared with me via `media share`.

It should be mentioned that the rule FL2.2 would be unnecessary if there is no concept of public resources (i.e. all resources must be owned by single user).

However, windows file sharing (or samba) is the most common way to share files across different computers (and usually among different users). To be compatible with such feature, we forged the concept of *public* here to emphasize that it is the opposite of *private*. But be cautious that *public* does not mean *the resource can be accessed by anybody*. Instead, it means *nobody owns or can share this resource*. In another word, for file level sharing (`fileshare`), *you can only share what you own*.

Another rule that does not sound reasonable is rule ML1.1.

For example, a public file cannot be shared by a user to another local user via `file share`, but if this file is a media file, the user can share it with either local or remote user via `media share`.

The positive argument for this rule is a real-world use case. Many people has historical files, including media. They are used to create a Windows share (in our term, a public drive) and put all files there, then all family members can access them either through windows sharing (samba), or through wisnuc clients. It is plausible to allow users to share the files inside it with friends.

The negative argument for this rule is, that when administrators create a public drive and add users to the permission list, they may deliberately exclude some people, preventing them from accessing files inside the drive. So the system should enforce such intention, preventing any behavior, including copying, moving, or sharing the files to users who are not in the permission list. But this will raise great inconvenience.

In future, if it is required to enforce such intention, we may add further actions in public drive's permission control, such as copying, moving, deleting or sharing. But for now, let's neglect such inconsistency in our permission and sharing rules, and wait for user feedback.

### Final words

Though we argued the difference between permission and sharing, it is impractical to name the rules to `permission rule` and `sharing rule` separately. `sharing rule` sounds weird and unfamiliar to most developers. So in following sections, we use only permission rules to refer to both permission and sharing rules.
