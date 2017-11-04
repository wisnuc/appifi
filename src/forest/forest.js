const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const E = require('../lib/error')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const log = require('winston')
const UUID = require('uuid')
const deepFreeze = require('deep-freeze')
const { saveObjectAsync } = require('../lib/utils')

const Node = require('./node')
const File = require('./file')
const Directory = require('./directory')

const { readXstatAsync, forceXstatAsync, forceXstat } = require('../lib/xstat')

const Debug = require('debug')
const smbDebug = Debug('samba')
const debugi = require('debug')('fruitmix:indexing')

const xfingerprint = require('../lib/xfingerprint')
const xtractMetadata = require('../lib/metadata')

/**
Forest is a collection of file system cache for each `Drive` defined in Fruitmix.

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

/**
*/
class Forest extends EventEmitter {

  constructor (froot, mediaMap) {
    super()

    /**
    fruitmix
    */
    this.mediaMap = mediaMap

    /**
    Absolute path of Fruitmix drive directory 
    */
    this.dir = path.join(froot, 'drives')

    /**
    The collection of drive cache. Using Map for better performance 
    */ 
    this.roots = new Map()

    /**
    Indexing all directories by uuid
    */
    this.uuidMap = new Map()

    /**
    Indexing all media files by file hash
    */
    this.fingerless = new Set()
    this.fingering = new Set()
    this.metalessMap = new Map()
    this.metaingMap = new Map()
    this.metaMap = new Map()

    this.filePath = path.join(froot, 'drives.json')
    this.tmpDir = path.join(froot, 'tmp')

    try {
      this.drives = JSON.parse(fs.readFileSync(this.filePath))
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
      this.drives = []
    }

    // TODO validate
    deepFreeze(this.drives)
    this.lock = false

    this.drives.forEach(drive => this.createDriveAsync(drive).then(x => x))
  }

  /// ///////////////////////////////////////////////////////////////////////////
  //
  // internal methods
  //
  //
  // From the viewpoint of DriveList, which holds a collection of in-memory 
  // caching of file system hierarchy, each node is a container for (asynchronous) workers.
  // 
  // The following methods are conceptually equivalent to event handlers in reactor model.
  // They are implemented in function form instead of
  // 1. emitter for performance reason
  // 2. callback for multiple outgoing transitions (say, destroy is a hierarchical/harel transition)
  //
  // The recursive transition MUST populate in bottom-up order, including pathChanging and destroying
  //
  /// ///////////////////////////////////////////////////////////////////////////

  // add file into fingerless, fingering, metaMap, hashingMap or hashlessMap 
  indexFile (file) {
    debugi('indexFile', Object.assign({}, {
      uuid: file.uuid,
      name: file.name,
      magic: file.magic,
      hash: file.hash,
      finger: !!file.finger,
      fingerFail: file.fingerFail,
      meta: !!file.meta,
      metaFail: file.metaFail
    }))

    if (file.hash) {
      if (this.mediaMap.has(file.hash)) { // metadata already extracted
        if (this.metaMap.has(file.hash)) {
          this.metaMap.get(file.hash).add(file)
        } else {
          this.metaMap.set(file.hash, new Set([file]))
        }
      } else { // metadata not extracted yet
        if (this.metaingMap.has(file.hash)) {
          this.metaingMap.get(file.hash).add(file)
        } else {
          if (this.metalessMap.has(file.hash)) {
            this.metalessMap.get(file.hash).add(file)
          } else {
            this.metalessMap.set(file.hash, new Set([file]))
          }

          this.requestSchedule('meta')
        }
      }
    } else { // without fingerprint
      if (file.finger) {
        this.fingering.add(file)
      } else {
        this.fingerless.add(file)
        this.requestSchedule('finger')
      }
    }
  }

