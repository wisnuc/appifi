const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

const { isUUID } = require('../lib/assertion')

/**
Chassis is responsible for loading file from or saving file to emmc.

@module Chassis
*/

class State {
  
  constructor (ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)
    this.ctx.emit('Entered', this.constructor.name)
  } 

  setState (State, ...args) {
    this.exit()
    new State(this.ctx, ...args)
  }

  enter () {}
  exit () {}
  save() {}
}

class Failed extends State {

  enter (err) {
    this.err = err
    // TODO log err crit or above
  } 
}

class Loading extends State {

  enter () {
    this.loadAsync()
      .then(uuid => {
        this.ctx.volumeUUID = uuid 
        this.setState(Saving)
      })
      .catch(e => {
        this.setState(Failed, e)
      })
  }

  async loadAsync () {
    await mkdirpAsync(this.ctx.dir)
    await rimrafAsync(this.ctx.tmpDir)
    await mkdirpAsync(this.ctx.tmpDir)

    let filePath = path.join(this.ctx.dir, 'volume')

    try {
      let uuid = (await fs.readFileAsync(filePath)).toString()
      if (isUUID(uuid)) {
        return uuid
      } else {
        return 
      }
    } catch (e) {
      if (e.code === 'ENOENT') {
        return
      } else {
        e.where = `${path.basename(__filename)}, Loading::loadAsync`
        throw e
      }
    }
  }
}

class Idle extends State {

  save () {
    this.setState(Saving)
  }
}

class Saving extends State {
  enter () {
    let q = this.ctx.queue
    if (q.length === 0) {
      // otherwise the enter event emission will be in reversed sequence
      process.nextTick(() => this.setState(Idle))
    } else {
      let kv = q.shift()
      let tmpPath = path.join(this.ctx.tmpDir, UUID.v4())
      let filePath = path.join(this.ctx.dir, kv.key)
      fs.writeFile(filePath, JSON.stringify(kv.value, null, '  '), err => {
        if (err) {
          // log('warn', `Chassis: error saving file`)
          this.setState(Saving)
        } else {
          fs.rename(tmpPath, filePath, err => {
            if (err) console.log(`Chassis: error moving file`)
            this.setState(Saving)
          })
        }
      })
    }
  }
}

/**
for wisnuc legacy, single '/etc/wisnuc.json' file is used.
for wisnuc/phicomm
  <chassisDir>    // located on emmc
    user.json     // single file in json format, maintained by bootstrap, not appifi; for wisnuc, this file 
                  // does NOT exist
    volume.json        // single file containing volume UUID
    <volumeUUID>
      // storage.json 
      users.json
      drives.json
      tags.json 
    <volumeUUID>

for tmp
  <chassisDir>
    atmp          // used by appifi
    btmp          // used by bootstrap
*/
class Chassis extends EventEmitter {

  /**
  Creates a Chassis object

  @param {object} opts - options
  @param {type} opts.type - 'WISNUC' or 'PHICOMM'
  @param {string} opts.dir - directory located on emmc/rootfs
  */
  constructor (opts) {
    super()
    this.type = opts.type
    this.dir = opts.dir
    this.tmpDir = path.join(this.dir, 'atmp')

    this.volume = new FileStore(this.dir, this.tmpDir, 'volume')
    this.network = new FileStore(this.dir, this.tmpDir, 'network')
    this.fan = new FileStore(this.dir, this.tmpDir, 'fan')
    this.preset = new FileStore(this.dir, this.tmpDir, 'preset')
  }

}

module.exports = Chassis
 
