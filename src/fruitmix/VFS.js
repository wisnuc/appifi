const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const UUID = require('uuid')
const deepFreeze = require('deep-freeze')

const E = require('../lib/error')

const log = require('winston')
const xattr = require('fs-xattr')       // TODO remove
const { saveObjectAsync } = require('../lib/utils')
const autoname = require('../lib/autoname')

const Node = require('./vfs/node')
const File = require('./vfs/file')
const Directory = require('./vfs/directory')

const { btrfsConcat, btrfsClone, btrfsClone2 } = require('../lib/btrfs')

const { readXstatAsync, forceXstatAsync, forceXstat, assertDirXstatSync, assertFileXstatSync } = require('../lib/xstat')

const Debug = require('debug')
const smbDebug = Debug('samba')
const debugi = require('debug')('fruitmix:indexing')

const debug = Debug('vfs')

const Forest = require('./vfs/forest')
const { mkdir, mkfile, mvdir, mvfile, clone, send } = require('./vfs/underlying')

// TODO move to lib
const Throw = (err, code, status) => {
  err.code = code
  err.status = status
  throw err
}

const EINVAL = err => { throw Object.assign(err, 'EINVAL', 400) }
const EINCONSISTENCE = err => { throw Object.assign(err, 'EINCONSISTENCE', 503) }

/**
VFS is the core module encapsulating all virtual file system operations.

It provides three interfaces:
1. file system interface for retrieving file system information and file operations, servicing Upload  module
2. xcopy interface for copy or move files around, servicing XCopy module. 


VFS observes/reacts to User and Drive module, which is conceptually equivalent to value props in React.

VFS requires the following modules:

1. Forest, internal module for indexing
2. MediaMap, injected, which is synchronously coupled with Forest
3. Xstat, injected, which is a stateful lib
4. Underlying, internal module for operation

@module VFS
*/

/**
Policy type is used for resolving name conflict when operating on files and directories.

@typedef Policy
@type {array}
@property {string} 0 - same policy
@property {string} 1 - diff policy
*/

/**

*/
class VFS extends EventEmitter {

  /**
  Create a VFS module

  @param {object} opts
  @param {string} opts.fruitmixDir - fruitmix root directory
  @param {MediaMap} opts.mediaMap - mediamap module
  @param {User} user - user module
  @param {Drive} drive - drive module
  */
  constructor (opts, user, drive) {
    super()

    this.fruitmixDir = opts.fruitmixDir
    this.tmpDir = path.join(this.fruitmixDir, 'tmp')
    mkdirp.sync(this.tmpDir)

    // observer user
    this.user = user
    Object.defineProperty(this, 'users', { get () { return this.user.users } })
    this.user.on('Update', () => this.handleUserDriveUpdate())

    // observe drive
    this.drive = drive
    Object.defineProperty(this, 'drives', { get () { return this.drive.drives } })
    this.drive.on('Update', () => this.handleUserDriveUpdate())
    
    this.forest = new Forest(this.fruitmixDir, opts.mediaMap)
  }

  /**
  React to user and drive change, update forest.roots accordingly

  TODO doc fires
  */
  handleUserDriveUpdate () {
    let users = this.users || []
    let drives = this.drives || []

    // figure out valid drive
    let valids = drives.filter(drv => {
      if (drv.type === 'private') {
        let owner = users.find(u => u.uuid === drv.owner) 
        if (!owner) return false
        return true
      } else if (drv.type === 'public') {
        return true 
      } else {
        return false
      }
    }) 

    // all valid drive uuids that are not root
    let toBeCreated = valids
      .map(d => d.uuid)
      .filter(uuid => !this.forest.roots.has(uuid))

    // all root uuids that are not in valids
    let toBeDeleted = Array.from(this.forest.roots.keys())
      .filter(uuid => !valids.find(d => d.uuid === uuid))

    if (toBeCreated.length === 0 && toBeDeleted.length === 0) return

    let oldKeys = Array.from(this.forest.roots.keys())
    toBeDeleted.forEach(uuid => this.forest.deleteRoot(uuid))

    if (!toBeCreated.length) return this.emit('ForestUpdate', Array.from(this.forest.root.keys()))

    let count = toBeCreated.length
    toBeCreated.forEach(uuid => this.forest.createRoot(uuid, () => {
      if (!--count) {
        this.emit('ForestUpdate', Array.from(this.forest.roots.keys()), oldKeys)
      }
    }))
  }

  userCanWriteDrive (user, drive) {
    if (drive.type === 'private') {
      return user.uuid === drive.owner
    } else if (drive.type === 'public') {
      if (Array.isArray(drive.writelist)) {
        return drive.writelist.includes(user.uuid)
      } else {
        return true
      }
    } else {
      return false
    }
  }


