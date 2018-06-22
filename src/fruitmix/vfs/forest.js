const path = require('path')
const EventEmitter = require('events')
const assert = require('assert')

// short circuit debug (suspect memory leaks)
const debug = require('debug')

const mkdirp = require('mkdirp')

const SortedArray = require('../../lib/sorted-array')
const Directory = require('./directory')
const File = require('./file')

// const SortedMap = require('../../lib/sorted-map')

const autoTesting = process.env.hasOwnProperty('NODE_PATH') ? true : false

/**
class SortedArray {
  constructor () {
    this.array = []

    Object.defineProperty(this, 'length', {
      get () {
        return this.array.length
      }
    })
  }

  indexOf (time, uuid) {
    let i, t, id
    for (let min = 0, max = this.array.length - 1;
      t !== time && id !== uuid && min <= max;
      min = t < time || t === time && id.localeCompare(uuid) === -1 ? i + 1 : min,
      max = t > time || t === time && id.localeCompare(uuid) === 1 ? i - 1 : max) {
      i = (min + max) / 2 | 0
      t = this.array[i].getTime()
      id = this.array[i].uuid
    }

    return (t === time && id === uuid) ? i : this.array.length
  }

  insert (file) {
    console.log('insert', file.name, this.array.length)    

    let index = this.indexOf(file.getTime(), file.uuid)
    // this, of course, won't happen in normal case
    if (this.array[index] === file) {
      console.log(file)
      throw new Error('sorted array, insert, file already in indices')
    } else {
      this.array.splice(index, 0, file)
    }

    console.log('inserted', this.array.length, this.array.map(x => x.name))
  }

  remove (file) {
    console.log('remove', file.name)

    let index = this.indexOf(file.getTime(), file.uuid)
    if (this.array[index] !== file) {
      console.log(file)
      throw new Error('sorted array, remove, file is not in indices')
    } else {
      this.array.splice(index, 1)
    }

    console.log('removed', this.array.length, this.array.map(x => x.name))
  }
}
*/


/**
Forest maintains a collection of tree hierarchy containing Directory and File nodes.

Forest is considered to be the context of all nodes.


But MediaMap is NOT visible to nodes. So hash/fingerprint worker and metadata 
worker are treated differently. The former is encapsulated in state of file 
nodes. While the latter is considered to be an external observer.



Forest provides two critical services to other parts of Fruitmix: looking up file path by uuid or by file hash.

```
for directory: (driveUUID, dirUUID) -> abspath
for regular file: (driveUUID, dirUUID, fileUUID, filename) -> abspath
```

There are three types message from external components notifying a possible file system change, or a file path retrieved from forest does not work.

First, for samba, it simply notifies a directory is changed. The directory is provided as an absolute path.

In this case, a path walk is performed. If the corresponding `Directory` object is found, a `read` is requested. If it is not found, a `read` on the last one is requested. This is a simple solution. But it won't fix errors deeply nested inside the subtree.

It is possible to repeat the process until it is impossibe to go further. Don't know if it helps, for the `read` operation itself may raise errors.

We don't have a finally correct solution without a fully scan of the file system. All solutions are just best effort.

Second, for rest api router. After an operation is finished, it should provide both dir uuid and affected directory to forest. Forest firstly verify the abspath matches. If it does, a `read` is requested. If it doesn't, a pathwalk `read` is also tried.

Third, if an external component, such as box or media, get a file path from forest, by file hash, take some action, and then got a path error, including EINSTANCE, or a file change is detected, for example, type changed or hash dropped. It should notify the forest with detail.

In either case, a `read` on the `Directory` object is enough.

@module Forest
*/

class Forest extends EventEmitter {

  constructor (froot, mediaMap) {
    super()

    /**
    Absolute path of Fruitmix drive directory  TODO
    */
    this.dir = path.join(froot, 'drives')
    mkdirp.sync(this.dir)

    /**

    hash => {
      metadata: {},
      files: []
    }

    */
    this.metaMap = new Map()

    /**
    */
    this.timedFiles = new SortedArray()

    /**
    The collection of drive cache. Using Map for better performance 
    */ 
    this.roots = new Map()

    /**
    All directories indexed by uuid
    */
    this.uuidMap = new Map()
    
    /**
    All interested files indexed by uuid
    */
    this.fileMap = new Map()

    /**
    dirs in init state. (dir may or may not have a timer)
    */
    this.initDirs = new Set()

    /**
    dirs in pending state
    */
    this.pendingDirs = new Set()

    /**
    dir in readding state
    */
    this.readingDirs = new Set()

    /**
    files has no hash/fingerprint
    */
    this.hashlessFiles = new Set()

    /**
    files that are calculating hash/fingerprint
    */
    this.hashingFiles = new Set()

    /**
    files that failed too many times in calcuating hash/fingerprint
    */
    this.hashFailedFiles = new Set()
  }

  indexFile (file) {
    debug(`index file ${file.name}`)
    this.fileMap.set(file.uuid, file)
    this.timedFiles.insert(file)
  }

  unindexFile (file) {
    debug(`unindex file ${file.name}`)
    this.timedFiles.remove(file)
    this.fileMap.delete(file.uuid)
  }

  fileEnterHashless (file) {
    debug(`file ${file.name} enter hashless`)
    this.hashlessFiles.add(file)
    this.reqSchedFileHash()
  }

  fileExitHashless (file) {
    debug(`file ${file.name} exit hashless`)
    this.hashlessFiles.delete(file)
  }

  fileEnterHashing (file) {
    debug(`file ${file.name} enter hashing`)
    this.hashingFiles.add(file)
  }

  fileExitHashing (file) {
    debug(`file ${file.name} exit hashing`)
    this.hashingFiles.delete(file)
    this.reqSchedFileHash()
  }

