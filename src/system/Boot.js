const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
const EventEmitter = require('events')

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const UUID = require('uuid')
const debug = require('debug')('Boot')

const { isNonEmptyString } = require('../lib/assertion')
const DataStore = require('../lib/DataStore')
const Fruitmix = require('../fruitmix/Fruitmix')
const { probe, probeAsync, umountBlocksAsync } = require('./storage')

/**
Boot is the top-level container

@module Boot
*/
class State {
  constructor (ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this

    debug('=== entering ===', this.constructor.name)
    this.enter(...args)
    debug('=== entered ===', this.constructor.name)

    this.ctx.emit('StateEntered', this.constructor.name)
  }

  setState (State, ...args) {
    this.exit()
    new State(this.ctx, ...args)
  }

  enter () {
  }

  exit () {
  }

  boundUserUpdated () {
  }

  boundVolumeUpdated () {
  }

  presetLoaded () {
  }

  continuable () {
    if (!this.ctx.boundUser) return false
    if (this.ctx.volumeStore.data === undefined) return false
    if (this.ctx.preset === undefined) return false
    return true
  }

  next () {
    if (this.ctx.bootable()) {
      if (this.ctx.preset && this.ctx.preset.state === 'PENDING') {
        this.setState(Presetting)
      } else {
        this.setState(Starting)
      }
    } else {
      this.setState(Unavailable)
    }
  }

  init (target, mode, callback) {
    process.nextTick(() => callback(new Error('invalid state')))
  }

  import (volumeUUID, callback) {
    process.nextTick(() => callback(new Error('invalid state')))
  }

  repair (devices, mode, callback)  {
    process.nextTick(() => callback(new Error('invalid state')))
  }

  // TODO this is a pure function, or maybe static
  createBoundVolume (storage, volume) {
    let devices = volume.devices.map(dev => {
      let blk = storage.blocks.find(blk => blk.name === dev.name)
      return {
        removable: blk.removable,
        size: blk.size,
        model: blk.model,
        serial: blk.serial,
        btrfsDevice: blk.btrfsDevice,
        idBus: blk.idBus
      }
    })

    return {
      devices,
      label: volume.label,
      uuid: volume.uuid,
      total: volume.total,
      usage: {
        system: { mode: volume.usage.system.mode },
        metadata: { mode: volume.usage.metadata.mode },
        data: { mode: volume.usage.data.mode }
      }
    }
  }
}

/**
Failed
*/
class Failed extends State {
  enter (err) {
    this.err = err
  }
}

/**
Probing the storage
*/
class Probing extends State {
  enter () {
    probe(this.ctx.conf.storage, (err, storage) => {
      if (err) {
        this.setState(ProbeFailed, err)
      } else {
        this.ctx.storage = storage
        if (this.continuable()) {
          this.next()
        } else {
          this.setState(Pending)
        }
      }
    })
  }
}

/**
ProbeFailed
*/
class ProbeFailed extends State {
  enter (err) {
    this.err = err
    this.timer = setTimeout(() => this.setState(Probing), 10000)
    console.log('ProbeFailed', err)
  }

  exit () {
    clearTimeout(this.timer)
  }
}

/**
Pending is a joining state waiting for the following conditions are met.
1. the chassis-user binding is loaded or received, this rule is specific for phicomm device
2. the chassis-volume binding is loaded
3. preset is loaded
*/
class Pending extends State {
  enter () {
  }

  boundUserUpdated () {
    if (this.continuable()) this.next()
  }

  volumeUpdated () {
    if (this.continuable()) this.next()
  }

  presetUpdated () {
    if (this.continuable()) this.next()
  }
}

class Presetting extends State {
  enter () {

  }
}

class Starting extends State {
  enter () {
    let boundVolumeUUID = this.ctx.volumeStore.data.uuid
    let volume = this.ctx.storage.volumes.find(v => v.uuid === boundVolumeUUID)
    let fruitmixDir = path.join(volume.mountpoint, this.ctx.conf.storage.fruitmixDir)
    let opts = Object.assign({}, this.ctx.fruitmixOpts, {
      fruitmixDir,
      boundVolume: this.ctx.volumeStore.data
    })
    let fruitmix = new Fruitmix(opts)

    fruitmix.setStorage(this.ctx.storage)
     
    fruitmix.once('FruitmixStarted', () => this.setState(Started, fruitmix))
  }
}

