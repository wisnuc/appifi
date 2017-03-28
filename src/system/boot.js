const path = require('path')
const fs = require('fs')
const child = require('child_process')

const Developer = require('./developer')
const Config = require('./config')
const Storage = require('./storage')
const fruitmix = require('./boot/fruitmix')

const debug = require('debug')('system:boot')

const bootableFsTypes = ['btrfs', 'ext4', 'ntfs']

/**
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
    .map(mps, obj => fruitmix.probeAsync(obj.mp).reflect())
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
**/

// extract file systems out of storage object
const extractFileSystems = ({blocks, volumes}) => 
  [ ...blocks.filter(blk => blk.isFileSystem && !blk.isVolumeDevice),  
    ...volumes.filter(vol => vol.isFileSystem) ]

// 
const shouldProbeFileSystem = fsys =>
  (fsys.isVolume && fsys.isMounted && !fsys.isMissing) 
  || (!fsys.isVolume && fsys.isMounted && (fsys.isExt4 || fsys.isNTFS))

// 
const probeAllAsync = async fileSystems =>
  Promise.map(fileSystems.filter(shouldProbeFileSystem), 
    async fsys => {
      try {
        fsys.wisnuc = await fruitmix.probeAsync(fsys.mountpoint)
      }
      catch (e) {
        fsys.wisnuc = 'ERROR'
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

  probedStorageAsync: async function () {
    let storage = Storage.get()
    let fileSystems = extractFileSystems(storage)
    await probeAllAsync(fileSystems)
    return storage
  },

  bootAsync: async function (cfs, init) {
   	await fruitmix.forkAsync(cfs, init) 
    Config.updateLastFileSystem({type: cfs.type, uuid: cfs.uuid})
  },

  // autoboot
  autoBootAsync: async function () {

    let storage = await Storage.refreshAsync() 
    let fileSystems = extractFileSystems(storage)
    await probeAllAsync(fileSystems)

    console.log('[autoboot] storage and fruitmix', JSON.stringify(storage, null, '  '))

    let last = Config.get().lastFileSystem
    if (last) {    

      let { type, uuid } = last
      let fsys = fileSystems.find(f => f.fileSystemType === type && f.fileSystemUUID === uuid)

      if (fsys) {
        try {
          assertFileSystemGood(fsys)
          assertReadyToBoot(fsys.wisnuc)
          await this.bootAsync(cfs(fsys))
          this.data = { state: 'normal', currentFileSystem: cfs(fsys) }
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

    if (alts.length !== 1) {
      this.data = { state: 'maintenance', error: alts.length === 0 ? 'ENOALT' : 'EMULTIALT' }
    }
    else {
      await this.bootAsync(cfs(alts[0]))
      this.data = { state: 'alternative', currentFileSystem: cfs(alts[0]) }
    }

    console.log('[autoboot] boot state', this.data)
  },

  // manual boot only occurs in maintenance mode.
  // this operation should not update boot state if failed.
  manualBootAsync: async function (args) {

    if (this.data.state !== 'maintenance') throw new Error('not in maintenance mode')    


    let { type, uuid, username, password, install, reinstall } = args 

    let storage = await Storage.refreshAsync() 
    let fileSystems = extractFileSystems(storage)

    let fsys = fileSystems.find(f => f.type === type && f.uuid === uuid)
    if (!fsys) throw Object.assign(new Error('target not found'), { code: 'ENOENT' })

    assertFileSystemGood(fsys)
    let wisnuc = await probeAsync(fsys)

    if (reinstall === true || install === true) {
      if (reinstall) {
        await rimrafAsync(path.join(fsys.mountpoint, 'wisnuc'))
        await mkdirpAsync(path.join(fsys.mountpoint, 'wisnuc', 'fruitmix'))
      }
      else {
        assertReadyToInstall(wisnuc)
      }
      await this.bootAsync(cfs(fsys), { username, password })
    }
    else { // direct boot, fruitmix status must be 'READY'
      assertReadyToBoot(wisnuc) 
      await this.bootAsync(cfs(fsys))
    }

    this.data = { state: 'normal', currentFileSystem: cfs(fsys) }
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

