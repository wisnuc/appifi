const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')

const UUID = require('uuid')
const debug = require('debug')('xcopy')

const { Dir, DirCopy, DirMove, DirImport, DirExport } = require('./dirs')
const { File, FileCopy, FileMove, FileImport, FileExport } = require('./files')

/**
Xcopy as a namespace
@namespace XCopy
*/

/**
Base class

This is a container of a collection of sub-tasks, organized in a tree.
*/
class Base extends EventEmitter {

  // if user is not provided, ctx is vfs, otherwise, it is fruitmix
  constructor (ctx, user, policies, src, dst, entries) {
    super()
    this.ctx = ctx
    this.user = user
    this.uuid = UUID.v4()
    this.policies = policies || { dir: [], file: [] }
    this.src = src
    this.dst = dst
    this.entries = entries

    this.pendingFiles = new Set()
    this.workingFiles = new Set()
    this.conflictFiles = new Set()
    this.failedFiles = new Set()

    this.pendingDirs = new Set()
    this.workingDirs = new Set()
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
    return `${file.constructor.name} ${file.srcUUID || file.srcPath} ${file.srcName}`
  }

  indexPendingFile (file) {
    debug(`${this.formatFile(file)} enter pending`)    
    this.pendingFiles.add(file) 
    this.reqSched()
  }

  unindexPendingFile (file) {
    debug(`${this.formatFile(file)} exit pending`)    
    this.pendingFiles.delete(file) 
  }

  indexWorkingFile (file) {
    debug(`${this.formatFile(file)} enter working`)    
    this.workingFiles.add(file)   
  }

  unindexWorkingFile (file) {
    debug(`${this.formatFile(file)} exit working`)
    this.workingFiles.delete(file)
    this.reqSched()
  }

  indexFinishedFile (file) {
    debug(`${this.formatFile(file)} enter finished`) 
  }

  unindexFinishedFile (file) {
    debug(`${this.formatFile(file)} exit finished`) 
  }

  indexConflictFile (file) {
    debug(`${this.formatFile(file)} enter conflict`)
    this.conflictFiles.add(file)
  }

  unindexConflictFile (file) {
    debug(`${this.formatFile(file)} exit conflict`)
    this.conflictFiles.delete(file) 
  }

  indexFailedFile (file) {
    debug(`${this.formatFile(file)} enter failed`)
    this.failedFiles.add(file)
  }

  unindexFailedFile (file) {
    debug(`${this.formatFile(file)} enter failed`)
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
    this.workingDirs.add(dir)
  }

  unindexWorkingDir (dir) {
    debug(`${this.formatDir(dir)} exit making (dst)`)
    this.workingDirs.delete(dir)
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

    // schedule file job
    while (this.pendingFiles.size > 0 && this.workingFiles.size < 1) {
      let file = this.pendingFiles[Symbol.iterator]().next().value
      file.setState('Working')
    }

    // schedule dir job
    while (this.pendingDirs.size > 0 && 
      this.activeParents().size + this.workingDirs.size + this.readingDirs.size < 2) { 
      let dir = this.pendingDirs[Symbol.iterator]().next().value
      dir.setState('Working')  
    } 

    if (this.workingDirs.size + this.readingDirs.size + this.workingFiles.size === 0) {
      process.nextTick(() => this.emit('stopped'))
    }

  }

  //////////////////////////////////////////////////////////////////////////////
  //
  //  external/api interface
  //
  //  1. view hierarchy
  //  2. update policy
  //  3. pause / resume (not implemented)
  //  4. destroy (cancel)
  //
  //////////////////////////////////////////////////////////////////////////////
  view () {
    let nodes = []
    if (this.root) this.root.visit(n => nodes.push(n.view()))
    return {
      uuid: this.uuid,
      type: this.mode,
      src: this.src,
      dst: this.dst,
      entries: this.entries,
      nodes
    }
  }

  // this method is used by copy, move and export, but not import
  readdir(srcDirUUID, callback) {
    if (this.user) {
      this.ctx.readdir(this.user, this.srcDriveUUID, srcDirUUID, callback)
    } else {
      this.ctx.readdir(this.srcDriveUUID, srcDirUUID, callback)
    }
  }

  update (uuid, props, callback) {
    let err = null
    let node = this.root.find(n => n.src.uuid === uuid)
    if (!node) {
      err = new Error(`node ${uuid} not found`)
      err.code = 'ENOTFOUND'
      err.status = 404
    } else if (node.getState() !== 'Conflict') {
      console.log(node)
      err = new Error(`node is not in conflict state`)
      err.code = 'EFORBIDDEN'
      err.status = 403
    } else {
      node.update(props)
      if (props.applyToAll) {
        let type = node instanceof Dir ? 'dir' : 'file'
        this.policies[type][0] = props.policy[0] || this.policies[type][0]
        this.policies[type][1] = props.policy[1] || this.policies[type][1]
        // FIXME retry all ?
        if (type === 'dir') [...this.conflictDirs].forEach(n => n.retry())
        else [...this.conflictFiles].forEach(n => n.retry())
      }
    } 

    process.nextTick(() => callback(err))
  }

