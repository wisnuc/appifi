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
const debug = Debug('forest')

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

class Core extends EventEmitter {

  constructor (froot, mediaMap) {
    super()

    /**
    Absolute path of Fruitmix drive directory 
    */
    this.dir = path.join(froot, 'drives')

    /**
    fruitmix
    */
    this.mediaMap = mediaMap

    /**
    The collection of drive cache. Using Map for better performance 
    */ 
    this.roots = new Map()

    /**
    Indexing all directories by uuid
    */
    this.uuidMap = new Map()
    
    /**
    init dir may be in Init or Pending state, but neither idle nor reading
    */
    this.initDirs = new Set()

    /**
    dir
    */
    this.pendingDirs = new Set()

    /**
    dir in readding state
    */
    this.readingDirs = new Set()

    /**
    */
    this.hashlessFiles = new Set()

    /**
    */
    this.hashingFiles = new Set()

    /**
    */
    this.hashFailedFiles = new Set()
  }

  fileEnterHashless (file) {
    this.hashlessFiles.add(file)
  }

  fileExitHashless (file) {
    this.hashlessFiles.delete(file)
  }

  fileEnterHashing (file) {
    this.hashingFiles.add(file)
  }

  fileExitHashing (file) {
    this.hashingFiles.delete(file)
  }

  fileEnterHashFailed (file) {
    this.hashFailedFiles.add(file)
  }

  fileExitHashFailed (file) {
    this.hashFailedFiles.delete(file)
  }

  fileEnterHashed (file) {
    this.mediaMap.indexFile(file)
  }

  fileExitHashed (file) {
    this.mediaMap.unindexFile(file)
  }

  reqSchedFileHash () {
    if (this.fileHashScheduled) return
    this.fileHashScheduled = true
    process.nextTick(() => this.scheduleFileHash())
  }

  scheduleFileHash () {
    this.fileHashScheduled = false
    while (this.hashlessFiles.size > 0 && this.hashingFiles.size < 2) {
      let file = this.hashlessFiles[Symbol.iterator]().next().value
      file.calcFingerprint()
    } 
  }

  indexDirectory (dir) {
    this.uuidMap.set(dir.uuid, dir)
  }

  unindexDirectory (dir) {
    this.uuidMap.delete(dir.uuid)
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
    if (this.dirReadSettled()) return this.emit('dirReadSettled')
    while (this.initDirs.size > 0 && this.readingDirs.size < 6) {
      let uuid = this.initDirs[Symbol.iterator]().next().value
      let dir = this.uuidMap.get(uuid)
      if (dir) dir.read()
    }
  }

}

/**
*/
class Forest extends Core {

  constructor (froot, mediaMap) {
    super(froot, mediaMap)

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

  isDriveUUID (driveUUID) {
    return !!this.roots.get(driveUUID)
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
    let root = new Directory(this, null, xstat)
    this.roots.set(root.uuid, root)
  }

  // 
  createDrive (drive, callback) {
    let dirPath = path.join(this.dir, drive.uuid)
    mkdirp(dirPath, err => {
      if (err) return callback(err)
      forceXstat(dirPath, { uuid: drive.uuid }, (err, xstat) => {
        if (err) return callback(err)
        let root = new Directory(this, null, xstat)
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
