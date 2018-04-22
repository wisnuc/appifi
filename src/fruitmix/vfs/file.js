const assert = require('assert')

const debug = require('debug')('fruitmix:file')

const Node = require('./node')
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

// hashFail is a shared extended state accross hashless and hashing state, but neither
// hashFailed nor hashed state
class Base {
 
  constructor (file) {
    // mutual references
    this.file = file
    file.state = this
    this.enter()
  }

  enter () {}

  exit () {}

  setState(NextState) {
    this.exit()
    new NextState(this.file)
  }

  updateName () {}

  destroy () {
    this.exit()
  }

}

// file has no hash and idling
class Hashless extends Base {

  enter () {
    this.file.ctx.fileEnterHashless(this.file) 
  }

  exit () {
    this.file.ctx.fileExitHashless(this.file)
  }

}

// file has no hash and calculating 
class Hashing extends Base {
  
  enter () {
    this.file.ctx.fileEnterHashing(this.file)
    this.start()
  }

  start () {
    let filePath = this.file.abspath()
    let uuid = this.file.uuid

    this.worker = xfingerprint(filePath, uuid, (err, xstat) => {
      delete this.worker

      if (err) {
        this.file.hashFail = (this.file.hashFail || 0) + 1
        if (this.file.hashFail > 3) {
          this.setState(HashFailed)
        } else {
          this.setState(Hashless)
        }
      } else {
        this.file.hash = xstat.hash 
        this.setState(Hashed)
      }
    })
  }

  exit () {
    if (this.worker) {
      this.worker.destroy()
      delete this.worker
    }

    this.file.ctx.fileExitHashing(this.file)
  }

  updateName () {
    this.worker.destroyed() 
    this.start()
  }
}

// file has no hash and won't try calculation any more
class HashFailed extends Base {

  enter () {
    this.file.ctx.fileEnterHashFailed(this.file)
    delete this.file.hashFail
  }

  exit () {
    this.file.ctx.fileExitHashFailed(this.file)
  }

  updateName () {
    // TODO ???
  }
}

// when file has hash
class Hashed extends Base {

  enter () {
    this.file.ctx.fileEnterHashed(this.file)
    delete this.file.hashFail
  }

  exit () {
    this.file.ctx.fileExitHashed(this.file)
  }

  updateName () {
    this.file.ctx.hashedFileNameUpdated(this.file)
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

    /**
    file tags. 
    @type {(array|undefined)}
    */
    this.tags = xstat.tags

    this.ctx.indexFile(this)

    if (!this.hash) {
      new Hashless(this)
    } else {
      new Hashed(this)
    }
  }

  destroy (detach) {
    this.state.destroy() 
    this.ctx.unindexFile(this) 
    super.destroy(detach)
  }

  /**
  For file, update name 
  */
  updateName () {
    this.state.updateName()
  }

  setState (State) {
    // currently, only Hashless -> Hashing is allowed to be set from outside
    assert(this.state instanceof Hashless)
    assert(State === Hashing)
    this.state.setState(State)
  }

}

File.Hashless = Hashless
File.Hashing = Hashing
File.HashFailed = HashFailed
File.Hashed = Hashed

module.exports = File
