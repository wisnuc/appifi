const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')

const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const UUID = require('uuid')

const xtract = require('../lib/metadata')

const isMediaMagic = magic =>
  magic === 'JPEG' ||
  magic === 'PNG' ||
  magic === 'GIF' ||
  magic === 'MP4' ||
  magic === '3GP' ||
  magic === 'MOV' 


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

// no metadata, with source, pending
// there's no run method, calling meta.setState(Running) instead
class Pending extends Meta {

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

// no metadata, failed too many times
class Failed extends Pending {

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
class Running extends Pending {

  enter (props) {
    this.ctx.indexRunning(this)
    this.restart()
  }

  exit () {
    if (this.file) {
      this.file.metaWorker.destroy()
      this.file.metaWorker = null
      this.file = null
    }

    this.ctx.unindexRunning(this)
  }

  restart () {

    this.files.forEach(f => {
      if (typeof f.metaFail !== 'number') f.metaFail = 0
    })

    let file = this.files.find(f => f.metaFail < 3)
    if (!file) {
      this.setState(Failed)
    } else {
      this.file = file

      let filePath = file.abspath()
      let { uuid, hash, magic } = file
      file.metaWorker = xtract(filePath, magic, hash, uuid, (err, metadata) => {
        if (err) {
          this.file.metaFail++
          this.file = null
          this.restart()
        } else {
          this.file.metaFail = 0
          this.file = null
          this.metadata = metadata
          this.setState(Bound)
        }
      })
    }
  }

  removeFile (file) {

    if (this.file === file) {
      this.file.metaWorker.destroy() 
      delete this.file.metaWorker
      delete this.file.metaFail
      this.file = null
    }

    super.removeFile(file)

    if (!this.hasSource()) {
      this.destroy()
    } else {
      this.restart()
    }
  }
}

// with metadata AND sources 
class Bound extends Meta {

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

    this.concurrency = (opts && opts.concurrency) || 2
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

  indexPending (meta) {
    this.pending.add(meta)
    this.requestSchedule()
  }

  unindexPending (meta) {
    this.pending.delete(meta)
    this.requestSchedule()
  }

  indexRunning (meta) {
    this.running.add(meta)
    this.requestSchedule()
  }

  unindexRunning (meta) {
    this.running.delete(meta)
    this.requestSchedule()
  }

  indexFailed (meta) {
    this.failed.add(meta)
  } 

  unindexFailed (meta) {
    this.failed.delete(meta)
  }

  requestSchedule () {
    if (this.scheduled) return
    this.scheduled = true
    process.nextTick(() => this.schedule())
  }

  schedule () {
    while (this.pending.size > 0 && this.running.size < this.concurrency) {
      let meta = this.pending[Symbol.iterator]().next().value
      if (!meta) {
        console.log(this)
        process.exit()
      } else {
        meta.setState(Running)
      }
    }
  }

  indexFile (file) {
    let meta = this.map.get(file.hash)
    if (meta) {
      meta.addFile(file)
    } else {
      this.createMetaFromFile(file)
    }
  }

  unindexFile (file) {
    let meta = this.map.get(file.hash)
    if (meta) {
      meta.removeFile(file)
    } else {
      console.log('ERROR unindexFile: file not found')
    }
  } 

  createMetaFromFile (file) {
    new Pending({ ctx: this, key: file.hash, magic: file.magic, files: [file] })
  }

  createMetaFromMetadata (fingerprint, metadata) {
    new Unbound({ ctx: this, key: fingerprint, magic: metadata.m, metadata })
  }

  /**
  report metadata
  */
  report (fingerprint, metadata) {
    let meta = this.map.get(fingerprint)
    if (meta) {
      meta.setMetadata(metadata)
    } else {
      this.createMetaFromMetadata(fingerprint, metadata)
    }
  } 
}

MediaMap.Meta = Meta

module.exports = MediaMap

