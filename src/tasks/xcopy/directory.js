const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')

const { mkdir } = require('./lib')

const Node = require('./node')
const State = require('./state')

const { File, FileCopy, FileMove, FileImport, FileExport } = require('./file')

class Pending extends State {

  enter () {
    this.ctx.ctx.indexPendingDir(this.ctx)
  }

  exit () {
    this.ctx.ctx.unindexPendingDir(this.ctx)
  } 

  getState () {
    return 'Pending'
  }

}

class Working extends State {

  enter () {
    this.ctx.ctx.indexWorkingDir(this.ctx)
  }

  exit () {
    this.ctx.ctx.unindexWorkingDir(this.ctx)
  } 

  getState () {
    return 'Working'
  }
}

class CopyWorking extends Working {
  
  enter () {
    super.enter()

    let src = { dir: this.ctx.srcUUID }
    let dst = { dir: this.ctx.parent.dstUUID }
    let policy = this.ctx.getPolicy()

    this.ctx.ctx.cpdir(src, dst, policy, (err, xstat) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        this.ctx.dstUUID = xstat.uuid
        this.setState('Reading')
      }
    })
  }

}

class MoveWorking extends Working {

  enter () {
    super.enter()

    let src = { dir: this.ctx.srcUUID }
    let dst = { dir: this.ctx.parent.dstUUID }
    let policy = this.ctx.getPolicy()

    this.ctx.ctx.mvdir(src, dst, policy, (err, xstat, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        let [same, diff] = resolved 
        if (same === 'skip') { // this is acturally a merging, same with copy
          this.ctx.dstUUID = xstat.uuid 
          this.setState('Reading')
        } else {
          this.setState('Finished')
        }
      }
    })
  }

}

class ImportWorking extends Working {

  enter () {
    super.enter()

    let dst = {
      dir: this.ctx.parent.dstUUID,
      name: this.ctx.srcName,
    }

    let policy = this.ctx.getPolicy()
   
    this.ctx.ctx.mkdir(dst, policy, (err, xstat, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        this.ctx.dstUUID = xstat.uuid
        this.setState('Reading')
      }
    })
  }

}

class ExportWorking extends Working {

  enter () {
    super.enter()

    let dstPath = path.join(this.ctx.parent.dstPath, this.ctx.srcName)
    let policy = this.ctx.getPolicy()

    mkdir(dstPath, policy, (err, _, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        this.ctx.dstPath = dstPath
        this.setState('Reading')
      } 
    })
  }

}

class Conflict extends State {

  enter (err, policy) {
    this.err = err
    this.policy = policy
    this.ctx.ctx.indexConflictDir(this.ctx)
  }

  getState () {
    return 'Conflict'
  }

  retry () {
    this.setState('Working')
  }

  exit () {
    this.ctx.ctx.unindexConflictDir(this.ctx)
  }
}

class Reading extends State {

  enter () {
    this.ctx.ctx.indexReadingDir(this.ctx)
  } 

  getState () {
    return 'Reading'
  }

  exit () {
    this.ctx.ctx.unindexReadingDir(this.ctx)
  }

}

class FruitReading extends Reading {

  enter () {
    super.enter()
    // readdir always read source dir
    this.ctx.ctx.readdir(this.ctx.srcUUID, (err, xstats) => {
      if (err) {
        this.setState('Failed', err)
      } else {
        this.setState('Read', xstats)
      }
    })
  }

}

class NativeReading extends Reading {

  enter () {
    super.enter()

    let srcPath = this.ctx.srcPath
    fs.readdir(this.ctx.srcPath, (err, files) => {
      if (err) {
        this.setState('Failed', err)
      } else if (files.length === 0) {
          this.setState('Read', [])
      } else {
        let count = files.length
        let stats = []
        files.forEach(file => {
          fs.lstat(path.join(srcPath, file), (err, stat) => {
            if (!err && (stat.isDirectory() || stat.isFile())) {
              let x = { 
                type: stat.isDirectory() ? 'directory' : 'file',
                name: file
              }

              if (x.type === 'file') {
                x.size = stat.size
                x.mtime = stat.mtime.getTime()
              }
              
              stats.push(x)
            } 

            if (!--count) {
              this.setState('Read', stats)
            }
          })
        })
      }
    })
  }

}

