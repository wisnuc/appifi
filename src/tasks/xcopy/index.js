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

class XBase extends EventEmitter {

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

  pause () {
  } 

  resume () {
  }


  //////////////////////////////////////////////////////////////////////////////
  //
  // state machine
  //
  //////////////////////////////////////////////////////////////////////////////

  formatDir (dir) {
    return `${dir.srcUUID} ${this.ctx.uuidMap.get(dir.srcUUID).name}`
  }

  formatFile (file) {
    return `${file.srcUUID} ${file.srcName}`
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
    debug(`dir ${this.formatDir(dir)} enter pending`)    
    this.pendingDirs.add(dir)
    this.reqSched()
  }

  unindexPendingDir (dir) {
    debug(`dir ${this.formatDir(dir)} exit pending`)    
    this.pendingDirs.delete(dir)
  }

  indexWorkingDir (dir) {
    debug(`dir ${this.formatDir(dir)} enter making (dst)`)
    this.makingDirs.add(dir)
  }

  unindexWorkingDir (dir) {
    debug(`dir ${this.formatDir(dir)} exit making (dst)`)
    this.makingDirs.delete(dir)
    this.reqSched()
  }

  indexReadingDir (dir) {
    debug(`dir ${this.formatDir(dir)} enter reading (src)`)
    this.readingDirs.add(dir)
  }

  unindexReadingDir (dir) {
    debug(`dir ${this.formatDir(dir)} exit reading`)
    this.readingDirs.delete(dir)
    this.reqSched()
  }

  indexReadDir (dir) {
    debug(`dir ${this.formatDir(dir)} enter read`)
    this.readDirs.add(dir)
  }

  unindexReadDir (dir) {
    debug(`dir ${this.formatDir(dir)} exit read`)
    this.readDirs.delete(dir)
  }

  indexFinishedDir (dir) {
    debug(`dir ${this.formatDir(dir)} enter finished`)
  }

  unindexFinishedDir (dir) {
    debug(`dir ${this.formatDir(dir)} exit finished`)    
  }

  indexConflictDir (dir) {
    debug(`dir ${this.formatDir(dir)} enter conflict`)
    this.conflictDirs.add(dir)
  }

  unindexConflictDir (dir) {
    debug(`dir ${this.formatDir(dir)} exit conflict`)
    this.conflictDirs.delete(dir)
  }

  indexFailedDir (dir) {
    debug(`dir ${this.formatDir(dir)} enter failed`)
    this.failedDirs.add(dir) 
  }

  unindexFailedDir (dir) {
    debug(`dir ${this.formatDir(dir)} exit failed`)
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
      file.setState(file.Working)
    }

    // schedule dir job
    while (this.pendingDirs.size > 0 && 
      this.activeParents().size + this.makingDirs.size + this.readingDirs.size < 2) { 
      let dir = this.pendingDirs[Symbol.iterator]().next().value
      dir.setState(dir.Working)  
    } 

    if (this.makingDirs.size + this.readingDirs.size + this.workingFiles.size === 0) {
      process.nextTick(() => this.emit('stopped'))
    }

    // console.log('schedule end <<<<')
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

  mvfilec (srcDirUUID, srcFileUUID, srcFilename, dstDirUUID, policy, callback) {
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

}

class XCopy extends XBase {

  constructor (ctx, user, policies, src, dst, xstats) {
    super(ctx, user, policies)
    this.srcDriveUUID = src.drive
    this.dstDriveUUID = dst.drive
    this.root = new CopyDirectory(this, null, src.dir, dst.dir, xstats)
    this.root.on('finish', () => {})
  }
}

class XMove extends XBase {
  constructor (ctx, user, policies, src, dst, xstats) {
    super(ctx, user, policies)
    this.srcDriveUUID = src.drive
    this.dstDriveUUID = dst.drive
    this.root = new MoveDirectory(this, null, src.dir, dst.dir, xstats)
    this.root.on('finish', () => {})
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
const xcopy = (ctx, user, mode, src, dst, entries, policies, callback) => {
  if (typeof policies === 'function') {
    callback = policies
    policies = null
  }

  try {
    policies = formatPolicies(policies)
  } catch (e) {
    return process.nextTick(() => callback(e))
  }

  ctx.readdir(src.dir, (err, xstats) => {
    if (err) return callback(err)

    let found = []   // xstat
    let missing = []  // uuid

    entries.forEach(ent => {
      let x = xstats.find(x => x.uuid === ent)
      if (x) {
        found.push(x)
      } else {
        missing.push(ent)
      }
    })

    if (missing.length) {
      callback(new Error('missing'))
    } else {

      if (mode === 'copy') {
        let xc = new XCopy(ctx, user, policies, src, dst, xstats)
        callback(null, xc)
      } else if (mode === 'move') {
        let xc = new XMove(ctx, user, policies, src, dst, xstats)
        callback(null, xc)
      } else {
        let err = new Error('unsupported')
        callback(err)
      }
    }
  })
}

module.exports = xcopy
