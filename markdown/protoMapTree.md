# ProtoMapTree

ProtoMapTree is a tree implemented as `Fly Weight Pattern`.

It utilizes JavaScript's prototypal inheritance feature to minimize memory usage.

Other than the common tree/node structure, there is an object, named as proto, acting as the prototype of all node object. Or in terms of JavaScript inheritance, all nodes inherit from this object.

The tree (class) object looks like:

```
// tree properties
{
  root: node,           // tree root node, or null
  proto: {},            // the prototype object which is the prototype of all nodes

  uuidMap: new Map(),   // map for uuid
  hashMap: new Map(),   // map for hash

  hashless: new Set(),  // set for hashless files
  shares: new Set(),    // set for shares
}
```

```
// node properties
{
  parent: node,         // structural, must have, null for root
  children: array,      // structural, undefined or node array, if array is empty, must be undefined

  uuid: string,         // identity, can not be changed

  type: string,         // folder or file, can not be changed

  owner: uuid array,    // may be []
  writelist: uuid array,  // may be [] or undefined
  readlist: uuid array,   // may be [] or undefined

  mtime: number,        // folder and file
  size: number,         // file only

  hash: string,         // file only, required to access hashMap (reverse link)
                        // hashless, this field undefined, put in set
                        // hashed, but magic not interested, this field undefined, not in hashless set
                        // hashed, magic interested, this field is hash value, put in hashMap
}
```

The constructor of protoMapTree, requires only the `proto object` to be defined. The tree root can be created later.

`uuidMap` is established for fast access to node by UUID.

`hashMap` holds all digest (hash) to file map. It has it's own structure as described below.

`hashless` holds all files that has not calculated the hash and magic yet. This queue is useful for hash magic worker.

`shares` holds all share folder. A `Share Folder` is a folder with explicit writer or reader other than driver owner. This list will be provided to user through API.

## Digest map (hashMap)

The key of an entry in hashMap is, of cource, the file hash.

The value of the entry, is an object.

```
// digest object

{
    type: ,     // an enumeration string created at run-time from file magic 
                // (the first file that trigger the creation of this object)
    meta: ,     // this field is an object, dependent on type, for example, when type is IMAGES_PNG, 
                // this meta may be:
                // {
                //   width: 
                //   height:
                //   fileSize:
                // }

    extMetaStatus: ,  // this field has enumeration string value, such REQUEST, READY, ERROR, etc.

    nodes: [],  // an array of nodes with this digest
}

```

### file node state

File each file node, `xstat` provides a hash and a magic property. They are either set together or undefined.

The hash is the file content digest, and the magic is the file command output. (libmagic)

When creating a new file node, or updating a file node, there is 3 possibilities for its state.

If the `xstat` does NOT contain hashmagic, the node object has no hash prop, and the node is put into `hashless` set.

If the `xstat` contains hashmagic, but it's type is not interested, the hash prop is dropped. that is, the node does not have the hash prop.

If the `xstat` contains hashmagic, AND it's type is interested, the hash prop is preserved, the node has hash prop. Meanwhile, the node will be added to `hashMap`. If it is the first one having this hash value, a new digest object is created, and some props of meta are set (it is possible that some props are set later).

Also, the extMetaReady property is determined in the following way:

If the file type (eg. IMAGE-PNG) does not require an extended (or external) meta, or the file magic (eg. JPEG image w/o exif) implies there is no extended metadata available, such as exif, this field is undefined.

If the file magic indicates there should be an extended metadata, this field is set to REQUEST.

The upper layer should observe the digest map. When there is digest object with extMetaStatus set to REQUEST, it should fire a worker to examine the pre-built cache or extract the info, and finally the extMetaStatus field should be set to READY, or ERROR. The upper layer worker may also add new props to meta object, such as creation time of a photo.






























