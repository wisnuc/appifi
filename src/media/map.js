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

/**
An Entry can be created from:
1. existing metadata when program starts
2. a media blob found in repo
3. a media file found in vfs
*/
class Meta {

  constructor (ctx, key, magic) {
    this.key = key
    this.ctx = ctx
    this.magic = magic
    this.metadata = null
    this.blob = false
    this.files = []
    this.worker = null
  }

  run () {
    if (this.metadata) return 
    if (this.blob) {
    } else {
      let file = this.files.find(f => f.metaFail < 3)      
      if (!file) return
      file.meta = xtract(file.abspath(), file.magic, file.hash, file.uuid, (err, metadata) => {
        this.ctx.running.delete(this.key)
        if (err) {
          file.metaFail++
          this.ctx.pending.add(this.key)
        } else {
          this.metadata = metadata
        }
        this.ctx.schedule()
      })
    }
  } 

  add (file) {
    this.files.push(file)
    if (this.metadata || this.ctx.running.has(this.key)) return
    this.ctx.pending.add(this.key)
  }

  remove (file) {
    let index = this.files.indexOf(file)
    if (index === -1) {
      console.log("ASSERTION FAIL") // TODO
    } else {
      this.files.splice(index, 1)
      if (file.metaWorker) {
        file.metaWorker.destroy()
        file.metaFail = 0
        this.ctx.running.delete(this.key)
        this.ctx.pending.add(this.key)
      }
    }
  }
}

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

    this.concurrency = opts.concurrency || 2
    this.map = new Map()

    // fingerprints
    this.running = new Set()
    this.pending = new Set()

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

  get (k) {
    return this.map.get(k)
  }

  //////////////////////////////////////////////////////////////////////////////
  // 
  //
  //

  createMetaFromFile (file) {
    let key = file.hash
    let meta = new Meta(this, key, file.magic) 
    meta.files = [file]
    this.map.set(key, meta)
    this.pending.add(key)
    this.schedule()
  }

  schedule () {
    while (this.pending.length && this.running.size <= this.concurrency) {
      let key = this.pending.shift()
      if (this.running.has(key)) continue

      let meta = this.map.get(key)
      if (!meta || meta.metadata) continue
     
      meta.run()
    }
  }

  requestSchedule () {
    if (this.scheduleF) return
    this.scheduleF = () => this.schedule()
    process.nextTick(() => this.scheduleF && this.scheduleF())
  }

  indexFile (file) {
    // TODO throw
    let meta = this.map.get(file.hash)
    if (meta) {
      meta.add(file)
    } else {
      this.createMetaFromFile(file)
    }
  }

  unindexFile (file) {
    let meta = this.map.get(file.hash)
    if (meta) {
      meta.remove(file)
    } else {
      console.log('ERROR unindexFile: file not found')
    }
  } 

  /**
  report metadata
  */
  report (fingerprint, metadata) {
    let key = fingerprint
    let val = this.map.get(key) 
    if (val) {
      if (val.metadata) {
         
      } else {
        
      }
    } else {
      this.map.set(key, createEntryFromMetadata(metadata))
    }
  } 
}

MediaMap.Meta = Meta

module.exports = MediaMap


