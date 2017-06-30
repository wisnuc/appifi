const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))

const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirpAsync = Promise.promisify(mkdirp)

const broadcast = require('../common/broadcast')

const Config = require('./config')
const Storage = require('./storage')
const User = require('../fruitmix/models/user')
const fruitmix = require('./boot/fruitmix')
const samba = require('./boot/samba')

const debug = require('debug')('system:boot')

const bootableFsTypes = ['btrfs']

/**

@module Boot
*/

/**

  this module should not change anything on file system

  { status: 'EFAIL' } operation error
  { status: 'ENOENT' or 'ENOTDIR' } fruitmix not found
  { status: 'EDATA' } fruitmix installed but user data not found or cannot be parsed
  { status: 'READY', users: [...] } empty users are possible

**/
const probeAsync = async mountpoint => {

  let froot = path.join(mountpoint, 'wisnuc', 'fruitmix')

  // test fruitmix dir
  try {
    await fs.readdirAsync(froot)
  }
  catch (e) {

    if (e.code !== 'ENOENT' && e.code !== 'ENODIR') 
      e.code = 'EFAIL'
    throw e
  }

  // retrieve users
  try {
    let json = await fs.readFile(path.join(froot, 'models', 'users.json'))
    let data = JSON.parse(json) 
  }
  catch (e) {

    if (e.code === 'ENOENT' || e.code === 'EISDIR' || e instanceof SyntaxError)
      e.code = 'EDATA'

    throw e
  }
}

// extract file systems out of storage object
const extractFileSystems = ({blocks, volumes}) =>
  [ ...blocks.filter(blk => blk.isFileSystem && !blk.isVolumeDevice),
    ...volumes.filter(vol => vol.isFileSystem) ]

/**
*/
const shouldProbeFileSystem = fsys => 
  (fsys.isVolume && fsys.isMounted && !fsys.isMissing)

/**
*/
const probeAllAsync = async fileSystems =>
  Promise.map(fileSystems.filter(shouldProbeFileSystem),
    async fsys => {
      try {
        fsys.wisnuc = await fruitmix.probeAsync(fsys.mountpoint)
      }
      catch (e) {
        fsys.wisnuc = { status: 'EFAIL' }
      }
    })

/**
*/
const throwError = message => { throw new Error(message) }

/**
*/
const assertFileSystemGood = fsys =>
  (!bootableFsTypes.includes(fsys.fileSystemType))
    ? throwError('unsupported bootable type')
    : (!fsys.isMounted)
      ? throwError('file system is not mounted')
      : (fsys.isVolume && fsys.isMissing)
        ? throwError('file system has missing device')
        : true
/**
*/
const assertReadyToBoot = wisnuc =>
  (!wisnuc || typeof wisnuc !== 'object' || wisnuc.status !== 'READY')
    ? throwError('fruitmix status not READY')
    : true

/**
*/
const assertReadyToInstall = wisnuc =>
  (!wisnuc || typeof wisnuc !== 'object' || wisnuc.status !== 'ENOENT')
    ? throwError('fruitmix status not ENOENT')
    : true

/**
*/
const shutdownAsync = async reboot => {
  let cmd = reboot === true ? 'reboot' : 'poweroff'
  await child.execAsync('echo "PWR_LED 3" > /proc/BOARD_io').reflect()
  await Promise.delay(3000)
  await child.execAsync(cmd)
}

/**
*/
const cfs = fsys => ({ type: fsys.fileSystemType, uuid: fsys.fileSystemUUID, mountpoint: fsys.mountpoint })

module.exports = new class {

  constructor() {

    this.state = 'starting'

    this.error = null

    this.currentFileSystem = null

    broadcast
      .until('ConfigUpdate', 'StorageUpdate')
      .then(() => this.initAsync()
        .then(() => {})
        .catch(e => {

          this.state = 'failed',
          this.error = e.message
          this.currentFileSystem = null

        }))
  }

  boot(cfs) {

    this.fruitmix = fruitmix.fork(cfs)
    this.samba = Promise.delay(10000).then(() => {samba.fork(cfs)})
    this.data = { state: 'normal', currentFileSystem: cfs }

    Config.updateLastFileSystem({type: cfs.type, uuid: cfs.uuid})
  }

  async initAsync() {

    let storage = Storage.pretty

    let fileSystems = extractFileSystems(storage)
    await probeAllAsync(fileSystems)

    let last = Config.get().lastFileSystem
    if (last) {    

      let { type, uuid } = last
      let fsys = fileSystems.find(f => f.fileSystemType === type && f.fileSystemUUID === uuid)

      if (fsys) {
        try {

          assertFileSystemGood(fsys)
          assertReadyToBoot(fsys.wisnuc)

          this.boot(cfs(fsys))
        }
        catch (e) {
					console.log('[autoboot] failed to boot lastfs', last, e)
          this.data = { state: 'maintenance', error: 'EFAIL', message: e.message }
        }

    		console.log('[autoboot] boot state', this.data)

        return
      }
    } 
    else {
      console.log('[autoboot] no lastfs')
    }

    // find all good and ready-to-boot file systems
    let alts = fileSystems.filter(f => {
      try { 
        assertFileSystemGood(f)
        assertReadyToBoot(f.wisnuc)
        return true
      } 
      catch(e) {
        return false
      } 
    })

    if (alts.length === 1)
      this.boot(cfs(alts[0]))
    else 
      this.data = { state: 'maintenance', error: alts.length === 0 ? 'ENOALT' : 'EMULTIALT' }

    console.log('[autoboot] boot state', this.data)
  }

  // manual boot only occurs in maintenance mode.
  // this operation should not update boot state if failed.
  // target: file system UUID
  // username, password, if install is true or reinstall is true
  async manualBootAsync(args) {

    if (this.data.state !== 'maintenance') throw new Error('not in maintenance mode')    

    let { target, username, password, install, reinstall } = args 

    let storage = await Storage.refreshAsync() 
    let fileSystems = extractFileSystems(storage)

    let fsys = fileSystems.find(f => f.uuid === target)
    if (!fsys) throw Object.assign(new Error('target not found'), { code: 'ENOENT' })

    assertFileSystemGood(fsys)
    let wisnuc = await fruitmix.probeAsync(fsys.mountpoint)

    if (reinstall === true || install === true) {
      if (reinstall) {
        await rimrafAsync(path.join(fsys.mountpoint, 'wisnuc'))
        await mkdirpAsync(path.join(fsys.mountpoint, 'wisnuc', 'fruitmix'))
      }
      else {
        assertReadyToInstall(wisnuc)
      }
    }
    else { // direct boot, fruitmix status must be 'READY'
      assertReadyToBoot(wisnuc) 
    }

    Config.merge({ bootMode: 'normal'})
    await Promise.delay(200)

    this.boot(cfs(fsys))
  }

  // reboot
  async rebootAsync(op, target) {

    switch(op) {
    case 'poweroff':
      shutdownAsync(false).asCallback(() => {})
      break

    case 'reboot':
      shutdownAsync(true).asCallback(() => {})
      break

    case 'rebootMaintenance':
      Config.updateBootMode('maintenance')
      shutdownAsync(true).asCallback(() => {})
      break

    case 'rebootNormal':
      // should check bootability ??? TODO
      if (target) 
        Config.updateLastFileSystem({ type: 'btrfs', uuid: target }, true)
      else
        Config.updateBootMode('normal')

      shutdownAsync(true).asCallback(() => {})
      break

    default:
      throw new Error('unexpected case') // TODO
    }
  }

  get() {
    return this.data
  }
}