class Read extends State {

  enter (xstats) {
    this.ctx.ctx.indexReadDir(this.ctx)
    this.ctx.dstats = xstats.filter(x => x.type === 'directory')
    this.ctx.fstats = xstats.filter(x => x.type === 'file')
    this.next()
  }

  getState () {
    return 'Read'
  }

  exit () {
    this.ctx.ctx.unindexReadDir(this.ctx)
  }

}

class CopyRead extends Read {

  next () {
    if (this.ctx.fstats.length) {
      let fstat = this.ctx.fstats.shift()
      let file = new FileCopy(this.ctx.ctx, this.ctx, fstat.uuid, fstat.name)
      file.on('error', err => { 
        // TODO
        this.next()
      })

      file.on('finish', () => {
        file.destroy(true)
        this.next()
      })

      return
    }

    if (this.ctx.dstats.length) {
      let dstat = this.ctx.dstats.shift()
      let dir = new CopyDirectory(this.ctx.ctx, this.ctx, dstat.uuid)
      dir.on('error', err => {
        // TODO
        this.next()
      })

      dir.on('finish', () => (dir.destroy(true), this.next()))
      return
    } 

    if (this.ctx.children.length === 0) {
      this.setState('Finished')
    }
  }

}

class MoveRead extends Read {

  next () {
    if (this.ctx.fstats.length) {
      let fstat = this.ctx.fstats.shift()
      let file = new FileMove(this.ctx.ctx, this.ctx, fstat.uuid, fstat.name)

      file.on('error', err => { 
        // TODO
        console.log(err)
        this.next()
      })

      file.on('finish', () => {
        file.destroy(true)
        this.next()
      })

      return
    }

    if (this.ctx.dstats.length) {
      let dstat = this.ctx.dstats.shift()
      let dir = new MoveDirectory(this.ctx.ctx, this.ctx, dstat.uuid)
      dir.on('error', err => {
        // TODO
        this.next()
      })

      dir.on('finish', () => (dir.destroy(true), this.next()))
      return
    } 

    if (this.ctx.children.length === 0) {
      this.setState('Finished')
    }
  }

}

class ImportRead extends Read {

  next () {
    if (this.ctx.fstats.length) {
      let fstat = this.ctx.fstats.shift()
      let file = new FileImport(this.ctx.ctx, this.ctx, path.join(this.ctx.srcPath, fstat.name))

      file.on('error', err => { 
        // TODO
        console.log(err)
        this.next()
      })

      file.on('finish', () => {
        file.destroy(true)
        this.next()
      })

      return
    }

    if (this.ctx.dstats.length) {
      let dstat = this.ctx.dstats.shift()
      let dir = new ImportDirectory(this.ctx.ctx, this.ctx, path.join(this.ctx.srcPath, dstat.name))

      dir.on('error', err => {
        // TODO
        this.next()
      })

      dir.on('finish', () => (dir.destroy(true), this.next()))
      return
    } 

    if (this.ctx.children.length === 0) {
      this.setState('Finished')
    }
  }

}

class ExportRead extends Read {

  next () {
    if (this.ctx.fstats.length) {
      let fstat = this.ctx.fstats.shift()
      let file = new FileExport(this.ctx.ctx, this.ctx, fstat.uuid, fstat.name)

      file.on('error', err => { 
        // TODO
        console.log(err)
        this.next()
      })

      file.on('finish', () => {
        file.destroy(true)
        this.next()
      })

      return
    }

    if (this.ctx.dstats.length) {
      let dstat = this.ctx.dstats.shift()
      let dir = new ExportDirectory(this.ctx.ctx, this.ctx, dstat.uuid, dstat.name)
      dir.on('error', err => {
        // TODO
        this.next()
      })

      dir.on('finish', () => (dir.destroy(true), this.next()))
      return
    } 

    if (this.ctx.children.length === 0) {
      this.setState('Finished')
    }
  }

}

