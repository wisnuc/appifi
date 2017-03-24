const path = require('path')
const fs = require('fs')
const child = require('child_process')

const Developer = require('./developer')
const Config = require('./config')
const Storage = require('./storage')

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
        mps[index].ref.wisnuc = 'ERROR'
      }
    })

  return pretty
}

const shutdownAsync = async reboot => {

  let cmd = reboot === true ? 'reboot' : 'poweroff'
  await child.execAsync('echo "PWR_LED 3" > /proc/BOARD_io').reflect()
  await Promise.delay(3000)
  await child.execAsync(cmd)
}

const assertFileSystemGood = fsys =>
  (!bootableFsTypes.includes(fsys.type)) 
    ? throw new Error('unsupported bootable type')
    : (!fsys.isMounted) 
      ? throw new Error('file system is not mounted')
      : (fsys.isVolume && fsys.isMissing) 
        ? throw new Error('file system has missing device')
        : true

const assertReadyToBoot = wisnuc => 
  (!wisnuc || typeof wisnuc !== 'object' || wisnuc.status !== 'READY')
    ? throw new Error('fruitmix status not READY')
    : true

const assertReadyToInstall = wisnuc =>
  (!wisnuc |\ typeof wisnuc !== 'object' || wisnuc.status !== 'ENOENT')
    ? throw new Error('fruitmix status not ENOENT')    
    : true

 
const refreshFileSystems = async () => {

  let pretty = await Storage.refreshAsync(true) 
  let decorated = await decorateStorageAsync(pretty)
  let { blocks, volumes } = decorated

  return [
    ...blocks.filter(blk => blk.isFileSystem && !blk.isVolumeDevice),  
    ...volumes.filter(vol => vol.isFileSystem)
  ]
} 

module.exports = {

  data: null,

  decoratedStorageAsync: async function () {
    let pretty = Storage.get()
    return await decorateStorageAsync(pretty)
  },

  boot(mountpoint, {}) {

    // do something  

    Config.updateLastFileSystem(
  },

  // autoboot
  autoBootAsync: async function () {

    let last = Config.get().lastFileSystem
    let fileSystems = await refreshFileSystems()

    if (last) {    

      let { type, uuid } = last
      let fsys = fileSystems.find(f => 
        f.fileSystemType === type && f.fileSystemUUID === uuid)

      if (fsys) {

        try {

          assertFileSystemGood(fsys)
          assertReadyToBoot(fsys.wisnuc)
          boot(fsys.mountpoint)

          this.data = { 
            state: 'normal', 
            currentFileSystem: {
              type,
              uuid,
              mountpoint: fsys.mountpoint 
            }
          }
        }
        catch (e) {
          this.data = { 
            state: 'maintenance', 
            error: 'EFAIL', 
            message: err.message 
          }
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
      this.data = { 
        state: 'maintenance', 
        error: alts.length === 0 ? 'ENOALT' : 'EMULTIALT' 
      }
    }
    else {

      boot(alts[0].mountpoint)

      this.data = { 
        state: 'alternative', 
        currentFileSystem: {
          type: alts[0].fileSystemType,
          uuid: alts[0].fileSystemUUID,
          mountpoint: alts[0].mountpoint
        }
      }
    }
  },

  // manual boot only occurs in maintenance mode.
  // this operation should not update boot state if failed.
  manualBootAsync: async function (args) {

    if (this.data.state !== 'maintenance') throw new Error('not in maintenance mode')    

    let { type, uuid, username, password, install, reinstall } = args 

    let fileSystems = await refreshFileSystems()
    let fsys = fileSystems.find(f => f.type === type && f.uuid === uuid)
    if (!fsys) throw new Error('target not found')

    assertFileSystemGood(fsys)

    if (reinstall === true || install === true) {

      if (reinstall) {
        await rimrafAsync(path.join(fsys.mountpoint, 'wisnuc')
        await mkdirpAsync(path.join(fsys.mountpoint, 'wisnuc', 'fruitmix')
      }
      else
        assertReadyToInstall(fsys.wisnuc)

      boot(fsys.mountpoint, { username, password })
    }
    else {
      // direct boot, fruitmix status must be 'READY'
      assertReadyToBoot(fsys.wisnuc) 
      boot(fsys.mountpoint)
    }

    this.data = { 
      state: 'normal', 
      currentFileSystem: {
        type, 
        uuid,   
        mountpoint: fsys.mountpoint
      } 
    }
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