  /**
  remove a single File object out of map or set

  for file in metaing map, it may influece the whole set
  */
  unindexFile (file) {
    if (file.hash) {
      let key = file.hash

      if (this.metaMap.has(key)) {
        let set = this.metaMap.get(key)
        let found = set.delete(file)
        if (!found) throw new Error('not found in meta map')
        if (set.size === 0) this.metaMap.delete(key)
      } else if (this.metaingMap.has(key)) {
        let set = this.metaingMap.get(key)
        let found = set.delete(file)
        if (!found) throw new Error('not found in metaing map')
        if (set.size === 0) {
          this.metaingMap.delete(key)
        } else {
          // the removed one holds the worker
          if (file.meta) {
            this.metaingMap.delete(key)
            console.log('before 456', this.metalessMap)
            this.metalessMap.set(key, set)
            console.log('after 456', this.metalessMap)
          }
        }
      } else if (this.metalessMap.get(key)) {
        let set = this.metalessMap.get(key)
        let found = set.delete(file)
        if (!found) throw new Error('not found in metaless map')
        if (set.size === 0) {
          console.log('789', this.metalessMap)
          this.metalessMap.delete(key)
          console.log('789', this.metalessMap)
        }
      } else {
        console.log(this)
        console.log(file)
        throw new Error('ERROR unindexFile: File object w/ hash not found in any maps')
      }
    } else { // without fingerprint
      if (this.fingering.has(file)) {
        this.fingering.delete(file)
      } else if (this.fingerless.has(file)) {
        this.fingerless.delete(file)
      } else {
        console.log(this)
        console.log(file)
        throw new Error('ERROR unindexFile: File object w/o hash not found in any sets')
      }
    }
  }

  requestSchedule (name) {
    debugi('requestSchedule', name)

    if (!['finger', 'meta'].includes(name)) {
      throw new Error('requestSchedule name must be either finger or meta')
    }

    // already scheduled
    let alreadyScheduled = this.fingerScheduled || this.metaScheduled
    if (name === 'finger') this.fingerScheduled = true
    if (name === 'meta') this.metaScheduled = true

    if (alreadyScheduled) return

    process.nextTick(() => {
      debugi('schedule ticked', this.fingerScheduled, this.metaScheduled)

      if (this.destroying || this.destroyed) return

      if (this.fingerScheduled) {
        this.scheduleFingerWorkers()
        this.fingerScheduled = false
      }

      if (this.metaScheduled) {
        this.scheduleMetaWorkers()
        this.metaScheduled = false
      }

      if (this.metaingMap.size === 0 &&
        this.metalessMap.size === 0 &&
        this.fingering.size === 0 &&
        this.fingerless.size === 0) {

        this.emit('indexingDone') 
      }
    })
  }

  // Don't use indexFile/unindexFile, which may trigger schedule
  scheduleFingerWorkers () {
    debugi('scheduling finger workers')

    while (this.fingerless.size > 0 && this.fingering.size < 2) {
      let file = this.fingerless[Symbol.iterator]().next().value
      this.fingerless.delete(file)

      file.finger = xfingerprint(file.abspath(), file.uuid, (err, xstat) => {
        this.unindexFile(file)
        file.finger = null

        if (err) {
          file.fingerFail++
        } else {
          file.fingerFail = 0
          file.name = xstat.name
          file.hash = xstat.hash
        }

        this.indexFile(file)
      })
      this.fingering.add(file)
    }
  }

  // Don't use indexFile/unindexFile, which may trigger schedule
  // remove file failed too many times TODO
  scheduleMetaWorkers () {
    debugi('scheduling meta workers')
try {
    while (this.metalessMap.size > 0 && this.metaingMap.size < 4) {
      // pull set (rather than single file) out of metaless map
      let vvv = this.metalessMap[Symbol.iterator]().next().value
      let [fingerprint, set] = vvv 

      this.metalessMap.delete(fingerprint)
      let file = Array.from(set)[0]
      file.meta = xtractMetadata(file.abspath(), file.magic, file.hash, file.uuid, (err, metadata) => {
        // pull set out of metaing map
        let set = this.metaingMap.get(file.hash)
        if (set === undefined) return // who steals it?

        this.metaingMap.delete(file.hash)
        file.meta = null

        if (err) {
          file.metaFail++
          if (file.metaFail < 5) {
            this.metalessMap.set(file.hash, set) // put into metaless map
          }
        } else {
          this.mediaMap.set(file.hash, metadata) // report metadata
          this.metaMap.set(file.hash, set) // put into meta map
        }

        this.requestSchedule('meta')
      })

      // put set back into metaing map
      this.metaingMap.set(fingerprint, set)

    }
} catch (e) {
  console.log(e)
}
  }