  fileEnterHashFailed (file) {
    debug(`file ${file.name} enter hash failed`)
    this.hashFailedFiles.add(file)
  }

  fileExitHashFailed (file) {
    debug(`file ${file.name} exit hash failed`)
    this.hashFailedFiles.delete(file)
  }

  fileEnterHashed (file) {
    debug(`file ${file.name} enter hashed`)
    // this.mediaMap.indexFile(file)

    if (file.metadata) {
      if (this.metaMap.has(file.hash)) {
        let val = this.metaMap.get(file.hash)
        val.files.push(file)
        file.metadata = val.metadata
      } else {
        this.metaMap.set(file.hash, {
          metadata: file.metadata,
          files: [file]
        })
      }
    }
  }

  hashedFileNameUpdated (file) {
    debug(`hashed file ${file.name} name path updated`)
    // this.mediaMap.fileNameUpdated(file)
  }

  fileExitHashed (file) {
    debug(`file ${file.name} exit hashed`)
    // this.mediaMap.unindexFile(file)

    if (file.metadata) {
      let val = this.metaMap.get(file.hash)
      if (!val) return // this is an error

      let index = val.files.indexOf(file)
      if (index === -1) return // this is an error

      val.files.splice(index, 1)
      if (val.files.length === 0) this.metaMap.delete(file.hash)
    }
  }

  reqSchedFileHash () {
    if (this.fileHashScheduled) return
    this.fileHashScheduled = true
    process.nextTick(() => this.scheduleFileHash())
  }

  scheduleFileHash () {
    this.fileHashScheduled = false

    if (this.hashlessFiles.size === 0 && this.hashingFiles.size === 0) {
      console.log('all file hashing jobs finished') // TODO
      return
    }

    while (this.hashlessFiles.size > 0 && this.hashingFiles.size < 2) {
      let file = this.hashlessFiles[Symbol.iterator]().next().value
      file.setState(File.Hashing)
    } 
  }

  indexDirectory (dir) {
    debug(`index dir ${dir.name}`)
    if(this.uuidMap.has(dir.uuid)) throw new Error(`need index dir ${dir.name}, old uuidMap ${this.uuidMap.get(dir.uuid)}`)
    this.uuidMap.set(dir.uuid, dir)
  }

  unindexDirectory (dir) {
    debug(`unindex dir ${dir.name}`)
    this.uuidMap.delete(dir.uuid)
  }

  dirEnterIdle (dir) {
    debug(`dir ${dir.name} enter idle`)
  }

  dirExitIdle (dir) {
    debug(`dir ${dir.name} exit idle`)
  }

  dirEnterInit (dir) {
    debug(`dir ${dir.name} enter init`)
    this.initDirs.add(dir.uuid)
    this.reqSchedDirRead()
  }

  dirExitInit (dir) {
    debug(`dir ${dir.name} exit init`)
    this.initDirs.delete(dir.uuid)
    this.reqSchedDirRead()
  }

  dirEnterPending (dir) {
    debug(`dir ${dir.name} enter pending`)
    this.pendingDirs.add(dir.uuid)
    this.reqSchedDirRead()
  }

  dirExitPending (dir) {
    debug(`dir ${dir.name} exit pending`)
    this.pendingDirs.delete(dir.uuid)
    this.reqSchedDirRead()
  }

  dirEnterReading (dir) {
    debug(`dir ${dir.name} enter reading`)
    this.readingDirs.add(dir.uuid)
    this.reqSchedDirRead()
  }

  dirExitReading (dir) {
    debug(`dir ${dir.name} exit reading`)
    this.readingDirs.delete(dir.uuid)
    this.reqSchedDirRead()
  }

  reqSchedDirRead () {
    if (this.dirReadScheduled) return
    this.dirReadScheduled = true
    process.nextTick(() => this.scheduleDirRead())
  }

  dirReadSettled () {
    return this.initDirs.size === 0 &&
      this.pendingDirs.size === 0 &&
      this.readingDirs.size === 0
  }

  scheduleDirRead () {
    this.dirReadScheduled = false
    if (this.dirReadSettled()) {

      if (!autoTesting) {
        // console.log('total directories: ', this.uuidMap.size)
      }

      this.emit('DirReadDone')
      return
    }

    while (this.initDirs.size > 0 && this.readingDirs.size < 6) {
      let uuid = this.initDirs[Symbol.iterator]().next().value
      let dir = this.uuidMap.get(uuid)
      assert(!!dir)
      dir.read() // TODO
    }
  }

  createRoot (uuid, xstat) {
    let root = new Directory(this, null, xstat)
    this.roots.set(uuid, root)
    return root
  }

  /**
  Delete all caching and indexing related to this root, idempotent

  @returns undefined
  */
  deleteRoot (uuid) {
    let dir = this.roots.get(uuid)
    if (dir) {
      dir.destroy(true)
      this.roots.delete(uuid)
    }
  }


  /*
   *
   * The following functions are for debug usage
   *
   */
  findRootDirByUUID(uuid) {
    for (let [key, dir] of this.roots) {
      if (key === uuid) return dir
    }
  }

  findDirByName(name, parentName) {
    for (let [uuid, dir] of this.uuidMap) {
      if (!parentName) {
        if (dir.name === name) return dir
      } else {
        if (dir.name === name && dir.parent && dir.parent.name === parentName) return dir
      }
    }
  }

  assertDirUUIDsIndexed (uuids) {
    let missing = uuids.filter(uuid => !this.uuidMap.has(uuid))
    if (missing.length) {
      console.log('assertion fail')
      console.log(missing)
      throw new Error('assert Dir UUIDs failed')
    }
  } 

}

module.exports = Forest

