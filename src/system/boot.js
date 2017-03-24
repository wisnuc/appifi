const path = require('path')
const fs = require('fs')
const child = require('child_process')

const Developer = require('./developer')
const Config = require('./config')
const Storage = require('./storage')
const probeFruitmixAsync = require('./fruitmix')

const debug = require('debug')('system:boot')

const bootableFsTypes = ['btrfs']

const decorateStorageAsync = async pretty => {

  let mps = [] 

  pretty.volumes.forEach(vol => {
    if (vol.isMounted && !vol.isMissing) mps.push({
      ref: vol,
      mp: vol.mountpoint
    })
  })

  pretty.blocks.forEach(blk => {
    if (!blk.isVolumeDevice && blk.isMounted && blk.isExt4)
      mps.push({
        ref: blk,
        mp: blk.mountpoint
      })
  })

  await Promise
    .map(mps, obj => probeFruitmixAsync(obj.mp).reflect())
    .each((inspection, index) => {
      if (inspection.isFulfilled())
        mps[index].ref.wisnuc = inspection.value() 
      else {
        console.log(inspection.reason())
        mps[index].ref.wisnuc = 'ERROR'
      }
    })

  return pretty
}

const throwError = message => { throw new Error(message) }

const assertFileSystemGood = fsys =>
  (!bootableFsTypes.includes(fsys.type))
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

const getFileSystems = ({blocks, volumes}) => 
  [
    ...blocks.filter(blk => blk.isFileSystem && !blk.isVolumeDevice),  
    ...volumes.filter(vol => vol.isFileSystem) 
  ]

// 
const simplify = fsys => ({ 
  type: fsys.fileSystemType, 
  uuid: fsys.fileSystemUUID, 
  mountpoint: fsys.mountpoint
})

module.exports = {

  data: null,

  decoratedStorageAsync: async function () {
    let pretty = Storage.get()
    return await decorateStorageAsync(pretty)
  },

  boot(fsys, username, password) {

    let modpath = path.resolve(__dirname, '..', 'fruitmix/main.js')     
    let message = {
      type: 'START',
      path: path.join(fsys.mountpoint, 'wisnuc', 'fruitmix'),
      username, password
    } 

    let fruitmix = child.fork(modpath)
    fruitmix.send(message)
    
    Config.updateLastFileSystem({type: fsys.fileSystemType, uuid: fsys.fileSystemUUID})
  },

  // autoboot
  autoBootAsync: async function () {

    let last = Config.get().lastFileSystem
    let pretty = await Storage.refreshAsync(true) 
    let decorated = await decorateStorageAsync(pretty)
    let fileSystems = getFileSystems(decorated)

    console.log('[SYSBOOT] storage and fruitmix', JSON.stringify(decorated, null, '  '))

    if (last) {    
      let { type, uuid } = last
      let fsys = fileSystems.find(f => f.fileSystemType === type && f.fileSystemUUID === uuid)

      if (fsys) {
        try {
          assertFileSystemGood(fsys)
          assertReadyToBoot(fsys.wisnuc)
          boot(fsys)
          this.data = { state: 'normal', currentFileSystem: simplify(fsys) }
        }
        catch (e) {
          this.data = { state: 'maintenance', error: 'EFAIL', message: err.message }
        }
        return
      }
    } // no last or lastfs not found

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

    if (alts.length !== 1) {
      this.data = { state: 'maintenance', error: alts.length === 0 ? 'ENOALT' : 'EMULTIALT' }
    }
    else {
      boot(alts[0])
      this.data = { state: 'alternative', currentFileSystem: simplify(alts[0]) }
    }
  },

  // manual boot only occurs in maintenance mode.
  // this operation should not update boot state if failed.
  manualBootAsync: async function (args) {

    if (this.data.state !== 'maintenance') throw new Error('not in maintenance mode')    

    let { type, uuid, username, password, install, reinstall } = args 
    let pretty = await Storage.refreshAsync(true) 
    let decorated = await decorateStorageAsync(pretty)
    let fileSystems = getFileSystems(decorated)
    let fsys = fileSystems.find(f => f.type === type && f.uuid === uuid)
    if (!fsys) throw Object.assign(new Error('target not found'), { code: 'ENOENT' })

    assertFileSystemGood(fsys)

    if (reinstall === true || install === true) {
      if (reinstall) {
        await rimrafAsync(path.join(fsys.mountpoint, 'wisnuc'))
        await mkdirpAsync(path.join(fsys.mountpoint, 'wisnuc', 'fruitmix'))
      }
      else {
        assertReadyToInstall(fsys.wisnuc)
      }
      boot(fsys, { username, password })
    }
    else { // direct boot, fruitmix status must be 'READY'
      assertReadyToBoot(fsys.wisnuc) 
      boot(fsys)
    }

    this.data = { state: 'normal', currentFileSystem: simplify(fsys) }
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

