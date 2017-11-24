const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')

const debug = require('debug')('xcopy')

const { 
  Directory,
  CopyDirectory,
  MoveDirectory,
  ImportDirectory,
  ExportDirectory
} = require('./directory')

const { 
  File,
  CopyFile,
  MoveFile,
  ImportFile,
  ExportFile
} = require('./file')

/**
Split different task into different sub-class is a better practice since the proxied methods
may be different
*/

/**
Base class
*/
class Base extends EventEmitter {

  // if user is not provided, ctx is vfs, otherwise, it is fruitmix
  constructor (ctx, user, policies) {
    super()
    this.ctx = ctx
    this.user = user
    this.policies = policies || { dir: [], file: [] }

    this.pendingFiles = new Set()
    this.workingFiles = new Set()
    this.conflictFiles = new Set()
    this.failedFiles = new Set()

    this.pendingDirs = new Set()
    this.makingDirs = new Set()
    this.readingDirs = new Set()
    this.readDirs = new Set()
    this.conflictDirs = new Set()
    this.failedDirs = new Set()
  }

  destroy () {
    this.root.destroy()
  }

  // not implemented TODO
  pause () {
  } 

  // not implemented TODO
  resume () {
  }


  //////////////////////////////////////////////////////////////////////////////
  //
  // state machine
  //
  //////////////////////////////////////////////////////////////////////////////

  formatDir (dir) {
    // TODO this does not work for fruit or native fs
    // it's better to keep a copy of srcName in dir
    return `${dir.constructor.name} ${dir.srcUUID || dir.srcPath} ${dir.srcName}`
  }

  formatFile (file) {
    return `${file.constructor.name} ${file.srcUUID} ${file.srcName}`
  }

  indexPendingFile (file) {
    debug(`file ${this.formatFile(file)} enter pending`)    
    this.pendingFiles.add(file) 
    this.reqSched()
  }

  unindexPendingFile (file) {
    debug(`file ${this.formatFile(file)} exit pending`)    
    this.pendingFiles.delete(file) 
  }

  indexWorkingFile (file) {
    debug(`file ${this.formatFile(file)} enter working`)    
    this.workingFiles.add(file)   
  }

  unindexWorkingFile (file) {
    debug(`file ${this.formatFile(file)} exit working`)
    this.workingFiles.delete(file)
    this.reqSched()
  }

  indexFinishedFile (file) {
    debug(`file ${this.formatFile(file)} enter finished`) 
  }

  unindexFinishedFile (file) {
    debug(`file ${this.formatFile(file)} exit finished`) 
  }

  indexConflictFile (file) {
    debug(`file ${this.formatFile(file)} enter conflict`)
    this.conflictFiles.add(file)
  }

  unindexConflictFile (file) {
    debug(`file ${this.formatFile(file)} exit conflict`)
    this.conflictFiles.delete(file) 
  }

  indexFailedFile (file) {
    debug(`file ${this.formatFile(file)} enter failed`)
    this.failedFiles.add(file)
  }

  unindexFailedFile (file) {
    debug(`file ${this.formatFile(file)} enter failed`)
    this.failedFiles.delete(file)
  }

  indexPendingDir (dir) {
    debug(`${this.formatDir(dir)} enter pending`)    
    this.pendingDirs.add(dir)
    this.reqSched()
  }

  unindexPendingDir (dir) {
    debug(`${this.formatDir(dir)} exit pending`)    
    this.pendingDirs.delete(dir)
  }

  indexWorkingDir (dir) {
    debug(`${this.formatDir(dir)} enter making (dst)`)
    this.makingDirs.add(dir)
  }

  unindexWorkingDir (dir) {
    debug(`${this.formatDir(dir)} exit making (dst)`)
    this.makingDirs.delete(dir)
    this.reqSched()
  }

  indexReadingDir (dir) {
    debug(`${this.formatDir(dir)} enter reading (src)`)
    this.readingDirs.add(dir)
  }

