const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')
const os = require('os')
const assert = require('assert')

const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const UUID = require('uuid')
const deepEqual = require('deep-equal')

const debug = require('debug')('mediamap')

const extract = require('../lib/metadata')

// A Meta must have ctx, key, and magic
// it may:
// 1. no metadata, but have either blob or files
//    + running
//    + pending
// 2. having metadata, but neither blob nor files
// 3. have both

// base class
class Meta {

  constructor (props) {
    this.ctx = props.ctx
    this.key = props.key
    this.magic = props.magic
    this.metadata = props.metadata || null
    this.boxes = props.boxes || []
    this.files = props.files || [] 
    this.ctx.map.set(this.key, this)
    this.enter()
  }

  setState(Next) {
    this.exit()
    new Next(this)
  }

  enter() {}

  exit() {}

  destroy () { 
    this.exit() 
    this.ctx.map.delete(this.key)
  }

  hasSource () {
    return this.files.length + this.boxes.length > 0
  }

  addFile (file) {
    this.files.push(file)
  }

  removeFile (file) {
    let index = this.files.indexOf(file)
    if (index === -1) {
      console.log('Error, meta.removeFile: file not found', this, file)
    } else {
      this.files.splice(index, 1)
    }
  }

  setMetadata(metadata) {
    if (this.metadata !== metadata) {
      this.ctx.saveMetadata(this.key, metadata)
    }

    this.metadata = metadata
  }

}

// having metadata but neither blobs nor files (no source)
class Unbound extends Meta {

  addFile (file) {
    super.addFile(file)
    this.setState(Bound)
  }

}

// no metadata, with source
class NoMetadata extends Meta {

  enter (props) {
    this.ctx.indexPending(this)
  }

  exit () {
    this.ctx.unindexPending(this)
  }

  setMetadata (metadata) {
    super.setMetadata(metadata)
    this.setState(Bound)
  }
}

// there's no run method, calling meta.setState(Running) instead
class Pending extends NoMetadata {} 

// no metadata, failed too many times
class Failed extends NoMetadata {

  enter (props) {
    this.ctx.indexFailed(this)
  }

  exit () {
    this.ctx.unindexFailed(this)
  }

  addFile (file) {
    super.addFile(file)      
    this.setState(Pending)
  }

}

// having source but no metadata, running
//  
class Running extends NoMetadata {

  // pick a file, install this.file and this.file.meta, bidirectional link
  enter (props) {
    this.ctx.indexRunning(this)

    let xs = this.files.filter(f => f.metaFail === undefined || f.metaFail < 4)
    if (xs.length === 0) throw new Error('Assert Failed')

    this.file = xs[Math.floor(Math.random() * xs.length)]
    this.file.meta = this
    this.start()
  }

  exit () {
    if (this.file) {
      // destroy worker
      this.file.metaWorker.destroy()
      delete this.file.metaWorker
      // unlink
      delete this.file.meta
      delete this.file
    }
    this.ctx.unindexRunning(this)
  }

  // create metaWorker
  start () {
    let filePath = this.file.abspath()
    let { uuid, hash, magic } = this.file
    this.file.metaWorker = extract(filePath, magic, hash, uuid, (err, metadata) => {

      // clean links
      let file = this.file
      delete this.file.metaWorker 
      delete this.file.meta
      delete this.file
      
      if (err) {
        file.metaFail = (file.metaFail || 0) + 1
        this.nextState()
      } else {
        delete file.metaFail
        this.setMetadata(metadata)
      }
    })
  }

  restart () {
    this.file.metaWorker.destroy()
    this.start()
  }

  removeFile (file) {
    if (this.file === file) {         // removing working file
      super.removeFile(file)
      delete this.file.metaFail
      this.nextState()
    } else {                          // removing non-working file, no state change
      super.removeFile(file)
    }
  }

  nextState () {
    if (this.files.length + this.files.length === 0) {
      this.destroy()
    } else if (this.files.length > 0 && this.files.every(f => f.metaFail > 3)) {
      this.setState(Failed)
    } else {
      this.setState(Pending)
    }
  }
 
}

// with metadata AND sources 
class Bound extends Meta {

  enter () {
    this.ctx.indexBound(this) 
  }

  exit () {
    this.ctx.unindexBound(this)
  }

  // if all sources dropped, return to Unbound state
  removeFile (file) {
    super.removeFile(file)  
    if (!this.hasSource()) this.setState(Unbound)
  }
}

/**
An Entry can be created from:
1. existing metadata when program starts
2. a media blob found in repo
3. a media file found in vfs
*/

