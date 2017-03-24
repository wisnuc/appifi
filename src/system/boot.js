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

// install is required ! 
const assertFsBootable = (fsys, install) => {

  if (!bootableFsTypes.includes(fsys.type)) throw new Error('unsupported bootable type')
  if (!fsys.isMounted) throw new Error('file system is not mounted')
  if (fsys.isVolume && fsys.isMissing) throw new Error('file system has missing device')
  if (install && fsys.wisnuc.status !== 'ENOENT') throw new Error('cannot install')    
  if (!install && fsys.wisnuc.status !== 'READY') throw new Error('wisnuc not ready') 
  return true
}

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

  boot(fsys, install) {

    // do something  

    Config.updateLastFileSystem(
  },

  // autoboot
  autoBootAsync: async function () {

    let last = Config.get().lastFileSystem
    let fileSystems = await refreshFileSystems()

    let fsys = fileSystems.find(f => f.type === fsys.type && f.uuid === fsys.uuid)
    
    if (fsys) {
      try {
        assertFsBootable(fsys)
        boot(fsys)
        this.data = { state: 'normal', currentFileSystem: fsys }
      }
      catch (e) {
        this.data = { state: 'maintenance', error: 'EFAIL', message: err.message }
      }
      return
    }

    let alts = fileSystems.filter(f => { try { return assertBootable(f) } finally {} })
    if (alts.length !== 1) {
      this.data = { state: 'maintenance', error: alts.length === 0 ? 'ENOALT' : 'EMULTIALT' }
    }
    else {
      boot(alts[0])
      this.data = { state: 'alternative', currentFileSystem: alts[0] }
    }
  },

  // manual boot only occurs in maintenance mode.
  // this operation should not update boot state if failed.
  manualBootAsync: async function (type, uuid, init) {

    if (this.data.state !== 'maintenance') throw new Error('not in maintenance mode')    

    let fileSystems = await refreshFileSystems()
    let fsys = fileSystems.find(f => f.type === fsys.type && f.uuid === fsys.uuid)
    if (!fsys) throw new Error('target not found')

    assertBootable(fsys, install) 
    boot(fsys, install)
    this.data = { state: 'normal', currentFileSystem: fsys }
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

