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

const Node = require('./node')
const File = require('./file')
const Directory = require('./directory')

const { readXstatAsync, forceXstatAsync } = require('../lib/xstat')

const broadcast = require('../../common/broadcast')

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

  constructor() {

    super()

    this.initialized = false

    /**
    Absolute path of Fruitmix drive directory 
    */
    this.dir = undefined

    /**
    The collection of drive cache. Using Map for better performance 
    */ 
    this.roots = undefined

    /**
    Indexing all directories by uuid
    */
    this.uuidMap = undefined

    /**
    Indexing all media files by file hash
    */
    this.hashMap = undefined

    broadcast.on('FruitmixStart', froot => this.init(path.join(froot, 'drives')))
    broadcast.on('FruitmixStop', () => this.deinit())

    broadcast.on('DriveCreated', drive => 
      this.createDriveAsync(drive)
        .then(x => x, err => console.log(err)))
  }

  isRoot(dir) {
    return this.roots.get(dir.uuid) === dir
  }

  isDriveUUID(driveUUID) {
    return !!this.roots.get(driveUUID)
  }

  /**
  index a directory by uuid
  */
  indexDirectory(dir) {
    this.uuidMap.set(dir.uuid, dir)
  }

  /**
  unindex a directory by uuid
  */
  unindexDirectory(dir) {
    this.uuidMap.set(dir.uuid, dir)
  }

  getDriveDirs(driveUUID) {

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

  getDriveDir(driveUUID, dirUUID) {

    let drive = this.roots.get(driveUUID)
    let dir = this.uuidMap.get(dirUUID) 
    if (!drive || !dir || dir.root() !== drive) return

    return dir  
  }

  getDirectoryByUUID(uuid) {
 
  }

  /**
  index a file by file hash
  */
  index(file) {
    if (this.hashMap.has(file.hash)) 
      this.hashMap.get(file.hash).add(file)
    else 
      this.hashMap.set(file.hash, new Set([file]))
  }

  /**
  unindex a file by file hash
  */
  unindex(file) {
    this.hashMap.get(file.hash).delete(file)
  }

  /**
  Initialize 

  @param {string} drivesDir
  */
  init(dir) {

    if (this.initialized) 
      throw new Error('forest already initialized')

    this.initialized = true
    this.dir = dir
    this.roots = new Map()
    this.uuidMap = new Map()
    this.hashMap = new Map()

    process.nextTick(() => broadcast.emit('ForestInitDone'))
  }

  deinit() {

    this.initialized = false
    this.dir = undefined
    this.roots = undefined
    this.uuidMap = undefined
    this.hashMap = undefined
  }

  

  /**
  Create the file system cache for given `Drive` 

  @param {Drive}
  */
  async createDriveAsync(drive, monitor) {
    
    let dirPath = path.join(this.dir, drive.uuid) 
    await mkdirpAsync(dirPath)

    let xstat = await forceXstatAsync(dirPath, { uuid: drive.uuid })
    let root = new Directory(this, null, xstat, monitor)
    this.roots.set(root.uuid, root)
  }    

  /**
  Delete the file system cache for the drive identified by given uuid

  @param {string} driveUUID
  */
  deleteDrive(driveUUID) {
  
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
  directoryPath(driveUUID, dirUUID) {

    let drive = this.roots.get(driveUUID)
    let dir = this.uuidMap.get(dirUUID) 

    if (!drive || !dir || dir.root() !== drive) return

    return dir.abspath()
  }

  /**
  Get file path by drive uuid, dir uuid, and file name
  */
  filePath(driveUUID, dirUUID, name) {

    let dirPath = this.directoryPath(driveUUID, dirUUID)

    if (!dirPath) return

    return path.join(dirPath, name)
  }

  /**
  Walk down
 
  @param {Directory} dir - `Directory` object as the starting point of the walk 
  @param {string[]} names - names array to walk
  @returns {Directory[]} `Directory` object array starting from the givne dir
  */
  dirWalk(dir, names) {

    let q = [dir]
    for (i = 0; i < names.length; i++) {
      let child = dir.directories.find(d => d.name === names[i])
      if (child) {
        q.push(child)
        dir = child
      }
      else 
        return q
    }
  }

  // what is a fix?
  reportPathError(abspath, code) {

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

  async mkdirAsync(parent, name) {

    if (!parent instanceof Directory) 
      throw new Error('mkdirAsync: parent is not a dir node')

    let dirPath = path.join(parent.abspath(), name)
    await fs.mkdirAsync(dirPath)
    let xstat = await readXstatAsync(dirPath)
    let node = new Directory(this, xstat)
    node.attach(parent)
    return node
  }

  async renameDirAsync(node, name) {

    let oldPath = node.abspath()
    let newPath = path.join(path.dirname(oldPath), name)
    await fs.renameAsync(oldPath, newPath)
    let xstat = await readXstatAsync(newPath)

    // TODO node.uuid === xstat.uuid ?
   
    node.name = xstat.name
    return node
  }
}

module.exports = new Forest()