  unindexReadingDir (dir) {
    debug(`${this.formatDir(dir)} exit reading`)
    this.readingDirs.delete(dir)
    this.reqSched()
  }

  indexReadDir (dir) {
    debug(`${this.formatDir(dir)} enter read`)
    this.readDirs.add(dir)
  }

  unindexReadDir (dir) {
    debug(`${this.formatDir(dir)} exit read`)
    this.readDirs.delete(dir)
  }

  indexFinishedDir (dir) {
    debug(`${this.formatDir(dir)} enter finished`)
  }

  unindexFinishedDir (dir) {
    debug(`${this.formatDir(dir)} exit finished`)    
  }

  indexConflictDir (dir) {
    debug(`${this.formatDir(dir)} enter conflict`)
    this.conflictDirs.add(dir)
  }

  unindexConflictDir (dir) {
    debug(`${this.formatDir(dir)} exit conflict`)
    this.conflictDirs.delete(dir)
  }

  indexFailedDir (dir) {
    debug(`${this.formatDir(dir)} enter failed`)
    this.failedDirs.add(dir) 
  }

  unindexFailedDir (dir) {
    debug(`${this.formatDir(dir)} exit failed`)
    this.failedDirs.delete(dir) 
  }

  reqSched () {
    if (this.scheduled) return
    this.scheduled = true
    process.nextTick(() => this.schedule())
  }

  activeParents () {
    // active parents are dirs containing pending or working files
    return new Set(Array.from(new Set([...this.pendingFiles, ...this.workingFiles])).map(f => f.parent))
  }

  // dir pending -> making -> reading -> read
  schedule () {
    this.scheduled = false

    // console.log('schedule begin >>>>')

    // schedule file job
    while (this.pendingFiles.size > 0 && this.workingFiles.size < 1) {
      let file = this.pendingFiles[Symbol.iterator]().next().value
      file.setState('Working')
    }

    // schedule dir job
    while (this.pendingDirs.size > 0 && 
      this.activeParents().size + this.makingDirs.size + this.readingDirs.size < 2) { 
      let dir = this.pendingDirs[Symbol.iterator]().next().value
      dir.setState('Working')  
    } 

    if (this.makingDirs.size + this.readingDirs.size + this.workingFiles.size === 0) {
      process.nextTick(() => this.emit('stopped'))
    }

    // console.log('schedule end <<<<')
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  //  external/api interface
  //
  //  1. view hierarchy
  //  2. update policy
  //  3. pause / resume / auto-stop
  //  4. destroy (cancel)
  //
  //////////////////////////////////////////////////////////////////////////////
  view () {
    
    let nodes = []
    if (this.root) {
      this.root.visit(n => nodes.push(n.view()))
    }
    return {
      mode: this.mode,
      nodes
    }
  }

  setPolicy (srcUUID, type, policy, applyToAll) {
    let node = this.root.find(n => n.srcUUID === srcUUID)
    if (!node) throw new Error('not found')

    node.setPolicy(type, policy)

    if (applyToAll) {
      let name = node instanceof Directory ? 'dir' : 'file'
      let index = type === 'same' ? 0 : 1
      this.policies[name][index] = policy
    }
  }

  /////////////////////////////////////////////////////////////////////////////
  //
  // vfs/fruitfs operation proxy
  //
  //////////////////////////////////////////////////////////////////////////////


  mkdir(dirUUID, name, policy, callback) {
    if (this.user) {
      this.ctx.mkdir(this.user, dirUUID, name, policy, callback)
    } else {
      this.ctx.mkdir(dirUUID, name, policy, callback)
    }
  } 

  // mkdirc make a new dir with name from an existing dir
  mkdirc (srcDirUUID, dstDirUUID, policy, callback) {
    if (this.user) {
      this.ctx.mkdirc(
        this.user, 
        this.srcDriveUUID, 
        srcDirUUID, 
        this.dstDriveUUID, 
        dstDirUUID, policy, 
        callback
      )
    } else {
      this.ctx.mkdirc(
        this.srcDriveUUID, 
        srcDirUUID, 
        this.dstDriveUUID, 
        dstDirUUID, 
        policy, callback
      )
    }
  }

  cpFile (srcDirUUID, fileUUID, fileName, dstDirUUID, policy, callback) {
    if (this.user) {
      this.ctx.copy(
        this.user,
        this.srcDriveUUID, 
        srcDirUUID, fileUUID, 
        fileName, 
        this.dstDriveUUID, 
        dstDirUUID, 
        policy, 
        callback
      )
    } else {
      this.ctx.copy(
        this.srcDriveUUID, 
        srcDirUUID, fileUUID, 
        fileName, 
        this.dstDriveUUID, 
        dstDirUUID, 
        policy, 
        callback
      )
    }
  }

  mvdirc (srcDirUUID, dstDirUUID, policy, callback) {
    if (this.user) {
    } else {
      this.ctx.mvdirc(
        this.srcDriveUUID, 
        srcDirUUID, 
        this.dstDriveUUID, 
        dstDirUUID, 
        policy, callback
      )
    }
  }

  mvfilec (srcDirUUID, srcFileUUID, srcFileName, dstDirUUID, policy, callback) {
    if (this.user) {
    } else {
      this.ctx.mvfilec(
        this.srcDriveUUID,
        srcDirUUID,
        srcFileUUID,
        srcFileName,
        this.dstDriveUUID,
        dstDirUUID,
        policy,
        callback
      )
    }
  }

}

class Copy extends Base {

