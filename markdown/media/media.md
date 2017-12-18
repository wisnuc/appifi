# Media Documents

## Media Share

`media share` defines a data structure representing a user shares a set of media files, which are identified by file digest, to a set of other users.

A media share document is uniquely identified by uuid.

The user who create the `media share` document is the owner.

Other users in the `maintainer` list of the document has the permission to add media files, and remove the media files out the share if they are created by him or her.

Other users in the `viewer` list of the document has the permission to view all media files in the given share.

```
{
  doctype: 'mediashare',
  docversion: '1.0',

  uuid: the document uuid,

  author: string, // the share creator's user uuid,
  maintainers: [], // a list of user uuids, who are assigned the role of maintainer
  viewers: [], // a list of user uuids, who are assigned the role of viewer

  album: null or { title, text }
  sticky: true or false

  ctime: creation time
  mtime: last modification time

  content: [
    {
      digest: // media digest
      creator: // who created
      ctime: // creation time
    }
  ]
}
```

in-memory object

```
{
  digest: the internal document digest
  doc: {

  }
}
```

## Media Talk

`media talk` defines a data structure representing a collection of comments by other users on specific media file (digeset) owned by a given user.

A `media talk` document is uniquely identified by a user uuid AND a media file digest.

# Indexing

Obviously, `media share` should be indexed by uuid. They can also be held directly by a JavaScript Map.

It should also be indexed by media file digest. Since the same media file can be included in multiple shares simultaneously, the mapped digest object should have a collection of `media share` references, or uuid if the media share object is immutable.

# Retrieving

## media share

Retrieving all `media share` documents for a given user is straightforward. Simply iterate all documents and filter out the user viewables (own, maintainer, or viewer)

## media

Retrieving all `viewable` media authorized by media level authorization policy is not as simple as the first look.

Even if the user can access a share containing a media file, that does not necessarily mean the user who created such media file in the share still has the permission to access the file, in file level permissions.

Since in client side, there is no way to know what happens to other users. The server must do the weight-lifting job for the client. Also the performance is important since one users can be authorized to view hundreds of thousands of media files by media level policy.

1-pass algorithm is preferred. But several-pass are also acceptable in early stage, especially when there is no correctness and quality assurance for the code.

The most helpful performance booster would a user-digest indexing, which tells instantly whether a user still holds a file-level permission to access a given media file. But this is hard to implement due to the implicit permission design in file level.

Anyway we should give it a try after the file tree is stripped. The worst case should be a new user is added to or removed out of a file system tree, involving huge amount of descendent files.

### user-media set

This set should be provided by filer or digester. The query (user-digest) should have O(1) time complexity, supposing the JavaScript Map or Set implemented by hash table (at least true for V8).

### algorithm

Providing the user-media set is ready.

Retrieving all media viewable can be calculated as following:

1. prepare an empty set
2. iterate all shares, testing all media digest:
  1. if its already in set, next
  2. if its not in set already, test if it's accessible by the creator, if true, add it to set, else next
