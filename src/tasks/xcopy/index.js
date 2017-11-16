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

  formatDir (dir) {
    return `${dir.srcUUID} ${this.vfs.uuidMap.get(dir.srcUUID).name}`
  }

  formatFile (file) {
    return `${file.srcUUID} ${file.srcName}`
  }

  readdir (dir, callback) {
    if (this.user) {
    } else {
      this.vfs
    }
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
  }

  unindexConflictDir (dir) {
    debug(`dir ${this.formatDir(dir)} exit conflict`)
  }

  indexFailedDir (dir) {

  }

  unindexFailedDir (dir) {

  }

  destroy () {
    this.root.destroy()
    this.root = null
  }

  reqSched () {
    if (this.scheduled) return
    this.scheduled = true
    process.nextTick(() => this.schedule())
  }

  // dir pending -> making -> reading -> read
  schedule () {
    this.scheduled = false

    while (this.pendingFiles.size > 0 && this.workingFiles.size < 1) {
      let file = this.pendingFiles[Symbol.iterator]().next().value
      file.setState(File.Working)
    }

    const condition1 = () => 
      this.makingDirs.size + this.readingDirs.size + this.readDirs.size < 10 &&
      this.pendingDirs.size > 0

    while (condition1()) {
      let dir = this.pendingDirs[Symbol.iterator]().next().value  
      if (!dir) console.log(this.pendingDirs)
      dir.setState(Directory.Making)  
    } 
  }

  /////////////////////////////////////////////////////////////////////////////

  mkdir(dirUUID, name, resolve, callback) {
    this.vfs.mkdir(dirUUID, name, resolve, callback)
  } 

  // mkdirc
  mkdirc (srcDirUUID, dstDirUUID, resolve, callback) {
    this.vfs.mkdirc(this.srcDriveUUID, srcDirUUID, this.dstDriveUUID, dstDirUUID, resolve, callback)
  }

  cpFile (srcDirUUID, fileUUID, fileName, dstDirUUID, resolve, callback) {
    this.vfs.cpFile(this.srcDriveUUID, srcDirUUID, fileUUID, fileName, this.dstDriveUUID, dstDirUUID, resolve, callback)
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