class Started extends State {
  enter (fruitmix) {
    this.ctx.fruitmix = fruitmix
  }

  exit () {
    this.ctx.fruitmix = null
  }

  boundUserUpdated () {
    // FIXME
  }
}

class Unavailable extends State {
  init (target, mode, callback) {
    let storage = this.ctx.storage
    if (!storage) return process.nextTick(() => callback(new Error('storage not available')))

    if (['single', 'raid1'].indexOf(mode) === -1) {
      return process.nextTick(() => callback(new Error('invalid mode')))
    }

    // target must be non-empty string array with sd? pattern
    if (!Array.isArray(target) ||
      target.length === 0 ||
      !target.every(name => typeof name === 'string') ||
      !target.every(name => /^sd[a-z]$/.test(name))) {
      return process.nextTick(() => callback(new Error('invalid target names')))
    }

    // undup and sort
    let target2 = Array.from(new Set(target)).sort()
    this.setState(Initializing, target2, mode, callback)
  }

  import (volumeUUID, callback) {
    this.setState(Importing, volumeUUID, callback)
  }

  repair (devices, mode, callback)  {
    this.setState(Repairing, devices, mode, callback)
  }
}

/**
for wisnuc legacy, single '/etc/wisnuc.json' file is used.
for wisnuc/phicomm
  <chassisDir>    // located on emmc
    user.json     // single file in json format, maintained by bootstrap, not appifi; for wisnuc, this file
                  // does NOT exist
    volume        // single file containing volume UUID
    <volumeUUID>
      storage.json
      users.json
      drives.json
      tags.json

for tmp
  <chassisDir>
    atmp          // used by appifi
    btmp          // used by bootstrap
*/

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
    this.initAsync(target, mode)
      .then(boundVolume => {
        console.log('init success, go to Probing')
        this.setState(Probing)
        callback(null, boundVolume)
      })
      .catch(e => {
        this.setState(Probing)
        callback(e)
      })
  }

  async initAsync (target, mode) {
    let storage, blocks
    let devnames = []

    // step 1: probe
    storage = await probeAsync(this.ctx.conf.storage)

    // target name and translate to devname (devpath acturally)
    for (let i = 0; i < target.length; i++) {
      let block = storage.blocks.find(blk => blk.name === target[i])
      if (!block) throw new Error(`device ${target[i]} not found`)
      if (!block.isDisk) throw new Error(`device ${target[i]} is not a disk`)
      if (block.unformattable) throw new Error(`device ${target[i]} is not formattable`)
      devnames.push(block.devname)
    }

    debug(`mkfs.btrfs ${mode}`, devnames)

    // step 2: unmount
    await umountBlocksAsync(storage, target)

    // step 3: mkfs
    await child.execAsync(`mkfs.btrfs -d ${mode} -f ${devnames.join(' ')}`)

    // step 4: probe again
    storage = await probeAsync(this.ctx.conf.storage)

    let block = storage.blocks.find(blk => blk.name === target[0])
    if (!block) throw new Error('cannot find a volume containing expected block name')

    let volume = storage.volumes.find(v => v.uuid === block.fileSystemUUID)
    if (!volume) throw new Error('cannot find a volume containing expected block name')

    // ensure bound volume data format
    if (!volume.usage || !volume.usage.system || !volume.usage.metadata || !volume.usage.data) {
      console.log(volume)
      throw new Error('volume usage not properly detected')
    }

    let mp = volume.mountpoint
    let fruitmixDir = this.ctx.conf.storage.fruitmixDir

    // replacing the top dirname, such as <mp>/<uuid>/fruitmix or <mp>/<uuid>
    let rand = UUID.v4()
    let tmpDir = path.join(mp, rand, ...fruitmixDir.split(path.sep).slice(1))

    // such as <mp>/<uuid>
    let src = path.join(mp, rand)
    // such as <mp>/wisnuc or <mp>/phicomm
    let dst = path.join(mp, fruitmixDir.split(path.sep)[0])

    let users = [{
      uuid: UUID.v4(),
      username: 'admin',
      isFirstUser: true,
      isAdmin: true,
      phicommUserId: this.ctx.boundUser.phicommUserId,
      password: this.ctx.boundUser.password,
      status: 'ACTIVE',
      createTime: new Date().getTime(),
      lastChangeTime: new Date().getTime()
    }]

    await mkdirpAsync(tmpDir)
    await fs.writeFileAsync(path.join(tmpDir, 'users.json'), JSON.stringify(users, null, '  '))
    await fs.renameAsync(src, dst)

    let boundVolume = this.createBoundVolume(storage, volume)

    return new Promise((resolve, reject) => {
      this.ctx.volumeStore.save(boundVolume, err => {
        if (err) {
          reject(err)
        } else {
          resolve(boundVolume)
        }
      })
    })
  }
}