  delete (uuid, callback) {
    let err = null
    let node = this.root.find(n => n.src.uuid === uuid)
    if (!node) {
      // idempotent
    } else if (node.root() === node) {
      err = new Error(`root node cannot be deleted`)
      err.code = 'EFORBIDDEN'
      err.status = 403
    } else if (node.getState() !== 'Failed') {
      err = new Error(`node is not in Failed state`)
      err.code = 'EFORBIDDEN'
      err.status = 403
    } else {
      node.destroy()
    }

    process.nextTick(() => callback(err))
  }

}

class Copy extends Base {

  constructor (ctx, user, policies, src, dst, xstats) {
    super(ctx, user, policies, src, dst, xstats)
    this.mode = 'copy'
    this.srcDriveUUID = src.drive
    this.dstDriveUUID = dst.drive
    let _src = { uuid: src.dir }
    let _dst = { uuid: dst.dir }
    this.root = new DirCopy(this, null, _src, _dst, xstats)
  }

  cpdir (src, dst, policy, callback) {
    src.drive = this.srcDriveUUID
    dst.drive = this.dstDriveUUID

    if (this.user) {
      this.ctx.cpdir(this.user, src, dst, policy, callback)
    } else {
      this.ctx.cpdir(src, dst, policy, callback)
    }
  } 

  cpfile (src, dst, policy, callback) {
    src.drive = this.srcDriveUUID
    dst.drive = this.dstDriveUUID

    if (this.user) {
      this.ctx.cpfile(this.user, src, dst, policy, callback)
    } else {
      this.ctx.cpfile(src, dst, policy, callback)
    }
  }

}

class Move extends Base {

  constructor (ctx, user, policies, src, dst, xstats) {
    super(ctx, user, policies, src, dst, xstats)
    this.mode = 'move'
    this.srcDriveUUID = src.drive
    this.dstDriveUUID = dst.drive
    let _src = { uuid: src.dir }
    let _dst = { uuid: dst.dir }
    this.root = new DirMove(this, null, _src, _dst, xstats)
  }

  mvdir (src, dst, policy, callback) {
    src.drive = this.srcDriveUUID
    dst.drive = this.dstDriveUUID
    
    if (this.user) {
      this.ctx.mvdir2(this.user, src, dst, policy, callback)
    } else {
      this.ctx.mvdir(src, dst, policy, callback)
    } 
  }

  mvfile (src, dst, policy, callback) {
    src.drive = this.srcDriveUUID
    dst.drive = this.dstDriveUUID

    if (this.user) {
      this.ctx.mvfile2(this.user, src, dst, policy, callback)
    } else {
      this.ctx.mvfile(src, dst, policy, callback)
    }
  }

}

class Import extends Base {

  constructor (ctx, user, policies, src, dst, stats) {
    super(ctx, user, policies, src, dst, stats)
    this.mode = 'import'
    this.srcPath = src.path
    this.dstDriveUUID = dst.drive
    let _src = { 
      uuid: UUID.v4(),
      name: '',
      path: src.path
    }

    let _dst = { 
      uuid: dst.dir,
      name: ''
    } 

    this.root = new DirImport(this, null, _src, _dst, stats)
  }

  genTmpPath () {
    return this.ctx.genTmpPath()
  }

  mkdir (dst, policy, callback) {
    dst.drive = this.dstDriveUUID

    if (this.user) {
      this.ctx.mkdir2(this.user, dst, policy, callback)
    } else {
      this.ctx.mkdir(dst, policy, callback)
    }
  }

  mkfile (tmp, dst, policy, callback) {
    dst.drive = this.dstDriveUUID

    if (this.user) {
      this.ctx.mkfile(this.user, tmp, dst, policy, callback)
    } else {
      this.ctx.mkfile(tmp, dst, policy, callback)
    }
  }

}

class Export extends Base {

  constructor (ctx, user, policies, src, dst, xstats) {
    super(ctx, user, policies, src, dst, xstats)
    this.mode = 'export'
    this.srcDriveUUID = src.drive
    this.dstPath = dst.path

    let _src = {
      uuid: src.dir,
      name: '',
    }

    let _dst = {
      path: dst.path
    }

    this.root = new DirExport(this, null, _src, _dst, xstats)
  }

  clone (src, callback) {
    src.drive = this.srcDriveUUID

    if (this.user) {
      this.ctx.clone(this.user, src, callback)
    } else {
      this.ctx.clone(src, callback)
    }
  }
}

// return formatted policies 
const formatPolicies = policies => {

  const vs = [undefined, null, 'skip', 'replace', 'rename', 'keep']
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

  const handler = (err, xstats) => {
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
  }

  if (user) {
    ctx.readdir(user, driveUUID, dirUUID, handler)  
  } else {
    ctx.readdir(driveUUID, dirUUID, handler)
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

          if (!--count) callback(null, stats)
        }) 
      })
    }
  })


/**
Create a xcopy machine.

@param {object} ctx - reference fruitmix or vfs (if user is not provided)
@param {object} user - user object
@param {string} mode - copy, move, import, export
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
