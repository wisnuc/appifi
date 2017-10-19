const debug = require('debug')('fruitmix:file')

const Node = require('./node')
const xtractMetadata = require('../lib/metadata')
const xfingerprint = require('../lib/xfingerprint')
const hash = require('../lib/hash')

/**
File is a in-memory file node maintaining (some) xstat props and related tasks.

There are four state combinations for a file in terms of magic and hash props:

1. ~~magic is number, no hash~~
2. ~~magic is number, with hash~~
3. magic is string, no hash
4. magic is string, with hash

In this version, only files with magic string are maintained in memory. This dramatically reduces the memory footprint.

Another (experimental) state introduced in this version is `paused`. Any operations changing file system path (structure) should `pause` all workers in sub-tree, and `resume` them after the operation.

We have three choices in code pattern:

+ Immutable state machine. We don't use this pattern for two reasons
  + performance penalties
  + all files with magic string are indexed
  + file object may be reference with a hash worker.
+ Standard State Pattern in GoF book. We don't use this pattern either for it has two layers of objects.
+ Good old C Pattern. We starts from this pattern.

In our good old C pattern, only `hashed` and `hashless` are used as explicit states. But keep in mind that:
+ `paused` is a parallel state and shoule persist during state transfer.
+ new xstat may drop magic string. The Directory class should take care of this. Before removing a File object, the desctructor method (`exit`) should be called. Or, the `update` method cleans up everything before returning a null.
*/
class File extends Node {

  constructor (ctx, parent, xstat) {
    if (typeof xstat.magic !== 'string') { 
      throw new Error('file must have magic string') 
    }

    if (xstat.hash !== undefined && typeof xstat.hash !== 'string') { 
      throw new Error('xstat hash must be string or undefined') 
    }

    super(ctx, parent, xstat)

    this.uuid = xstat.uuid
    this.name = xstat.name

    /**
    file magic string. For xstat, magic may be a number or a string. But for file object, only string is accepted.
    Magic change is possible when file content changes. It may changes to another media type or to a number. The latter means this file object is going to be destroyed.
    @type {string}
    */
    this.magic = xstat.magic

    /**
    file hash. Updating file hash is considered to be a state transfer.
    @type {(string|undefined)}
    */
    this.hash = xstat.hash

    /**
    hash worker
    @type {(null|HashWorker)}
    */
    this.finger = null
    this.meta = null

    /**
    failed time of hash worker.
    Abort are not counted. When hash lost, this count is reset to 0
    @type {number}
    */
    this.fingerFail = 0
    this.metaFail = 0

    if (this.hash) {
      this.ctx.indexFile(this)
    } else {
      this.ctx.fingerIdle.push(this)
    }
  }

  /**
  Destroys this file node
  */
  destroy () {
    this.stopAllWorkers()
    if (this.hash) this.ctx.unindexFile(this)
    super.destroy()
  }

  /**
  Update this object with xstat. This function should only be called by directory when updating.

  For anything changed, all workers are stopped. 
  This function does NOT schedule. The caller takes the responsibility for scheduling
  Only name and hash can be changed.
  */

  update (xstat) {
    // TODO
    if (xstat.uuid !== this.uuid) throw new Error('uuid mismatch')
    if (this.name === xstat.name && this.hash === xstat.hash) return
    
    this.stopFingerWorker()
    this.stopMetaWorker()

    if (this.name !== xstat.name) {
      this.name = xstat.name
    }

    if (!this.hash && xstat.hash) {         
      // fingerprint found
      this.spliceFingerIdle()
      this.hash = xstat.hash
      this.ctx.indexFile(this)
    } else if (this.hash && !xstat.hash) {  
      // fingerprint lost
      this.ctx.unindex(this)
      this.hash = xstat.hash // acturally undefined
      this.ctx.fingerIdle.push(this)
    } else if (this.hash && xstat.hash && this.hash !== xstat.hash) { 
      // fingerprint changed
      this.ctx.unindex(this)
      this.hash = xstat.hash
      this.ctx.indexFile(this)
    }
  }

  spliceFingerIdle () {
    let index = this.ctx.fingerIdle.indexOf(this)
    if (index === -1) {
    } else {
      this.ctx.fingerIdle.splice(index, 1)
    }
  }

  spliceFingerRunning () {
    let index = this.ctx.fingerRunning.indexOf(this)
    if (index === -1) {
    } else {
      this.ctx.fingerRunning.splice(index, 1)
    }
  }

  spliceMetaRunning () {
    let index = this.ctx.metaRunning.indexOf(this)
    if (index === -1) {
    } else {
      this.ctx.metaRunning.splice(index, 1)
    }
  }

  startFingerWorker () {

    if (this.finger) return
    this.spliceFingerIdle()
    this.finger = xfingerprint(this.abspath(), this.uuid, (err, xstat) => {

      console.log('xfingerprint return', err, xstat)

      this.spliceFingerRunning() 
      this.finger = null
      if (err) {  
        // back to idle
        this.fingerFail++ 
        if (this.fingerFail > 7) {
          // give up if too many failures
          console.log(`failed too many times for calculating fingerprint for ${this.abspath()}`)
        } else {
          this.ctx.fingerIdle.push(this)
        }
      } else { 
        // TODO assert state? 
        // go to fingerprint state
        this.fingerFail = 0
        this.name = xstat.name
        this.hash = xstat.hash

        this.ctx.indexFile(this)

        this.ctx.scheduleFinger()
        this.ctx.scheduleMeta()
      }
    })
    this.ctx.fingerRunning.push(this)
  }

  stopFingerWorker () {

    console.log('start finger worker', this.abspath())

    if (this.finger) {
      this.spliceFingerRunning()
      this.finger.destroy()
      this.finger = null
      this.ctx.fingerIdle.push(this)
    }
  }

  startMetaWorker () {

    console.log('start meta worker', this.abspath())

    if (this.meta) return
    this.meta = xtractMetadata(this.abspath(), this.magic, this.hash, this.uuid, (err, metadata) => {

      console.log('xtractMetadata returns', err, metadata)

      this.spliceMetaRunning()
      this.meta = null
      if (err) {
        this.metaFail++
      } else {
        this.ctx.reportMetadata(metadata)
      }
    })
    this.ctx.metaRunning.push(this)
  }

  stopMetaWorker () {
    if (this.meta) {
      this.spliceMetaRunning()
      this.meta.destroy()
      this.meta = null
    }
  }

  /**
  Stop all workers
  */
  stopAllWorkers () {
    this.stopFingerWorker()
    this.stopMetaWorker()
  }

}

module.exports = File
