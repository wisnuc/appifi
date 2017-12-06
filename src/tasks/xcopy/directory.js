const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')

const { mkdir } = require('./lib')

const Node = require('./node')
const { File, CopyFile, MoveFile, ImportFile, ExportFile } = require('./file')

/**
Base File State
*/
class State {

  constructor(dir, ...args) {
    this.dir = dir
    this.dir.state = this
    this.enter(...args)
  }

  destroy () {
    this.exit()
  }

  setState (state, ...args) {
    this.exit()
    let NextState = this.dir[state]
    new NextState(this.dir, ...args)
  }

  retry () {
  }

  enter () {
  }

  exit () {
  }

}

class Pending extends State {

  enter () {
    this.dir.ctx.indexPendingDir(this.dir)
  }

  exit () {
    this.dir.ctx.unindexPendingDir(this.dir)
  } 

}

class Working extends State {

  enter () {
    this.dir.ctx.indexWorkingDir(this.dir)
  }

  exit () {
    this.dir.ctx.unindexWorkingDir(this.dir)
  } 

}

class CopyWorking extends Working {
  
  enter () {
    super.enter()

    let src = { dir: this.dir.srcUUID }
    let dst = { dir: this.dir.parent.dstUUID }
    let policy = this.dir.getPolicy()

    this.dir.ctx.cpdir(src, dst, policy, (err, xstat) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        this.dir.dstUUID = xstat.uuid
        this.setState('Reading')
      }
    })
  }

}

class MoveWorking extends Working {

  enter () {
    super.enter()

    let src = { dir: this.dir.srcUUID }
    let dst = { dir: this.dir.parent.dstUUID }
    let policy = this.dir.getPolicy()

    this.dir.ctx.mvdir(src, dst, policy, (err, xstat, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        let [same, diff] = resolved 
        if (same === 'skip') { // this is acturally a merging, same with copy
          this.dir.dstUUID = xstat.uuid 
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
      dir: this.dir.parent.dstUUID,
      name: this.dir.srcName,
    }

    let policy = this.dir.getPolicy()
   
    this.dir.ctx.mkdir(dst, policy, (err, xstat, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        this.dir.dstUUID = xstat.uuid
        this.setState('Reading')
      }
    })
  }

}

class ExportWorking extends Working {

  enter () {
    super.enter()

    let dstPath = path.join(this.dir.parent.dstPath, this.dir.srcName)
    let policy = this.dir.getPolicy()

    mkdir(dstPath, policy, (err, _, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        this.dir.dstPath = dstPath
        this.setState('Reading')
      } 
    })
  }

}

class Conflict extends State {

  enter (err, policy) {
    this.err = err
    this.policy = policy
    this.dir.ctx.indexConflictDir(this.dir)
  }

  retry () {
    this.setState('Working')
  }

  exit () {
    this.dir.ctx.unindexConflictDir(this.dir)
  }

}

class Reading extends State {

  enter () {
    this.dir.ctx.indexReadingDir(this.dir)
  } 

  exit () {
    this.dir.ctx.unindexReadingDir(this.dir)
  }

}

class FruitReading extends Reading {