  onFileCreated (file) {
    file.finger = null
    file.fingerFail = 0
    file.meta = null
    file.metaFail = 0
    this.indexFile(file)
  }

  onFileUpdating (file) {
    debugi('updating file')

    this.unindexFile(file)
    if (file.finger) {
      file.finger.destroy()
      file.finger = null
      file.fingerFail = 0
    }

    if (file.meta) {
      file.meta.destroy()
      file.meta = null
      file.metaFail = 0
    }
  }

  onFileUpdated (file) {
    this.indexFile(file)
  }

  onFileDestroying (file) {
    this.unindexFile(file)
  }

  onDirectoryCreated () {
  }

  onDirectoryPathChanging () {
  }

  onDirectoryDestroying () {
  }

  /// ///////////////////////////////////////////////////////////////////////////
  //
  // external methods
  //
  /// ///////////////////////////////////////////////////////////////////////////
  async commitDrivesAsync (currDrives, nextDrives) {
    if (currDrives !== this.drives) throw E.ECOMMITFAIL()
    if (this.lock === true) throw E.ECOMMITFAIL()

    this.lock = true
    try {
      await saveObjectAsync(this.filePath, this.tmpDir, nextDrives)
      this.drives = nextDrives
      deepFreeze(this.drives)
    } finally {
      this.lock = false
    }
  }

  async createPrivateDriveAsync (owner, tag) {
    let drive = {
      uuid: UUID.v4(),
      type: 'private',
      owner,
      tag
      // label: '' // FIXME
    }

    let nextDrives = [...this.drives, drive]
    await this.commitDrivesAsync(this.drives, nextDrives)
    this.drives = nextDrives
    deepFreeze(this.drives)

    // broadcast.emit('DriveCreated', drive)    
    await this.createDriveAsync(drive)
    return drive
  }

  async createPublicDriveAsync (props) {
    let drive = {
      uuid: UUID.v4(),
      type: 'public',
      writelist: props.writelist || [],
      readlist: props.readlist || [],
      label: props.label || ''
    }

    let nextDrives = [...this.drives, drive]
    await this.commitDrivesAsync(this.drives, nextDrives)
    this.drives = nextDrives
    deepFreeze(this.drives)

    await this.createDriveAsync(drive)
    return drive
  }

  async updatePublicDriveAsync (driveUUID, props) {
    let currDrives = this.drives

    let index = this.drives.findIndex(drv => drv.uuid === driveUUID)
    if (index === -1) throw new Error('drive not found') // TODO

    let nextDrive = Object.assign({}, this.drives[index], props)
    let nextDrives = [
      ...currDrives.slice(0, index),
      nextDrive,
      ...currDrives.slice(index + 1)
    ]

    await this.commitDrivesAsync(currDrives, nextDrives)
    return nextDrive
  }

  /// ///////////////////////////////////////////////////////////////////////////

  isRoot (dir) {
    return this.roots.get(dir.uuid) === dir
  }

  isDriveUUID (driveUUID) {
    return !!this.roots.get(driveUUID)
  }

  /**
  index a directory by uuid
  */
  indexDirectory (dir) {
    this.uuidMap.set(dir.uuid, dir)
  }

  /**
  unindex a directory by uuid
  */
  unindexDirectory (dir) {
    this.uuidMap.set(dir.uuid, dir)
  }

  getDriveDirs (driveUUID) {
    return Array.from(this.uuidMap)
      .map(kv => kv[1])
      .filter(dir => dir.root().uuid === driveUUID)
      .map(dir => ({
        uuid: dir.uuid,
        parent: dir.parent ? dir.parent.uuid : '',
        name: dir.name,
        mtime: Math.abs(dir.mtime)
      }))
  }

  getDriveDir (driveUUID, dirUUID) {
    let drive = this.roots.get(driveUUID)
    let dir = this.uuidMap.get(dirUUID)
    if (!drive || !dir || dir.root() !== drive) return

    return dir
  }

  /**
  Create the file system cache for given `Drive` 

  @param {Drive}
  */
  async createDriveAsync (drive, monitor) {
    let dirPath = path.join(this.dir, drive.uuid)
    await mkdirpAsync(dirPath)

    let xstat = await forceXstatAsync(dirPath, { uuid: drive.uuid })
    let root = new Directory(this, null, xstat, monitor)
    this.roots.set(root.uuid, root)
  }