class Failed extends State {
  // when directory enter failed 
  // all descendant node are destroyed (but not removed)
  enter (err) {
    this.ctx.ctx.indexFailedDir(this.ctx)
    this.ctx.children.forEach(c => c.destroy())
    this.ctx.emit('error', err)
  }

  exit () {
    this.ctx.ctx.unindexFailedDir(this.ctx)
  }

  getState () {
    return 'Failed'
  }
}

class Finished extends State {

  enter () {
    this.ctx.ctx.indexFinishedDir(this.ctx)
    this.ctx.emit('finish')
  }

  exit () {
    this.ctx.ctx.unindexFinishedDir(this.ctx)
  }

  getState () {
    return 'Finished'
  }
}

/**
A directory sub-task, base class

@memberof XCopy
*/
class Directory extends Node {

  constructor(ctx, parent) {
    super(ctx, parent)
    this.children = []
  }

  destroy () {
    [...this.children].forEach(c => c.destroy())
    super.destroy()
  }

  identity () {
    return this.srcUUID
  }

  view () {
    let obj = {
      type: 'directory',
      parent: this.parent && this.parent.srcUUID,
      srcUUID: this.srcUUID
    }
    
    if (this.dstUUID) obj.dstUUID = this.dstUUID
    obj.state = this.state.getState()
    if (this.policies) obj.policy = this.policy
    return obj
  }

  getPolicy () {
    return [
      this.policy[0] || this.ctx.policies.dir[0] || null,
      this.policy[1] || this.ctx.policies.dir[1] || null
    ]  
  }

}

Directory.prototype.Pending = Pending
Directory.prototype.Working = Working
Directory.prototype.Reading = FruitReading
Directory.prototype.Read = Read
Directory.prototype.Conflict = Conflict
Directory.prototype.Finished = Finished
Directory.prototype.Failed = Failed

class CopyDirectory extends Directory {

  constructor(ctx, parent, srcUUID, dstUUID, xstats) {
    super(ctx, parent)
    this.srcUUID = srcUUID
    if (dstUUID) {
      this.dstUUID = dstUUID
      new CopyRead(this, xstats)
    } else {
      new Pending(this)
    }
  } 
}

CopyDirectory.prototype.Working = CopyWorking
CopyDirectory.prototype.Read = CopyRead

class MoveDirectory extends Directory {

  constructor(ctx, parent, srcUUID, dstUUID, xstats) {
    super(ctx, parent)
    this.srcUUID = srcUUID
    if (dstUUID) {
      this.dstUUID = dstUUID
      new MoveRead(this, xstats)
    } else {
      new Pending(this)
    }
  }
}

MoveDirectory.prototype.Working = MoveWorking
MoveDirectory.prototype.Read = MoveRead

class ImportDirectory extends Directory {
  
  constructor(ctx, parent, srcPath, dstUUID, stats) {
    super(ctx, parent)
    this.srcPath = srcPath
    this.srcName = path.basename(srcPath)

    if (dstUUID) {
      this.dstUUID = dstUUID
      new ImportRead(this, stats)
    } else {
      new Pending(this)
    }
  }

  identity () {
    return this.srcPath
  }
}

ImportDirectory.prototype.Working = ImportWorking
ImportDirectory.prototype.Reading = NativeReading
ImportDirectory.prototype.Read = ImportRead

class ExportDirectory extends Directory {

  constructor(ctx, parent, srcUUID, srcName, dstPath, xstats) {
    super(ctx, parent)
    this.srcUUID = srcUUID
    this.srcName = srcName
    if (dstPath) {
      this.dstPath = dstPath
      new ExportRead(this, xstats)
    } else {
      new Pending(this)
    }
  }
}

ExportDirectory.prototype.Working = ExportWorking
ExportDirectory.prototype.Read = ExportRead

module.exports = {
  Directory,
  CopyDirectory,
  MoveDirectory,
  ImportDirectory,
  ExportDirectory
}