/**

MediaMap holds a map internally.

key: fingerprint
value: {
  type: 'magic string, such as JPEG',
  metadata: { // may be null
  },
  blob: true, // true or false, currently false
  files: []   // array of File Object
}

*/
class MediaMap extends EventEmitter {

  constructor(opts) {
    super() 

    this.concurrency = (opts && opts.concurrency) || 4
    this.map = new Map()

    // fingerprints
    this.running = new Set()
    this.pending = new Set()
    this.failed = new Set()

    Object.defineProperty(this, 'size', {
      get: function() {
        return this.map.size
      }
    })
  }

  set (k, v) {
    if (this.map.has(k)) return
    this.map.set(k, v) 
    let prefix = this.map.size === 1 ? '' : '\n'
    this.ws.write(prefix + JSON.stringify([k, v]))
  }

  has (k) {
    return this.map.has(k)
  }

  hasMetadata (k) {
    return this.map.has(k) && !!this.map.get(k).metadata
  }

  get (k) {
    return this.map.get(k)
  }

  getMetadata (k) {
    if (this.hasMetadata(k)) {
      return this.map.get(k).metadata
    } else {
      return
    }
  }

  formatMeta(meta) {
    return meta.key.slice(0, 8) + ' [' + meta.files.map(f => f.name).join(',') + '] '
  }

  indexPending (meta) {
    debug(`${this.formatMeta(meta)} enter pending`)
    this.pending.add(meta)
    this.requestSchedule()
  }

  unindexPending (meta) {
    debug(`${this.formatMeta(meta)} exit pending`)
    this.pending.delete(meta)
  }

  indexRunning (meta) {
    debug(`${this.formatMeta(meta)} enter running`)
    this.running.add(meta)
  }

  unindexRunning (meta) {
    debug(`${this.formatMeta(meta)} exit running`)
    this.running.delete(meta)
    this.requestSchedule()
  }

  indexFailed (meta) {
    debug(`${this.formatMeta(meta)} enter failed`)
    this.failed.add(meta)
  } 

  unindexFailed (meta) {
    debug(`${this.formatMeta(meta)} exit failed`)
    this.failed.delete(meta)
  }

  indexBound (meta) {
    debug(`${this.formatMeta(meta)} enter bound`)
  }

  unindexBound (meta) {
    debug(`${this.formatMeta(meta)} exit bound`)
  }

  requestSchedule () {
    if (this.scheduled) return
    this.scheduled = true
    process.nextTick(() => this.schedule())
  }

  schedule () {
    this.scheduled = false

    if (this.pending.size === 0 && this.running.size === 0) {
      if (!process.env.hasOwnProperty('NODE_PATH')) {
        console.log('all metadata jobs finished')
      }
      return
    }

    let core = os.cpus().length
    let load = os.loadavg()[0]

    const shouldSpawn = () => {
      if (this.pending.size === 0) return false
      if (this.running.size === 0) return true
      return (load + this.running.size / 2 - 0.5) < core
    }

//    while (this.pending.size > 0 && this.running.size < this.concurrency) {
    while (shouldSpawn()) {
      let meta = this.pending[Symbol.iterator]().next().value
      if (!meta) {
        process.exit() // FIXME change to assert
      } else {
        meta.setState(Running)
      }
    }
  }

  indexFile (file) {
    debug(`index ${file.hash.slice(0, 8)} ${file.name}`)
    let meta = this.map.get(file.hash)
    if (meta) {
      meta.addFile(file)
    } else {
      new Pending({ ctx: this, key: file.hash, magic: file.magic, files: [file] })
    }
  }

  fileNameUpdated (file) {
    // check states, not all files have meta. TODO
    if (file.meta) {
      assert(file.meta instanceof Running)
      file.meta.restart() 
    }
  }

  unindexFile (file) {
    debug(`unindex ${file.hash.slice(0, 8)} ${file.name}`)
    let meta = this.map.get(file.hash)
    if (meta) {
      meta.removeFile(file)
    } else {
      console.log('ERROR unindexFile: file not found')
    }
  } 

  setMetadata (fingerprint, metadata) {
    let meta = this.map.get(fingerprint)
    if (meta) {
      meta.setMetadata(metadata)
    } else {
      this.saveMetadata(fingerprint, metadata)
      new Unbound({ ctx: this, key: fingerprint, magic: metadata.m, metadata })
    }
  } 

  // virtual method
  saveMetadata (fingerprint, metadata) {}
 
}

MediaMap.Meta = Meta

module.exports = MediaMap

