const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
// const mkdirpAsync = Promise.promisify(require('mkdirp'))
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
@property {string} lastFileSystem - last booted file system containing fruitmix and appifi
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

module.exports = new class {
  constructor () {
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
  @listens FanScaleUpdate
  @listens BootModeUpdate
  @listens FileSystemUpdate
  @listens NetworkInterfacesUpdate
  */
  async initAsync () {
    let cwd = process.cwd()

    // initialize paths
    if (process.env.NODE_ENV === 'test') {
      this.filePath = path.join(cwd, 'tmptest', 'wisnuc.json')
      this.tmpDir = path.join(cwd, 'tmp')
    } else {
      this.filePath = '/etc/wisnuc.json'
      this.tmpDir = '/etc/wisnuc-tmp'
    }

    // initialize member
    this.config = Object.assign({}, defaultConfig)
    this.persistence = await createPersistenceAsync(this.filePath, this.tmpDir, 50)

    // load file
    try {
      this.config = JSON.parse(await fs.readFileAsync(this.filePath))
    } catch (e) {
      this.config = defaultConfig
    }

    deepFreeze(this.config)

    broadcast.on('FanScaleUpdate', (err, data) => err || this.update({barcelonaFanScale: data}))
    broadcast.on('FileSystemUpdate', (err, data) => err || this.update({lastFileSystem: data}))
    broadcast.on('NetworkInterfacesUpdate', (err, data) => err || this.update({networkInterfaces: data}))
    broadcast.on('BootModeUpdate', (err, data) => err || this.update({ bootMode: data }))
  }

  /**
  Update configuration
  */
  update (props) {
    this.config = Object.assign({}, this.config, props)
    deepFreeze(this.config)
    this.persistence.save(this.config)
    process.nextTick(() => broadcast.emit('ConfigUpdate', null, this.config))
  }
}()