  constructor (ctx, user, policies, src, dst, xstats) {
    super(ctx, user, policies)
    this.srcDriveUUID = src.drive
    this.dstDriveUUID = dst.drive
    this.root = new CopyDirectory(this, null, src.dir, dst.dir, xstats)
  }

  readdir(srcDirUUID, callback) {
    this.ctx.readdir(this.srcDriveUUID, srcDirUUID, callback)
  }
}

class Move extends Base {

  constructor (ctx, user, policies, src, dst, xstats) {
    super(ctx, user, policies)
    this.srcDriveUUID = src.drive
    this.dstDriveUUID = dst.drive
    this.root = new MoveDirectory(this, null, src.dir, dst.dir, xstats)
  }

  // same as copy
  readdir(srcDirUUID, callback) {
    this.ctx.readdir(this.srcDriveUUID, srcDirUUID, callback)
  }
}

class Import extends Base {

  constructor (ctx, user, policies, src, dst, stats) {
    super(ctx, user, policies)
    this.srcPath = src.path
    this.dstDriveUUID = dst.drive
    this.root = new ImportDirectory(this, null, this.srcPath, dst.dir, stats)
  }

  genTmpPath () {
    return this.ctx.genTmpPath()
  }

  mkdir(dirUUID, name, policy, callback) {
    this.ctx.mkdir(this.dstDriveUUID, dirUUID, name, policy, callback)
  }

  mkfile (dirUUID, fileName, tmp, hash, policy, callback) {
    this.ctx.mkfile(this.dstDriveUUID, dirUUID, fileName, tmp, hash, policy, callback)
  }
}

class Export extends Base {

  constructor (ctx, user, policies, src, dst, xstats) {
    super(ctx, user, policies)
    this.srcDriveUUID = src.drive
    this.dstPath = dst.path
    this.root = new ExportDirectory(this, null, src.dir, '', this.dstPath, xstats)
  }

  readdir(srcDirUUID, callback) {
    this.ctx.readdir(this.srcDriveUUID, srcDirUUID, callback)
  }

