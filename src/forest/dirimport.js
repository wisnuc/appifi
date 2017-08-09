const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

const DirCopy = require('./dircopy')
const DirWalk = require('./dirWalker')

const Forest = require('./forest')

const ReaddirRecursive = require('../stepper/readdir-recursive')
const DirCopy = require('./dircopy')


/**
**/

// this worker u
class Mkdir extends EventEmitter {
  constructor(root) {
    super()

    this.pending = []    
    this.working = []
    this.failed = []

    this.root
  }

  // { path, files[] }
  push(x) {
    this.working.push(x)
    this.schedule()
  }

  schedule() {
    while (this.pending.length) {
      let x = this.pending.shift()
      mkdirp
    }
  }
}

class Lstat extends EventEmitter {

  constructor(dir) {
    super()
    this.pending = []
    this.working = []
    this.failed = []
    this.dir = dir
  }

  put(x) {
    this.pending.push({ path: x })
    this.schedule()
  }

  schedule () {
    if (this.working.length) return
    if (!this.pending.length) return
    let x = this.pending.shift()
    fs.lstat(path.join(this.dir, x.path), (err, stat) => {
      this.working = []
      if (err) {
        x.error = err
        this.failed.push(x)
        this.emit('error', error, x)
      } else {
        x.stat = stat
        this.emit('data', x)
      }
      this.schedule()
      this.emit('step')
    })
  }
}

class DirImport extends EventEmitter {

  constructor(src, tmpDir, files, userUUID, driveUUID, dirUUID) {
    super()

    let mkdir = new Mkdir(tmpdir)
    mkdir.on('error', () => {})
    mkdir.on('data', x => {
    })

    let readdir = new ReaddirRecursive(src)
    readdir.on('error', () => {})
    readdir.on('data', x => { // { path, files[] }
      dirCopyQueue.push(x)       
    })

    let lstatSrc = new Lstat(src)
    lstatSrc.on('error', () => {})
    lstatSrc.on('data', x => {
      if (x.stat.isFile()) {

      } else if (x.stat.isDirectory()) {
        readdir.push(x.path)      
      }
    })
    lstatSrc.on('step', () => {
       
    })

    files.forEach(x => lstatSrc.put(x))
  }
}