/**
for importing an existing volume
*/
class Importing extends State {
  // volumeUUID should be valid!
  enter (volumeUUID, callback) {
    let storage, volume
    try {
      storage = this.ctx.storage
      if (!storage) throw new Error('storage not available')
      if (!storage.volumes || !Array.isArray(storage.volumes) || storage.volumes.length === 0) throw new Error('storage.volumes not available')
      volume = storage.volumes.find(v => v.uuid === volumeUUID)
      if (!volume) throw new Error('volume not found')

      if (volume.isMissing) throw new Error('volume is missing')

      let supportMode = ['single', 'raid1']
      if (!volume.usage || !volume.usage.data || typeof volume.usage.data.mode !== 'string') throw new Error('volume usage error')

      if (!supportMode.includes(volume.usage.data.mode.toLowerCase())) throw new Error('volume mode not support')

      if (!Array.isArray(volume.users)) throw new Error('volume users not found')

      let firstUser = volume.users.find(u => u.isFirstUser === true)
      if (!firstUser) throw new Error('volume admin not found')
      if (firstUser.phicommUserId !== this.ctx.boundUser.phicommUserId) throw new Error('volume admin <-> boundUser mismatch')
    } catch (e) {
      return process.nextTick(() => {
        this.setState(Probing)
        callback(e)
      })
    }

    let boundVolume = this.createBoundVolume(storage, volume)
    this.ctx.volumeStore.save(boundVolume, err => {
      this.setState(Probing)
      if (err) return callback(err)
      return callback(null, boundVolume)
    })
  }
}

/**
for repairing a broken volume
*/
class Repairing extends State {
  enter (devices, mode, callback) {
    this.repairAsync(devices, mode)
      .then(data => {
        console.log('init success, go to Probing')
        this.setState(Probing)
        callback(null, data)
      })
      .catch(e => {
        console.log(e)
        this.setState(Probing)
        callback(e)
      })
  }