  /**
  Try to read the dir with given dir uuid. No permission check.

  This is a best-effort function. It may be used in api layer when error is encountered.
  */
  tryDirRead (dirUUID, callback) {
    let dir = this.forest.uuidMap.get(dirUUID)
    if (dir) {
      dir.read(callback)
    } else {
      process.nextTick(() => callback(new Error('dir not found')))
    }
  }


  /**
  @param {object} user - user
  @param {object} props 
  @param {string} [driveUUID] - drive uuid
  @param {string} dirUUID - dir uuid
  @param {string} metadata - true or falsy
  @param {string} counter - true or falsy
  */
  dirGET (user, props, callback) {
    let dir, root, drive

    // find dir
    dir = this.forest.uuidMap.get(props.dirUUID)
    if (!dir) {
      let err = new Error('dir not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }

    // find root
    root = dir.root()
   
    // find drive 
    drive = this.drives.find(d => d.uuid === root.uuid)

    /**
    If driveUUID is provided, the corresponding drive must contains dir.
    */
    if (props.driveUUID && props.driveUUID !== drive.uuid) {
      let err = new Error('drive does not contain dir')
      err.status = 403
      return process.nextTick(() => callback(err))
    }

    if (!this.userCanWriteDrive(user, drive)) {
      let err = new Error('permission denied') 
      err.status = 403      // TODO 404?
      return process.nextTick(() => callback(err))
    }
     
    // TODO it is possible that dir root is changed during read 
    dir.read((err, entries) => {
      if (err) {
        err.status = 500
        callback(err)
      } else {

        let path = dir.nodepath().map(dir => ({
          uuid: dir.uuid,
          name: dir.name,
          mtime: Math.abs(dir.mtime)
        })) 

        if (props.metadata === 'true') {
          const hasMetadata = entry => 
            entry.type === 'file' 
            && Magic.isMedia(entry.magic) 
            && entry.hash 
            && this.mediaMap.hasMetadata(entry.hash)

          entries.forEach(entry => {
            if (hasMetadata(entry))
            entry.metadata = this.mediaMap.getMetadata(entry.hash)
          })
        }

        if (props.counter === 'true') {
          // TODO
        }

        callback(null, { path, entries })
      }
    })

  }

  /**
  Get a directory (asynchronized with nextTick)

  This function is API, which means it implements http resource model and provides status code.

  without drive:

  - If dir not found, 404
  - If dir.root not accessible, 404

  with drive:

  - if sdrive is not found, 404
  - if drive is deleted, 404
  - if drive is not accessible, 404 
  - if dir not found, 404 (same as w/o drive)
  - if dir.root not accessible, 404 (same as w/o drive)
  - if dir.root !== drive, 301

  @param {object} user
  @param {object} props
  @param {string} [driveUUID] - drive uuid, if provided the containing relationship is checked
  @param {string} dirUUID - directory uuid
  @returns directory object
  */
  DIR (user, props, callback) {
    let { driveUUID, dirUUID } = props
  
    // specified is the drive specified by driveUUID 
    let specified, dir, drive

    if (driveUUID) {
      specified = this.drives.find(d => d.uuid === driveUUID)
      if (!specified || specified.isDeleted || !this.userCanWriteDrive(user, specified)) {
        let err = new Error('drive not found')
        err.status = 404
        return process.nextTick(() => callback(err))
      }
    }
    
    dir = this.forest.uuidMap.get(props.dirUUID)
    if (!dir) {
      let err = new Error('dir not found')
      err.status = 404
      return callback(err)
    }

    drive = this.drives.find(d => d.uuid === dir.root().uuid)
    if (!drive || drive.isDeleted || !this.userCanWriteDrive(user, drive)) {
      let err = new Error('dir not found') 
      err.status = 404
      return callback(err)
    }

    if (driveUUID) {
      if (drive.uuid !== driveUUID) {
        let err = new Error('dir moved elsewhere')
        err.status = 301
        return callback(err)
      } 
    }

    callback(null, dir) 
  }

  /**
  Make a directory

  @param {object} user
  @param {object} props
  @param {string} [driveUUID] - drive uuid
  @param {string} dirUUID - dir uuid
  @param {string} name - dir name
  @param {Policy} policy - policy to resolve name conflict 
  @parma {boolean} read - true to read dir immediately (for indexing)
  */
  MKDIR (user, props, callback) {
    this.DIR(user, props, (err, dir) => {
      if (err) return callback(err)

      if (!props.policy) props.policy = [null, null]
 
      let target = path.join(this.absolutePath(dir), props.name)
      mkdir(target, props.policy, (err, xstat, resolved) => {
        if (err) return callback(err)

        // this only happens when skip diff policy taking effect
        if (!xstat) return callback(null, null, resolved)
        if (!props.read) return callback(null, xstat, resolved)

        dir.read((err, xstats) => {
          if (err) return callback(err)

          let found = xstats.find(x => x.uuid === xstat.uuid)
          if (!found) {
            let err = new Error(`failed to find newly created directory`)
            err.code = 'ENOENT'
            err.xcode = 'EDIRTY'
            callback(err)
          } else {
            callback(null, found, resolved)
          }
        })
      })
    })
  }

  /**
  Rename a file or directory

  @param {object} user
  @param {object} props
  @param {string} 
  */
  RENAME (user, props, callback) {
  }

  /**
  Remove a file or directory
  */
  REMOVE (user, props, callback) {
  }

  CREATE_FILE (user, props, callback) {
  }

  APPEND_FILE (user, props, callback) {
  }

  DUP_FILE (user, props, callback) {
  }

  /**
    
  */
  createFile (user, props, callback) {
    
  }

  // are we using this function ? TODO
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

  // planned to be replaced
  mvDirSync (srcDriveUUID, srcDirUUID, srcDirName, dstDriveUUID, dstDirUUID) {
    // check destination
    let dstRoot = this.roots.get(dstDriveUUID)
    if (!dstRoot) EINVAL(new Error('dst drive uuid not found'))

    let dstDir = this.uuidMap.get(dstDirUUID) 
    if (!dstDir) EINVAL(new Error('dst dir uuid not found'))
    if (dstDir.root() !== dstRoot) EINVAL(new Error('dst dir is not in dst drive'))

    // check source
    let srcRoot = this.roots.get(srcDriveUUID)
    if (!srcRoot) EINVAL(new Error('src drive uuid not found'))

    let srcDir = this.uuidMap.get(srcDirUUID)       
    if (!srcDir) EINVAL(new Error('src dir uuid not found'))
    if (srcDir.root() !== srcRoot) EINVAL(new Error('src dir is not in src drive'))
    if (srcDir.name !== srcDirName) EINVAL(new Error('src dir name mismatch'))

    // assert consistence with underlying file system
    let srcPath = srcDir.abspath()
    let dstPath = dstDir.abspath()
    try {
      assertDirXstatSync(srcPath, srcDirUUID)
      assertDirXstatSync(dstPath, dstDirUUID)
    } catch (e) {
      e.code = 'EINCONSISTENCE'
      e.status = 503
      throw e
    }

    // do rename
    try {
      fs.renameSync(srcPath, dstPath)
    } catch (e) {
      EINCONSISTENCE(e)
    }

    // reattach
    srcDir.reattach(dstDir)

    // final read
    srcDir.read()
    dstDir.read()
  }

  // Planned to be replaced
  mvFileSync (srcDriveUUID, srcDirUUID, fileUUID, fileName, dstDriveUUID, dstDirUUID) {
    // check destination
    let dstRoot = this.roots.get(dstDriveUUID)
    if (!dstRoot) EINVAL(new Error('dst drive uuid not found'))

    let dstDir = this.uuidMap.get(dstDirUUID) 
    if (!dstDir) EINVAL(new Error('dst dir uuid not found'))
    if (dstDir.root() !== dstRoot) EINVAL(new Error('dst dir is not in dst drive'))

    // check source
    let srcRoot = this.roots.get(srcDriveUUID)
    if (!srcRoot) EINVAL(new Error('src drive uuid not found'))

    let srcDir = this.uuidMap.get(srcDirUUID)       
    if (!srcDir) EINVAL(new Error('src dir uuid not found'))
    if (srcDir.root() !== srcRoot) EINVAL(new Error('src dir is not in src drive')) 

    let fn = srcDir.children.find(x => x.uuid === fileUUID)
    if (fn && fn.name !== fileName) EINVAL(new Error('file name mismatch'))

    // assert consistence with underlying file system
    let srcFilePath = path.join(srcDir.abspath(), fileName)
    let dstDirPath = dstDir.abspath()
    let dstFilePath = path.join(dstDir.abspath(), fileName)
    try {
      assertFileXstatSync(srcFilePath, fileUUID) 
      assertDirXstatSync(dstDirPath, dstDirUUID)
    } catch (e) {
      EINCONSISTENCE(e)
    }

    // assert target name does not exist
    try {
      let stat = fs.lstatSync(dstFilePath)
      let err
      if (stat.isFile()) {
        err = new Error('target file already exists')
        err.code = 'EEXIST'
      } else {
        err = new Error('traget name alreadys exists, not a regular file')
        err.code = 'ENOTFILE'
      }
      throw err
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
    }

    try {
      fs.renameSync(srcFilePath, dstFilePath)
    } catch (e) {
      throw e
    }

    if (fn) fn.reattach(dstDir)
    srcDir.read()
    dstDir.read()
  }

  //////////////////////////////////////////////////////////////////////////////
  //                                                                          // 
  // the following code are experimental
  //                                                                          //
  //////////////////////////////////////////////////////////////////////////////
  genTmpPath () {
    return path.join(this.tmpDir, UUID.v4())
  }

  absolutePath (node) {
    return node.abspath()
  }

  getDirSync (uuid) {
    let dir = this.uuidMap.get(uuid)
    if (dir) {
      return dir
    } else {
      throw new Error('dir not found')
    }
  }

  getDirPathSync (dirUUID, childName) {
    let dirPath = this.getDirSync(dirUUID).abspath()
    return childName ? path.join(dirPath, childName) : dirPath 
  }

  getDirPath (dirUUID, childName, callback) {
    try {
      let r = getDirPathSync(dirUUID, childName)
      process.nextTick(null, r)
    } catch (e) {
      process.nextTick(e)
    }
  }


  /**
  This function returns dir or throw an error

  union can be an dirUUID, or an array of dir uuids represential a partial path (reverse order).

  @param {string} driveUUID - drive uuid
  @param {string|string[]} union - dir uuid or dir uuids
  */
  getDriveDirSync (driveUUID, union) {
    let root = this.roots.get(driveUUID)
    if (!root) {
      let err = new Error(`drive ${driveUUID} not found`)
      err.code = 'ENOENT'
      throw err
    }

    let dirUUID = Array.isArray(union) ? union[0] : union
    let dir = this.uuidMap.get(dirUUID)
    if (!dir) {
      let err = new Error(`dir ${dirUUID} not found`)
      err.code = 'ENOENT'
      throw err
    }

    if (dir.root() !== root) {
      let err = new Error(`dir ${dirUUID} is not in drive ${driveUUID}`)
      err.code = 'ENOENT'
      throw err
    }

    if (Array.isArray(union)) {
      // TODO rewrite with for ???

      // reverse order
      let partial = union.join(',')
      // reverse nodepath
      let full = dir.nodepath().reverse().map(n => n.uuid).join(',')

      if (!full.startsWith(partial)) {
        let err = new Error(`invalid dir uuid path`)
        err.code = 'ENOENT'
        throw err
      }
    }

    return dir
  } 

  getDriveDirPathSync (driveUUID, union) {
    let dir = this.getDriveDirSync(driveUUID, union) 
    return dir.abspath()
  }

  /**
  !!! Important !!!
  This is the only place to read dir after making new dir
  
  @param {string} driveUUID - drive uuid
  @param {string} dirUUID - directory uuid
  @param {string} name - new directory name
  @param {string} policy - 
  */
  mkdir (dst, policy, callback) {
    let dir

    try {
      dir = this.getDriveDirSync(dst.drive, dst.dir)
    } catch (e) {
      return process.nextTick(() => callback(e))
    }

    let target = path.join(this.absolutePath(dir), dst.name)

    mkdir(target, policy, (err, xstat, resolved) => {
      try {
        dir = this.getDriveDirSync(dst.drive, dst.dir)
      } catch (e) {
        e.xcode = 'EDIRTY'
        return callback(e)
      }
      
      if (err) return callback(err) 
      if (!xstat) return callback(null, null, resolved)

      // TODO read more dirs in every case!
      // when a new dir is created:
      // 1. resolved === false
      // 2. policy === rename && resolved === true 
      // 3. policy === replace && resolved === true 
      dir.read((err, xstats) => {
        if (err) return callback(err)

        let found = xstats.find(x => x.uuid === xstat.uuid)
        if (!found) {
          let err = new Error(`failed to find newly created directory`)
          err.code = 'ENOENT'
          err.xcode = 'EDIRTY'
          return callback(err)
        } else {
          callback(null, found, resolved)
        }
      })
    })
  }


  // copy src dir (name) into dst dir
  cpdir (src, dst, policy, callback) {
    let dir, dstDir
    
    try {
      dir = this.getDriveDirSync(src.drive, src.dir) 
      dstDir = this.getDriveDirSync(dst.drive, dst.dir)

      // if dstDir is sub-dir of src, return error
      let nodepath = dstDir.nodepath()
      if (nodepath.find(n => n.uuid === src.dir)) {
        let err = new Error('invalid operation')
        err.code = 'EINVAL'
        throw err
      }
    } catch (e) {
      return process.nextTick(() => callback(e))
    }

    // this.mkdir(dst.drive, dst.dir, dir.name, policy, callback)
    this.mkdir(Object.assign({}, dst, { name: dir.name }), policy, callback)
  }

  // copy tmp file into dst dir
  mkfile (tmp, dst, policy, callback) {
    let dir
  
    try {
      dir = this.getDriveDirSync(dst.drive, dst.dir)
    } catch (e) {
      return process.nextTick(() => callback(e))
    }

    let target = path.join(this.absolutePath(dir), dst.name)
    mkfile (target, tmp.path, tmp.hash || null, policy, callback)
  }

  // copy src file into dst dir
  cpfile (src, dst, policy, callback) {
    let srcDir, dstDir

    try {
      srcDir = this.getDriveDirSync(src.drive, src.dir)
      dstDir = this.getDriveDirSync(dst.drive, dst.dir)
    } catch (e) {
      return process.nextTick(() => callback(e))
    }

    let srcFilePath = path.join(this.absolutePath(srcDir), src.name)
    let dstFilePath = path.join(this.absolutePath(dstDir), src.name)

    let tmp = this.genTmpPath()
    clone(srcFilePath, src.uuid, tmp, (err, xstat) => {
      if (err) return callback(err)
      mkfile(dstFilePath, tmp, xstat.hash, policy, (err, xstats, resolved) => {
        rimraf(tmp, () => {})
        if (err) return callback(err)

        if (!xstat || (policy[0] === 'skip' && xstat && resolved[0])) return
        else {
          try {
            let attr = JSON.parse(xattr.getSync(srcFilePath, 'user.fruitmix'))
            attr.uuid = xstats.uuid
            xattr.setSync(dstFilePath, 'user.fruitmix', JSON.stringify(attr))
          } catch (e) {
            if (e.code !== 'ENODATA') return callback(e)
          }
        }
        callback(null)
      })
    })
  }

  // move src dir into dst dir
  mvdir (src, dst, policy, callback) {
    let srcDir, dstDir

    try {
      srcDir = this.getDriveDirSync(src.drive, src.dir)
      dstDir = this.getDriveDirSync(dst.drive, dst.dir)
    } catch (e) {
      return process.nextTick(() => callback(e))
    }

    let oldPath = this.absolutePath(srcDir)
    let newPath = path.join(this.absolutePath(dstDir), srcDir.name)
    mvdir(oldPath, newPath, policy, (err, xstat, resolved) => {
      // TODO 
      // callback(err, xstat, resolved)
      if (err) return callback(err)

      if (!xstat) return callback(null, xstat, resolved)
      else {
        // srcDir.parent.read()
        // dstDir.read()
        srcDir.parent.read((err, xstats) => {
          if (err) return callback(err)
          dstDir.read((err, xstats2) => {
            callback(null, xstat, resolved)
          })
        })
        // callback(null, xstat, resolved)
      }
    })
  }

  // move src file into dst dir
  // mvfilec(srcDriveUUID, srcDirUUID, srcFileUUID, srcFileName, dstDriveUUID, dstDirUUID, policy, callback) {
  mvfile (src, dst, policy, callback) {
    let srcDir, dstDir

    try {
      srcDir = this.getDriveDirSync(src.drive, src.dir)
      dstDir = this.getDriveDirSync(dst.drive, dst.dir)
    } catch (e) {
      return process.nextTick(() => callback(e))
    }

    let oldPath = path.join(this.absolutePath(srcDir), src.name)
    let newPath = path.join(this.absolutePath(dstDir), src.name)
    mvfile(oldPath, newPath, policy, (err, xstat, resolved) => {
      // TODO
      callback(err, xstat, resolved)
    })
  }

  // clone a fruitfs file to tmp dir
  // returns tmp file path
  clone (src, callback) {
    let dir

    try {
      dir = this.getDriveDirSync(src.drive, src.dir)
    } catch (e) {
      return process.nextTick(() => callback(e))
    }

    let srcFilePath = path.join(this.absolutePath(dir), src.name)
    let tmpPath = this.genTmpPath()
    
    clone(srcFilePath, src.uuid, tmpPath, (err, xstat) => {
      if (err) return callback(err)
      callback(null, tmpPath)
    })
  }

  // readdir
  readdir(driveUUID, dirUUID, callback) {
    let dir
    try {
      dir = this.getDriveDirSync(driveUUID, dirUUID)
    } catch (e) {
      return process.nextTick(() => callback(e))
    }
    dir.read(callback)
  }

}

module.exports = VFS
