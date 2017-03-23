const path = require('path')
const fs = require('fs')
const child = require('child_process')

const Developer = require('./developer')
const Config = require('./config')
const Storage = require('./storage')

import docker from '../appifi/docker'

const debug = require('debug')('system:boot')

const runnable = wisnuc => (typeof wisnuc === 'object' && wisnuc !== null && wisnuc.users)

//
// this function does not take any action
// it returns an object with following properties:
// 
// state: current boot state, 'maintenance', 'normal', 'alternative',
// error: if state is in maintenance, this explains why
// currentFileSystem: the file system in use for 'normal' or 'alternative'
//
// lastFileSystem: in config
// bootMode: in config
//
const bootState = decorated => {

  let { bootMode, lastFileSystem } = Config.get()
  let { blocks, volumes } = decorated

  if (bootMode === 'maintenance') {

    debug('bootMode is set to maintenance by user')
    return {

      state: 'maintenance',
      bootMode: 'maintenance',
      error: 'config',

      currentFileSystem: null,
      lastFileSystem
    }
  }

  // find all file systems, including unmounted, missing, etc.
  let fileSystems = [
    ...blocks.filter(blk => blk.isFileSystem && !blk.isVolumeDevice),  
    ...volumes.filter(vol => vol.isFileSystem)
  ]

  // debug('tryBoot: all file systems', fileSystems)

  if (lastFileSystem) {

    let last = fileSystems.find(fsys => 
      fsys.fileSystemType === lastFileSystem.type &&
      fsys.fileSystemUUID === lastFileSystem.uuid)

    if (last) {

      debug('last file system found', last)

      let error = null
      if (!last.isMounted) {
        debug('last file system is not mounted')
        error = 'EMOUNTFAIL' // TODO mountError
      }
      else if (last.isVolume && last.isMissing) {
        debug('last file system is volume and has missing device')
        error = 'EVOLUMEMISSING'
      }
      else if (!runnable(last.wisnuc)) {
        debug('not runnable', last)
        debug('last file system has no wisnuc installed')
        error = 'EWISNUCNOTFOUND'
      }

      let state, currentFileSystem
      if (error) {
        state = 'maintenance',
        error,
        currentFileSystem = null 
      }
      else {
        debug('last file system ready to boot')
        state = 'normal',
        error,
        currentFileSystem = {
          type: last.fileSystemType,
          uuid: last.fileSystemUUID,
          mountpoint: last.mountpoint
        }
      }

      return { state, bootMode, error, currentFileSystem, lastFileSystem }
    }
  }

  debug('no last fs in config or last fs not found')

  // no lfs or lfs not found, try alternative
  let alt = fileSystems.filter(fsys => {
    if (!fsys.isMounted) return false
    if (fsys.isVolume && fsys.isMissing) return false
    if (!runnable(fsys.wisnuc)) return false
    return true
  })

  debug('alternatives', alt)

  if (alt.length === 1) {
    return {
      state: 'alternative',
      bootMode,
      error: null,
      currentFileSystem: {
        type: alt[0].fileSystemType,
        uuid: alt[0].fileSystemUUID,
        mountpoint: alt[0].mountpoint
      },
      lastFileSystem
    }
  }
  else {
    return {
      state: 'maintenance',
      bootMode,
      error: alt.length === 0 ? 'ENOALT' : 'EMULTIALT',
      currentFileSystem: null,
      lastFileSystem
    }
  }
}

module.exports = {

  data: null,

  tryBootAsync: async function (lfs) {

    let pretty = await Storage.refreshAsync(true) 

    console.log('tryboot, storage', pretty)

    let probed = await probeAllFruitmixesAsync(pretty) 

    if (lfs) Config.updateLastFileSystem(lfs, true)
    let bstate = bootState(probed)

    console.log('tryboot: bootState', bstate)

    let cfs = bstate.currentFileSystem 
    if (cfs) {

      if (!Developer.noFruitmix) {
        // createFruitmix(path.join(cfs.mountpoint, 'wisnuc', 'fruitmix'))
        console.log('----------------------fork--------------------------------')
        child.fork('../fruitmix/main')
        console.log('----------------------fork--------------------------------')
      }
      else {
        console.log('!!! fruitmix not started due to developer setting')
      }

      Config.updateLastFileSystem(cfs)

      let dockerRootDir = path.join(cfs.mountpoint, 'wisnuc')
      docker.init(dockerRootDir) 
    }

    this.data = bstate
    return bstate
  },

  manualBootAsync: async function (uuid, init) {

    if (this.data.state !== 'maintenance') 
      throw new Error('not in maintenance mode')    

    let pretty = await Storage.refreshAsync(true)
    let volume = pretty.volumes.find(vol => vol.fileSystemUUID === uuid)
    if (!volume) throw new Error('volume not found')
    if (!volume.isMounted) throw new Error('volume not mounted')
    if (volume.isMissing) throw new Error('volume has missing device')

    let fmix = await probeFruitmixAsync(volume.mountpoint) 

    if (init) {

      if (fmix.status !== 'ENOENT') throw new Error('target status is not ENOENT')
      child.fork('../fruitmix/main')  
    }
    else {
      if (fmix.status !== 'READY') throw new Error('target status is not READY')
      
      child.fork('../fruitmix/main')  
      
      Config.updateLastFileSystem({
        type: 'btrfs',
        uuid: 'uuid'
      })
    }

    // xxxx TODO
  },

  get() {
    return this.data
  },
}