  async repairAsync (devices, mode) {
    
    let storage, volume, volumeDevice, boundVolume, oldDevice, devnames = []

    storage = await probeAsync(this.ctx.conf.storage)

    boundVolume = this.ctx.volumeStore.data
    if (!boundVolume) throw new Error('have not bound volume')
    if (boundVolume.devices.length !== 2) throw new Error('boundVolume only 1 device')
    let volumeUUID = boundVolume.uuid

    volume = storage.volumes.find(v => v.uuid === volumeUUID)
    if (!volume) throw new Error('boundVolume not found')
    if (!volume.missing) throw new Error('volume is complete')
    volumeDevice = volume.devices.filter(d => !!d.name)
    if (volumeDevice.length !== 1) throw new Error('volume can not repair, no block found')
    // vaildate
    devices.forEach(d => {
      if (isNonEmptyString(d.name)) {
        let block = storage.blocks.find(b => b.name === d.name)
        if (!block) throw new Error(`device ${ d.name } not found`)
        if (isNonEmptyString(d.model)) {
          if (block.model !== d.model) throw new Error(d.name + ' model mismatch')
          if (block.serial !== d.serial) throw new Error(d.name + ' serial mismatch')
        }
        d.model = block.model
        d.serial = block.serial
      } else {
        let block = storage.blocks.find(b => b.model === d.model && b.serial === d.serial)
        if (!block) throw new Error('device not found')
        d.name = block.name
      }
    })

    let vd = devices.find(d => d.name === volumeDevice[0].name)
    oldDevice = boundVolume.devices.find(d => d.model === vd.model && d.serial === vd.serial)
    if (!oldDevice) throw new Error('old device not found')
    oldDevice = Object.assign({}, oldDevice, volumeDevice[0])

    console.log('=====================')
    console.log('OldDevice: ', oldDevice)

    console.log('Devices: ', devices)
    console.log('=====================')

    if (!devices.find(d => d.name === oldDevice.name))
      throw new Error('devices not contain any old device')

    for (let i = 0; i < devices.length; i++) {
      let block = storage.blocks.find(blk => blk.name === devices[i].name)
      if (!block) throw new Error(`device ${devices[i]} not found`)
      if (!block.isDisk) throw new Error(`device ${devices[i]} is not a disk`)
      if (block.unformattable) throw new Error(`device ${devices[i]} is not formattable`)
      devnames.push(Object.assign(devices[i], { devname:block.devname }))
    }

    let oldMode = boundVolume.usage.data.mode.toLowerCase()
    let supportMode = ['single', 'raid1']
    
    if (supportMode.indexOf(mode) === -1) throw new Error('mode error')

    await umountBlocksAsync(storage, devices.map(d => d.name))

    // mount as degraded
    try {
      await child.execAsync(`mount -t btrfs -o degraded ${ oldDevice.path } ${ volume.mountpoint }`)
    } catch(e) {
      Promise.delay(100)
      await child.execAsync(`mount -t btrfs -o degraded ${ oldDevice.path } ${ volume.mountpoint }`)
    }
    await child.execAsync('partprobe')
    if (oldMode === 'single') {
      if (devices.length == 1) {
        if (mode !== 'single') throw new Error('Only can make single in one device')
        await child.execAsync(`btrfs balance start -f -mconvert=single ${ volume.mountpoint }`)
        await child.execAsync(`btrfs device delete missing ${ volume.mountpoint }`)
        await child.execAsync(`btrfs balance start -f -mconvert=dup ${ volume.mountpoint }`)
      } else {
        let addDevice = devnames.filter(d => d.name !== oldDevice.name ).map(v => v.devname)
        await child.execAsync(`btrfs device add -f ${ addDevice.join(' ') } ${ volume.mountpoint }`)
        await child.execAsync(`btrfs device delete missing ${ volume.mountpoint }`)
        if (!mode === 'single') { // raid1
          await child.execAsync(`btrfs balance start -f -dconvert=raid1 ${ volume.mountpoint }`)
        }
      }
    } else if (oldMode === 'raid1') {
      if (devices.length == 1) {
        if (mode !== 'single') throw new Error('Only can make single in one device')
        await child.execAsync(`btrfs balance start -f -mconvert=single -dconvert=single ${ volume.mountpoint }`)
        await child.execAsync(`btrfs device delete missing ${ volume.mountpoint }`)
        await child.execAsync(`btrfs balance start -f -mconvert=dup ${ volume.mountpoint }`)
      } else {
        let addDevice = devnames.filter(d => d.name !== oldDevice.name ).map(v => v.devname)
        await child.execAsync(`btrfs device add -f ${ addDevice.join(' ') } ${ volume.mountpoint }`)
        await child.execAsync(`btrfs device delete missing ${ volume.mountpoint }`)
        if (mode === 'single') { // raid1
          await child.execAsync(`btrfs balance start -f -dconvert=single  ${ volume.mountpoint }`)
        }
      }
    } else {
      throw new Error('unsupport old mode')
    }

    storage = await probeAsync(this.ctx.conf.storage)
    let newVolume = storage.volumes.find(v => v.uuid === volume.uuid)
    if (!newVolume) throw new Error('cannot find a volume containing expected block name')

    // ensure bound volume data format
    if (!newVolume.usage || !newVolume.usage.system || !newVolume.usage.metadata || !newVolume.usage.data) {
      console.log(newVolume)
      throw new Error('volume usage not properly detected')
    }
    console.log('=============')
    console.log(newVolume)
    console.log('=============')
    // update boundVolume
    let newBoundVolume = this.createBoundVolume(storage, newVolume)
    console.log('=======newBoundVolume', newBoundVolume)
    return new Promise((resolve, reject) => {
      this.ctx.volumeStore.save(newBoundVolume, err => {
        if (err) {
          reject(err)
        } else {
          resolve(newBoundVolume)
        }
      })
    })
  }
}

