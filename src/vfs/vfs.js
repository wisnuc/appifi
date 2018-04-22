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
const xattr = require('fs-xattr')
const { saveObjectAsync } = require('../lib/utils')
const autoname = require('../lib/autoname')

const Node = require('./node')
const File = require('./file')
const Directory = require('./directory')

const { btrfsConcat, btrfsClone, btrfsClone2 } = require('../lib/btrfs')

const { 
  readXstatAsync, forceXstatAsync, forceXstat, 
  assertDirXstatSync, assertFileXstatSync
} = require('../lib/xstat')

const Debug = require('debug')
const smbDebug = Debug('samba')
const debugi = require('debug')('fruitmix:indexing')

const debug = Debug('vfs')

const Forest = require('./forest')
const { mkdir, mkfile, mvdir, mvfile, clone, send } = require('./underlying')

// TODO move to lib
const Throw = (err, code, status) => {
  err.code = code
  err.status = status
  throw err
}

const EINVAL = err => { throw Object.assign(err, 'EINVAL', 400) }
const EINCONSISTENCE = err => { throw Object.assign(err, 'EINCONSISTENCE', 503) }


/**
VFS inherits from Forest. It adds virtual drive logic.
*/
class VFS extends Forest {

  constructor (froot, mediaMap) {
    super(froot, mediaMap)

    this.filePath = path.join(froot, 'drives.json')
    this.tmpDir = path.join(froot, 'tmp')

    mkdirp.sync(this.tmpDir)

    try {
      this.drives = JSON.parse(fs.readFileSync(this.filePath))
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
      this.drives = []
    }

    //
    let bid = this.drives.find(drv => drv.type === 'public' && drv.tag === 'built-in')
    if (!bid) {
      this.drives.push({
        uuid: UUID.v4(),
        type: 'public',
        writelist: '*',
        readlist: '*',
        label: '',
        tag: 'built-in' 
      })

      let tmpPath = path.join(this.tmpDir, UUID.v4())
      fs.writeFileSync(tmpPath, JSON.stringify(this.drives, null, '  '))
      fs.renameSync(tmpPath, this.filePath)
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

  // TODO
  createPublicDrive (props, callback) {
    let drive = {
      uuid: UUID.v4(),
      type: 'public',
      writelist: props.writelist || [],
      readlist: props.readlist || [],
      label: props.label || ''
    }
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
  Create the file system cache for given `Drive` 

  @param {Drive}
  */
  async createDriveAsync (drive) {

    debug('vfs.createDriveAsync', drive)

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


  /************************
  new methods
  *************************/


}

module.exports = VFS