  clone(dirUUID, fileUUID, fileName, callback) {
    this.ctx.clone(this.srcDriveUUID, dirUUID, fileUUID, fileName, callback)
  }

}

// return formatted policies 
const formatPolicies = policies => {

  const vs = [undefined, null, 'skip', 'replace', 'rename']
  const obj = { dir: [], file: [] }  

  if (policies === undefined || policies === null) return obj

  if (typeof policies !== 'object') throw new Error('policies is not an object')

  if (policies.hasOwnProperty('dir')) {
    if (!Array.isArray(policies.dir)) throw new Error('policies.dir is not an array')
    if (!vs.includes(policies.dir[0])) throw new Error('invalid policies.dir[0]')
    if (!vs.includes(policies.dir[1])) throw new Error('invalid policies.dir[1]')
    obj.dir = policies.dir.slice(0, 2)
  } 

  if (policies.hasOwnProperty('file')) {
    if (!Array.isArray(policies.file)) throw new Error('policies.file is not an array')
    if (!vs.includes(policies.file[0])) throw new Error('invalid policies.file[0]')
    if (!vs.includes(policies.file[1])) throw new Error('invalid policies.file[1]')
    obj.file = policies.file.slice(0, 2)
  } 

  return obj
}

// entries are uuids
// returns xstats or throw error
const entriesToXstats = (ctx, user, driveUUID, dirUUID, entries, callback) => {
  if (user) {
    // TODO 
  } else {
    ctx.readdir(driveUUID, dirUUID, (err, xstats) => {
      if (err) return callback(err)
      let found = []    // xstats
      let missing = []  // uuids

      entries.forEach(uuid => {
        let x = xstats.find(x => x.uuid === uuid)
        if (x) {
          found.push(x)
        } else {
          missing.push(uuid)
        }
      })

      if (missing.length) {
        let err = new Error('some entries are missing')
        err.missing = missing
        callback(err)
      } else {
        callback(null, found)
      }
    })
  }
}

// entries are names
// returns stats or throw error
const entriesToStats = (dirPath, entries, callback) => 
  fs.readdir(dirPath, (err, files) => {
    if (err) return callback(err)

    if (files.length === 0) {
      let err = new Error('all entries are missing')
      err.missing = [...entries]
      return callback(err)
    }

    let found = []    // names
    let missing = []  // names

    entries.forEach(name => files.includes(name) ? found.push(name) : missing.push(name))

    if (missing.length) {
      let err = new Error('some entries are missing')
      err.missing = missing
      callback(err)
    } else {

      let count = entries.length 
      let stats = []
      entries.forEach(name => {
        fs.lstat(path.join(dirPath, name), (err, stat) => {
          if (!err) {
            if (stat.isDirectory()) {
              stats.push({
                type: 'directory',
                name
              })
            } else if (stat.isFile()) {
              stats.push({
                type: 'file',
                name,
                size: stat.size,
                mtime: stat.mtime.getTime()
              })
            } else {

            }
          }

          if (!--count) {
            callback(null, stats)
          }
        }) 
      })
    }
  })


/**
Create a xcopy machine.

@param {object} ctx - reference fruitmix or vfs (if user is not provided)
@param {object} user - user object
@parma {string} mode - copy, move, import, export
@param {object} src - { drive, dir } or { path }
@param {object} dst - { drive, dir } or { path }
@param {object} entries - array of uuid or names to be copied
@param {object} policies - { dir, file }
@param {function} callback - `(err, xcopy) => {}`
*/
const xcopy = (ctx, user, mode, policies, src, dst, entries, callback) => {

  try {
    policies = formatPolicies(policies) 
  } catch (e) {
    return process.nextTick(() => callback(e))
  }

  if (user) {
  } 

  if (mode === 'copy' || mode === 'move' || mode === 'export') {
    entriesToXstats(ctx, user, src.drive, src.dir, entries, (err, xstats) => {
      if (err) return callback(err)
      let X = mode === 'copy' ? Copy : mode === 'move' ? Move : Export
      callback(null, new X(ctx, user, policies, src, dst, xstats))
    })
  } else if (mode === 'import') {
    entriesToStats(src.path, entries, (err, stats) => {
      if (err) return callback(err) 
      callback(null, new Import(ctx, user, policies, src, dst, stats))
    })
  }
}

module.exports = xcopy