  // 
  createDrive (drive, monitor, callback) {
    if (typeof monitor === 'function') {
      callback = monitor
      monitor = null
    }

    let dirPath = path.join(this.dir, drive.uuid)
    mkdirp(dirPath, err => {
      if (err) return callback(err)
      forceXstat(dirPath, { uuid: drive.uuid }, (err, xstat) => {
        if (err) return callback(err)
        let root = new Directory(this, null, xstat, monitor)
        this.roots.set(root.uuid, root)
        callback()
      })
    }) 
  }

  /**
  Delete the file system cache for the drive identified by given uuid

  @param {string} driveUUID
  */
  deleteDrive (driveUUID) {
    let index = this.roots.findIndex(d => d.uuid === driveUUID)
    if (index === -1) return

    this.roots[index].destroy()
    this.roots.splice(index, 1)
  }

  /**
  Get directory path by drive uuid and dir uuid

  @param {string} driveUUID
  @param {string} dirUUID - directory uuid
  */
  directoryPath (driveUUID, dirUUID) {
    let drive = this.roots.get(driveUUID)
    let dir = this.uuidMap.get(dirUUID)

    if (!drive || !dir || dir.root() !== drive) return

    return dir.abspath()
  }

  /**
  Get file path by drive uuid, dir uuid, and file name
  */
  filePath (driveUUID, dirUUID, name) {
    let dirPath = this.directoryPath(driveUUID, dirUUID)

    if (!dirPath) return

    return path.join(dirPath, name)
  }

  // TODO filter by drives
  getFingerprints (drives) {
    return Array.from(this.metaMap).map(kv => kv[0])
  }

  // TODO filter by drives
  getFilesByFingerprint (fingerprint, drives) {
    let fileSet = this.metaMap.get(fingerprint)
    if (!fileSet) return []

    let arr = []
    fileSet.forEach(f => arr.push(f.abspath()))
    return arr
  }

  /**
  Walk down
 
  @param {Directory} dir - `Directory` object as the starting point of the walk 
  @param {string[]} names - names array to walk
  @returns {Directory[]} `Directory` object array starting from the givne dir
  */
  dirWalk (dir, names) {
    let q = [dir]
    for (let i = 0; i < names.length; i++) {
      let child = dir.directories.find(d => d.name === names[i])
      if (child) {
        q.push(child)
        dir = child
      } else { return q }
    }
  }

  // what is a fix?
  reportPathError (abspath, code) {
    // not a frutimix drive path FIXME check slash
    if (!abspath.startsWith(this.dir)) return

    let names = abspath
      .slice(this.dir.length)
      .split(path.sep)
      .filter(name => name.length > 0)

    // check names[0] is uuid TODO 

    let root = this.roots.find(r => r.name === names[0])
    if (!root) return

    let q = this.nameWalk(names, root)
  }

  async mkdirAsync (parent, name) {
    if (!(parent instanceof Directory)) { throw new Error('mkdirAsync: parent is not a dir node') }

    let dirPath = path.join(parent.abspath(), name)
    await fs.mkdirAsync(dirPath)
    let xstat = await readXstatAsync(dirPath)
    let node = new Directory(this, xstat)
    node.attach(parent)
    return node
  }

  async renameDirAsync (node, name) {
    let oldPath = node.abspath()
    let newPath = path.join(path.dirname(oldPath), name)
    await fs.renameAsync(oldPath, newPath)
    let xstat = await readXstatAsync(newPath)

    // TODO node.uuid === xstat.uuid ?

    node.name = xstat.name
    return node
  }

  audit (drivePath, relPath1, relPath2) {
    let rootDir
    this.roots.forEach(dir => {
      if (dir.abspath() === drivePath) rootDir = dir
    })

    if (!rootDir) {
      console.log(`warning: (drive audit) root dir not found for ${drivePath}`)
      return
    }

    let relPath = relPath2 || relPath1
    let names = relPath.split(path.sep).filter(x => !!x)
    let dir = rootDir.nameWalk(names)

    smbDebug(`audit walk to ${dir.abspath()}`)

    // delay 1s
    dir.read(1000)
  }

}

module.exports = Forest