  enter () {
    super.enter()
    // readdir always read source dir
    this.dir.ctx.readdir(this.dir.srcUUID, (err, xstats) => {
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

    let srcPath = this.dir.srcPath
    fs.readdir(this.dir.srcPath, (err, files) => {
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
    this.dir.ctx.indexReadDir(this.dir)
    this.dir.dstats = xstats.filter(x => x.type === 'directory')
    this.dir.fstats = xstats.filter(x => x.type === 'file')
    this.next()
  }

  exit () {
    this.dir.ctx.unindexReadDir(this.dir)
  }

}

class CopyRead extends Read {

  next () {
    if (this.dir.fstats.length) {
      let fstat = this.dir.fstats.shift()
      let file = new CopyFile(this.dir.ctx, this.dir, fstat.uuid, fstat.name)
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

    if (this.dir.dstats.length) {
      let dstat = this.dir.dstats.shift()
      let dir = new CopyDirectory(this.dir.ctx, this.dir, dstat.uuid)
      dir.on('error', err => {
        // TODO
        this.next()
      })

      dir.on('finish', () => (dir.destroy(true), this.next()))
      return
    } 

    if (this.dir.children.length === 0) {
      this.setState('Finished')
    }
  }

}

class MoveRead extends Read {

  next () {
    if (this.dir.fstats.length) {
      let fstat = this.dir.fstats.shift()
      let file = new MoveFile(this.dir.ctx, this.dir, fstat.uuid, fstat.name)

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

    if (this.dir.dstats.length) {
      let dstat = this.dir.dstats.shift()
      let dir = new MoveDirectory(this.dir.ctx, this.dir, dstat.uuid)
      dir.on('error', err => {
        // TODO
        this.next()
      })

      dir.on('finish', () => (dir.destroy(true), this.next()))
      return
    } 

    if (this.dir.children.length === 0) {
      this.setState('Finished')
    }
  }

}

class ImportRead extends Read {

  next () {
    if (this.dir.fstats.length) {
      let fstat = this.dir.fstats.shift()
      let file = new ImportFile(this.dir.ctx, this.dir, path.join(this.dir.srcPath, fstat.name))

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

    if (this.dir.dstats.length) {
      let dstat = this.dir.dstats.shift()
      let dir = new ImportDirectory(this.dir.ctx, this.dir, path.join(this.dir.srcPath, dstat.name))

      dir.on('error', err => {
        // TODO
        this.next()
      })

      dir.on('finish', () => (dir.destroy(true), this.next()))
      return
    } 

    if (this.dir.children.length === 0) {
      this.setState('Finished')
    }
  }

}

class ExportRead extends Read {

  next () {
    if (this.dir.fstats.length) {
      let fstat = this.dir.fstats.shift()
      let file = new ExportFile(this.dir.ctx, this.dir, fstat.uuid, fstat.name)

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

    if (this.dir.dstats.length) {
      let dstat = this.dir.dstats.shift()
      let dir = new ExportDirectory(this.dir.ctx, this.dir, dstat.uuid, dstat.name)
      dir.on('error', err => {
        // TODO
        this.next()
      })

      dir.on('finish', () => (dir.destroy(true), this.next()))
      return
    } 

    if (this.dir.children.length === 0) {
      this.setState('Finished')
    }
  }

}

class Failed extends State {
  // when directory enter failed 
  // all descendant node are destroyed (but not removed)
  enter (err) {
    this.dir.ctx.indexFailedDir(this.dir)
    this.dir.children.forEach(c => c.destroy())
    this.dir.emit('error', err)
  }

  exit () {
    this.dir.ctx.unindexFailedDir(this.dir)
  }

}

class Finished extends State {

  enter () {
    this.dir.ctx.indexFinishedDir(this.dir)
    this.dir.emit('finish')
  }

  exit () {
    this.dir.ctx.unindexFinishedDir(this.dir)
  }

}

class Directory extends Node {

  constructor(ctx, parent) {
    super(ctx, parent)
    this.children = []
  }

  destroy (detach) {
    this.children.forEach(c => c.destroy())
    this.state.destroy ()
    super.destroy(detach)
  }

  // state is a string
  setState (state) {
    this.state.setState(state)
  }

  // change to event emitter
  onChildFinish (child) {
    child.destroy()
    if (this.children.length === 0) {
      console.log('done')  
    }
  }

  view () {
    let obj = {
      type: 'directory',
      parent: this.parent && this.parent.srcUUID,
      srcUUID: this.srcUUID,
    }
    
    if (this.dstUUID) obj.dstUUID = this.dstUUID
    obj.state = this.state.constructor.name
    if (this.policies) obj.policy = this.policy
    return obj
  }

  setPolicy (type, policy) {
    if (type === 'same') {
      this.policy[0] = policy
    } else {
      this.policy[1] = policy
    }
    this.retry()
  }

  getPolicy () {
    return [
      this.policy[0] || this.ctx.policies.dir[0] || null,
      this.policy[1] || this.ctx.policies.dir[1] || null
    ]  
  }

  retry () {
    if (this.children) this.children.forEach(c => c.retry())
    this.state.retry()
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

