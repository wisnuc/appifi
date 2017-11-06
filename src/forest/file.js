const debug = require('debug')('fruitmix:file')

const Node = require('./node')
const xtractMetadata = require('../lib/metadata')
const xfingerprint = require('../lib/xfingerprint')

const debugi = require('debug')('fruitmix:indexing')

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

class Base {
  
  constructor(file, ...args) {
    this.file = file
    this.file.state = this
    this.enter(...args)
  }

  enter () {
  }

  restart () {
  }

  exit () {
  }

  destroy () {
    this.exit()
  }
}

// file has no hash and idling
class Hashless extends Base {

  enter (fail = 0) {
    this.fail = fail
    this.file.ctx.fileEnterHashless(this.file) 
  }

  calcFingeprint () {
    this.exit()
    this.file.state = new Hashing(this.file, this.fail)
  }

  exit () {
    this.file.ctx.fileExitHashless(this.file)
  }

}

// file has no hash and calculating 
class Hashing extends Base {
  
  enter (fail) {
    this.failed = fail
    this.file.ctx.fileEnterHashing(this.file)
    this.worker = null
    this.restart()
  }

  restart () {
    if (this.worker) this.worker.destroy()

    let filePath = this.file.abspath()
    let uuid = this.file.uuid
    this.worker = xfingerprint(filePath, uuid, (err, xstat) => {
      this.exit()
      if (err) {
        this.fail++
        if (this.fail > 5) {
          new HashFailed(this.file)
        } else {
          new Hashless(this.file, this.fail)
        }
      } else {
        this.file.hash = xstat.hash 
        new Hashed(this.file)
      }
    })
  }

  exit () {
    this.worker.destroy()
    this.file.ctx.fileExitHashing(this.file)
  }
}

// file has no hash and won't try calculation any more
class HashFailed extends Base {

  enter () {
    this.file.ctx.fileEnterHashFailed(this.file)
  }

  exit () {
    this.file.ctx.fileExitHashFailed(this.file)
  }

}

// when file has hash
class Hashed extends Base {

  enter () {
    this.file.ctx.fileEnterHashed(this.file)
  }

  exit () {
    if (this.worker) this.worker.destroy()
    // here we don't callback, cause it's going to be removed anyway
    this.file.ctx.fileExitHashed(this.file)
  }

  extractMetadata (callback) {
    this.callback = callback
    this.worker = null
    this.restart()
  }

  restart () {
    if (this.worker) this.worker.destroy()
    let filePath = this.file.abspath()
    let { magic, hash, uuid } = this.file
    this.worker = xtractMetadata(filePath, magic, hash, uuid, (err, metadata) => {
      this.callback(this.file, err, metadata)
    }) 
  }
}

class File extends Node {

  constructor (ctx, parent, xstat) {
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

    if (!this.hash) {
      new Hashless(this)
    } else {
      new Hashed(this)
    }
  }

  /**
  Destroys this file node
  */
  destroy (detach) {
    this.state.destroy() 
    super.destroy(detach)
  }

  restart () {
    this.state.restart()
  }

  extractMetadata(callback) {
  }

  calcFingerprint () {
  }
}

module.exports = File
