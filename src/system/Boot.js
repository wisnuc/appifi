const Promise = require('bluebird')
const EventEmitter = require('events')

const m

const { probe, umountBlocks } = require('./storage') 

/**
Boot is the top-level container

@module Boot
*/
class State {

  constructor (ctx, ...args) {
    this.ctx = ctx 
    this.ctx.state = this
    this.enter(...args)
  }

  setState(State, ...args) {
    this.exit()
    new State(...args)
  }

  enter (...args) {
  }

  exit () {
  }

}

class Probing extends State {

  enter () {
    probe(this.ctx.configs, (err, storage) => {
      if (err) {
        this.setState(ProbeFailed)
      } else {
        this.ctx.storage = storage
        if (this.ctx.admin) {
          if (this.ctx.volumeUsable) {
            if (this.ctx.preset && this.ctx.preset.state === 'Pending') {
              this.setState(Presetting) 
            } else {
              this.setState(Starting)
            }
          } 
        } else {
          this.setState(Pending)
        }
      }
    })
  }
}

class ProbeFailed extends State {

  enter () {
    this.timer = setTimeout(() => this.setState(Probing), 10000)
  }

  exit () {
    clearTimeout(this.timer)
  }
}

class Pending extends State {

  enter () {
    this.next()
  }

  adminUpdated () {
    this.next()
  }

  volumeUpdated () {
    this.next() 
  }

  presetUpdated () {
    this.next()
  }

  next () {
    if (this.ctx.bootable()) {
      if (this.ctx.preset && this.ctx.preset.state === 'PENDING') {
        this.setState(Presetting)
      } else {
        this.setState(Starting)
      }
    }
  }
}

class Presetting extends State {

  enter () {
    
  }
}

class Starting extends State {

}

class Started extends State {

}

/**
`Initialization` is an exclusive process to create the bound volume through the following steps:

1. probe and get the latest storage status.
2. umount devices
3. mkfs.btrfs
4. probe again (this is because there is a bug in mkfs.btrfs output and the output format changes)
5. find newly created volume containing given devices
6. create users.json in a temporary directory and then rename the directory to prevent leaving an empty fruitmix dir.
7. save volume information into store.

The callers shall validate arguments before state transition.
*/
class Initializing extends State {

  // target should be valid!
  enter (target, mode, callback) {
    // step 1: probe
    probe(this.ctx.configs, (err, storage) => {
      if (err) {
        callback(err)
        this.setState(Probing)
      } else {
        this.ctx.storage = storage
        
        // step 2: unmount disks
        umountBlocks(storage, target, err => {
          if (err) {
            callback(err)
            this.setState(Probing)
          } else {

            // step 3: mkfs
            child.exec(`mkfs.btrfs -d ${mode} -f ${devnames.join(' ')}`, err => {
              if (err) {
                callback(err)
                this.setState(Probing)
              } else {

                // step 4: probe again
                probe(this.ctx.configs, (err, storage) => {
                  if (err) {
                    callback(err)
                    this.setState(Probing)
                  } else {
                    // find the volume containing target
                    // construct the volume persistent
                    let volume = 'anything'
                    let snapshot = 'something' 
                    this.ctx.volumeStore.save(snapshot, err => {
                      
                    })

                    let fruitmixDir = path.join(volume.mountpoint, `???`)
                    mkdirp((fruitmixDir, err => {
                      if (err) {
                        callback(err)
                        this.setState(Probing)
                      } else {
                        
                      }
                    }) 
                  }
                })
              }
            })
          } 
        }) 
      }
    })
  }
}

class Importing extends State {

}

class Repairing extends State {

}

class Boot extends EventEmitter {

  /**
  Creates a Boot 
 
  @param {Configuration} config - Configuration object
  @param 
  */
  constructor(configs, opts) {
    super()

    this.configs = configs
      

    this.chassisDir
    this.chassisTmpDir = path.join(chassisDir, 'atmp')
    this.chassisError = null

    this.prepareChassisDirs(err => {
      if (err) {
        // will halt boot @ pending state after probing
        this.chassisError = err
      } else {
        this.volumeStore = new FileStore()
        this.volumeStore.once('update', () => this.state.storeLoaded())

        // for preset, preserve a cop
        this.presetStore = new FileStore()
        this.presetStore.once('update', data => {
          if (data) {
            this.preset = { state: 'PENDING', data }
            this.presetStore.save(null, () => {})
          } else {
            this.preset = null
          }

          this.state.storeLoaded()
        })

        this.usersStore = new FileStore()
        this.drivesStore = new FileStore()
        this.tagsStore = new FileStore()
      }
    })
  }

  prepareChassisDirs (callback) {
    (async () => {
      await mkdirpAsync(this.chassisDir)
      await rimrafAsync(this.chassisTmpDir)
      await mkdirpAsync(this.chassisTmpDir)
    })()
      .then(() => callback())
      .catch(e => callback(e)
  }

  bootable () {
    if (!this.admin) return false               // no bound user
    if (!this.volume) return false              // no bound volume

    let vol = this.storage.volumes.find(this.volume.uuid)
    if (!vol) return false                      // bound volume not found
    if (vol.missing) return false               // bound volume has missing device
    if (!Array.isArray(vol.users)) return false // users.json not ready
    
    return true
  }
}

module.exports = Boot
