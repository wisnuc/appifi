const EventEmitter = require('events')

const debug = require('debug')('xcopy')

const Directory = require('./directory')
const File = require('./file')

class XCopy extends EventEmitter {

  constructor (vfs, src, dst, xstats) {
    super()

    this.vfs = vfs

    this.srcDriveUUID = src.drive
    this.dstDriveUUID = dst.drive

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

    this.root = new Directory(this, null, src.dir, dst.dir, xstats)
    this.root.on('finish', () => this.emit('finish'))
  }

  destroy () {
    this.root.destroy()
    this.root = null
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // state machine
  //
  //////////////////////////////////////////////////////////////////////////////

  formatDir (dir) {
    return `${dir.srcUUID} ${this.vfs.uuidMap.get(dir.srcUUID).name}`
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

  indexMakingDir (dir) {
    debug(`dir ${this.formatDir(dir)} enter making (dst)`)
    this.makingDirs.add(dir)
  }

  unindexMakingDir (dir) {
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
    return new Set(Array.from(new Set([...this.pendingFiles, 
      ...this.workingFiles])).map(f => f.parent))
  }

  // dir pending -> making -> reading -> read
  schedule () {
    this.scheduled = false

    // console.log('schedule begin >>>>')

    // schedule file job
    while (this.pendingFiles.size > 0 && this.workingFiles.size < 1) {
      let file = this.pendingFiles[Symbol.iterator]().next().value
      file.setState(File.Working)
    }

    // schedule dir job
    while (this.pendingDirs.size > 0 && 
      this.activeParents().size + this.makingDirs.size + this.readingDirs.size < 2) { 
      let dir = this.pendingDirs[Symbol.iterator]().next().value
      dir.setState(Directory.Making)  
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
    this.vfs.mkdir(dirUUID, name, policy, callback)
  } 

  // mkdirc make a new dir with name from an existing dir
  mkdirc (srcDirUUID, dstDirUUID, policy, callback) {
    this.vfs.mkdirc(this.srcDriveUUID, srcDirUUID, this.dstDriveUUID, dstDirUUID, policy, callback)
  }

  cpFile (srcDirUUID, fileUUID, fileName, dstDirUUID, resolve, callback) {
    this.vfs.cpFile(this.srcDriveUUID, srcDirUUID, fileUUID, fileName, 
      this.dstDriveUUID, dstDirUUID, resolve, callback)
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
    let vs = []
    if (this.root) {
      this.root.visit(n => vs.push(n.view()))
    }
    return vs
  }

  update (srcUUID, policies) {
    let node = this.root.find(n => n.srcUUID === srcUUID)
    node.updatePolicies(policies)
  }

  pause () {
  } 

  resume () {
  }
}

const xcopy = (vfs, src, dst, entries, callback) => {
  vfs.readdir(src.dir, (err, xstats) => {
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
      callback(null, new XCopy(vfs, src, dst, found))
    }
  })
}

module.exports = xcopy