/**

*/
class Boot extends EventEmitter {
  /**
  Creates a Boot object

  @param {object} opts - options
  @param {Configuration} opts.configuration - application-wide configuration
  @param {object} opts.fruitmixOpts - fruitmix options
  */
  constructor (opts) {
    super()

    if (!opts.configuration) throw new Error(`boot requires a configuration`)

    this.conf = opts.configuration
    this.fruitmixOpts = opts.fruitmixOpts
    this.error = null
    this.fruitmix = null

    this.preset = undefined

    this._storage = undefined
    Object.defineProperty(this, 'storage', {
      get () {
        return this._storage
      },
      set (value) {
        let oldValue = this._storage
        this._storage = value
        process.nextTick(() => this.emit('StorageUpdate', value, oldValue))
      }
    })

    this.prepareChassisDirs(err => {
      if (err) {
        // will halt boot @ pending state after probing
        this.error = err
      } else {
        this.volumeStore = new DataStore(this.storeOpts('volume'))
        this.volumeStore.on('Update', () => this.state.boundVolumeUpdated())

        // for preset, preserve a copy
        this.presetStore = new DataStore(this.storeOpts('preset'))
        this.presetStore.once('Update', data => {
          if (data) {
            this.preset = { state: 'PENDING', data }
            this.presetStore.save(null, () => {})
          } else {
            this.preset = null
          }
          this.state.presetLoaded()
        })
      }
    })

    new Probing(this)
  }

  stateName () {
    return this.state.constructor.name
  }

  storeOpts (name) {
    return {
      file: path.join(this.conf.chassis.dir, `${name}.json`),
      tmpDir: path.join(this.conf.chassis.tmpDir, name)
    }
  }

  async prepareChassisDirsAsync () {
    let { dir, tmpDir } = this.conf.chassis
    await mkdirpAsync(dir)
    await rimrafAsync(tmpDir)
    mkdirpAsync(tmpDir)
  }

  prepareChassisDirs (callback) {
    this.prepareChassisDirsAsync()
      .then(() => callback())
      .catch(e => (console.log(e), callback(e)))
  }

  bootable () {
    if (!this.boundUser) return false // no bound user
    if (!this.volumeStore.data) return false // no bound volume

    let vol = this.storage.volumes.find(v => v.uuid === this.volumeStore.data.uuid)
    if (!vol) return false // bound volume not found
    if (vol.missing) return false // bound volume has missing device
    if (!Array.isArray(vol.users)) return false // users.json not ready

    let firstUser = vol.users.find(u => u.isFirstUser === true)
    if (!firstUser) return false // firstUser not found
    if (firstUser.phicommUserId !== this.boundUser.phicommUserId) return false

    return true
  }

  setBoundUser (user) {
    this.boundUser = user
    this.state.boundUserUpdated()
  }

  view () {
    return {
      state: this.state.constructor.name.toUpperCase(),
      boundUser: this.boundUser ? { phicommUserId: this.boundUser.phicommUserId } : this.boundUser,
      boundVolume: this.volumeStore.data,
      storage: this.storage,
      preset: this.preset
    }
  }

  init (target, mode, callback) {
    this.state.init(target, mode, callback)
  }

  import (volumeUUID, callback) {
    this.state.import(volumeUUID, callback)
  }

  repair (device, mode, callback) {
    this.state.repair(device, mode, callback)
  }

  getStorage () {
  }

  GET (user, props, callback) {
    process.nextTick(() => callback(null, this.view()))
  }

  PATCH (user, props, callback) {
    let target = props.target
    let mode = props.mode
    this.init(target, mode, callback)
  }

}

module.exports = Boot
