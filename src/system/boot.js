const path = require('path')
const fs = require('fs')
const child = require('child_process')

const Developer = require('./developer')
const Config = require('./config')
const Storage = require('./storage')
const fruitmix = require('./boot/fruitmix')
const samba = require('./boot/samba')

const debug = require('debug')('system:boot')

const bootableFsTypes = ['btrfs', 'ext4', 'ntfs']

// extract file systems out of storage object
const extractFileSystems = ({blocks, volumes}) =>
  [ ...blocks.filter(blk => blk.isFileSystem && !blk.isVolumeDevice),
    ...volumes.filter(vol => vol.isFileSystem) ]

const shouldProbeFileSystem = fsys =>
  (fsys.isVolume && fsys.isMounted && !fsys.isMissing)
  || (!fsys.isVolume && fsys.isMounted && (fsys.isExt4 || fsys.isNTFS))

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

const throwError = message => { throw new Error(message) }

const assertFileSystemGood = fsys =>
  (!bootableFsTypes.includes(fsys.fileSystemType))
    ? throwError('unsupported bootable type')
    : (!fsys.isMounted)
      ? throwError('file system is not mounted')
      : (fsys.isVolume && fsys.isMissing)
        ? throwError('file system has missing device')
        : true

const assertReadyToBoot = wisnuc =>
  (!wisnuc || typeof wisnuc !== 'object' || wisnuc.status !== 'READY')
    ? throwError('fruitmix status not READY')
    : true

const assertReadyToInstall = wisnuc =>
  (!wisnuc || typeof wisnuc !== 'object' || wisnuc.status !== 'ENOENT')
    ? throwError('fruitmix status not ENOENT')
    : true

const shutdownAsync = async reboot => {
  let cmd = reboot === true ? 'reboot' : 'poweroff'
  await child.execAsync('echo "PWR_LED 3" > /proc/BOARD_io').reflect()
  await Promise.delay(3000)
  await child.execAsync(cmd)
}

const cfs = fsys => ({ type: fsys.fileSystemType, uuid: fsys.fileSystemUUID, mountpoint: fsys.mountpoint })

module.exports = {

  data: null,
  fruitmix: null,
  samba: null,

  probedStorageAsync: async function () {
    let storage = Storage.get()
    let fileSystems = extractFileSystems(storage)
    await probeAllAsync(fileSystems)
    return storage
  },

  boot(cfs) {

   	this.fruitmix = fruitmix.fork(cfs)
    // this.samba = samba.fork(cfs)
    this.samba = Promise.delay(10000).then(() => {samba.fork(cfs)})
    this.data = { state: 'normal', currentFileSystem: cfs }

    Config.updateLastFileSystem({type: cfs.type, uuid: cfs.uuid})
  },

  // autoboot
  autoBootAsync: async function () {

    let storage = await Storage.refreshAsync() 
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
  },

  // manual boot only occurs in maintenance mode.
  // this operation should not update boot state if failed.
  // target: file system UUID
  // username, password, if install is true or reinstall is true
  manualBootAsync: async function (args) {

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

    this.boot(cfs(fsys))
  },

  // reboot
  rebootAsync: async function (op, target) {

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
  },

  get() {
    return this.data
  },
}

