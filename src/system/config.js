const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const validator = require('validator')
const deepFreeze = require('deep-freeze')

const broadcast = require('../common/broadcast') 
const createPersistenceAsync = require('../common/persistence')

/**
This module maintains station-wide configuration.

It requries a file to persist data and a temporary file directory.

In `production` mode, the paths are `/etc/wisnuc.json` and `/etc/wisnuc-tmp`, respectively.
In `test` mode, the paths are `<cwd>/tmptest/wisnuc.json` and `<cwd>/tmptest/tmp`, respectively.


@module   Config
@requires Broadcast
@requires Persistence
*/

/**
Fired when `Config` module initialized.

@event ConfigUpdate
@global
*/

/**
`Config` is an data type internally used in this module. It's JSON equivalent is persisted to a file.

@typedef {object} Config
@property {number} version - configuration version, 1 for current version.
@property {(null|string)} dockerInstall - docker install path other than default
@property {object} lastFileSystem - last booted file system containing fruitmix and appifi
@property {string} lastFileSystem.type - file system type, only btrfs is used in current version
@property {string} lastFileSystem.uuid - file system uuid
@property {string} bootMode - normal or maintenance
@property {number} barcelonaFanScale - barcelona specific setting
@property {networkInterfaceConfig[]} networkInterfaces - a list of network interface config.
*/

/**
Default config object if config file not found or NODE_ENV is `test`

@const
@type {Config}
*/
const defaultConfig = {
  lastFileSystem: null,
  bootMode: 'normal',
  barcelonaFanScale: 50,
  networkInterfaces: []
} 

/** validate uuid string TODO **/
const isUUID = uuid => typeof uuid === 'string' && validator.isUUID(uuid)

/** validate last file system object **/
const isValidLastFileSystem = lfs => lfs === null || (lfs.type === 'btrfs' && isUUID(lfs.uuid))

/** validate boot mode **/
const isValidBootMode = bm => bm === 'normal' || bm === 'maintenance'

/** validate fan scale **/
const isValidBarcelonaFanScale = bfs => Number.isInteger(bfs) && bfs >= 0 && bfs <= 100

/** valdiate ipaliasing **/
const isValidIpAliasing = arr => 
  arr.every(ia => 
    typeof ia.mac === 'string' 
    && validator.isMACAddress(ia.mac)
    && typeof ia.ipv4 === 'string'
    && validator.isIP(ia.ipv4, 4))

/*
const isCIDR = str =>
  typeof str === 'string'
  && str.split('/').length === 2
  && validator.isIP(str.split('/')[0], 4)
  && 

const isValidNetworkInterfaceConfig = arr =>
  arr.every(nic => 
    typeof nic.name === 'string'
    && Array.isArray(nic.aliases)
    && 
*/

module.exports = new class {

  constructor() {

    /**
    Configuration
    @member config
    @type {Config}
    */
    this.config = null

    /**
    Persistence worker for persisting config file    

    @member persistence
    @type {Persistence}
    */
    this.persistence = null

    /**
    Config file path

    @member filePath 
    @type {string}
    */
    this.filePath = ''

    /**
    Temp dir for saving config file
    @member tmpDir
    @type {string}
    */
    this.tmpDir = ''

    this.initAsync()
      .then(() => broadcast.emit('ConfigUpdate', null, this.config))
      .catch(e => broadcast.emit('ConfigUpdate', e))
  }

  /**
  Load and validate config from file, or set it to default.
  @inner
  @fires ConfigUpdate
  */
  async initAsync() {

    let cwd = process.cwd()

    // initialize paths
    if (process.env.NODE_ENV === 'test') {

      this.filePath = path.join(cwd, 'tmptest', 'wisnuc.json')
      this.tmpDir = path.join(cwd, 'tmp')
    }
    else {

      this.filePath = '/etc/wisnuc.json'
      this.tmpDir = '/etc/wisnuc-tmp'
    }

    // initialize member
    this.config = Object.assign({}, defaultConfig)
    this.persistence = await createPersistenceAsync(this.filePath, this.tmpDir, 50)

    // load file
    let read, dirty = false
    try { 
      read = JSON.parse(await fs.readFileAsync(fpath)) 
    } 
    catch (e) {
      // ingore all errors 
    }

    if (!read) {
      dirty = true
    }
    else {

      this.config = read

      if (isValidLastFileSystem(read.lastFileSystem))
        Object.assign({}, this.config, { lastFileSystem: read.lastFileSystem })

      if (isValidBootMode(read.bootMode))
        Object.assign({}, this.config, { bootMode: read.bootMode })

      if (isValidBarcelonaFanScale(read.barcelonaFanScale))
        Object.assign({}, this.config, { barcelonaFanScale: read.barcelonaFanScale })

      if (isValidIpAliasing(read.ipAliasing))
        Object.assign({}, this.config, { ipAliasing: read.ipAliasing })

      if (this.config !== read) dirty = true
    }

    deepFreeze(this.config)

    if (dirty) this.persistence.save(this.config)
  }

  /**
  @inner TODO boot calls this function
  */
  merge(props) {

    this.config = Object.assign({}, this.config, props)
    deepFreeze(this.config)

    this.persistence.save(this.config)

    process.nextTick(() => broadcast.emit('ConfigUpdate', null, this.config))
  }

  /**
  
  */
  updateLastFileSystem(lfs, forceNormal) {

    if (!isValidLastFileSystem(lfs)) return 
    if (forceNormal !== undefined && typeof forceNormal !== 'boolean') return
    let lastFileSystem = { type: 'btrfs', uuid: lfs.uuid }
    if (forceNormal) 
      this.merge({ lastFileSystem, bootMode: 'normal' })
    else
      this.merge({ lastFileSystem })
  }

  /**
  update boot mode in configuration file.
  */
  updateBootMode(bm) {
    isValidBootMode(bm) && this.merge({ bootMode: bm })
  }

  /**
  update barcelona fan scale
  */ 
  updateBarcelonaFanScale(bfs) {
    isValidBarcelonaFanScale(bfs) && this.merge({ barcelonaFanScale: bfs })
  }

  /**
  update ip aliasing
  */
  updateIpAliasing(arr) {
    isValidIpAliasing(arr) && this.merge({ ipAliasing: arr })
  }

  updateNetworkInterfaces(networkInterfaces) {
    this.merge({ networkInterfaces })
  }

  /**
  Get current configuration.
  */
  get() {
    return this.config
  }
}


