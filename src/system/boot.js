import path from 'path'
import Debug from 'debug'
import { storeState, storeDispatch } from '../reducers'
import { refreshStorageAsync } from './storage'
import { createFruitmix } from '../fruitmix/fruitmix'
import docker from '../appifi/docker'
import { adaptStorage, probeAllFruitmixesAsync } from './adapter'

const debug = Debug('system:boot')

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
const bootState = (config, storage) => {

  let { bootMode, lastFileSystem } = config
  let { blocks, volumes } = storage

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
    ...blocks.filter(blk => blk.isFileSystem && !blk.isVolume),  
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

const tryBootAsync = async () => {

  let storage = await refreshStorageAsync() 
  let adapted = adaptStorage(storage)
  let probed = await probeAllFruitmixesAsync(adapted) 

  let bstate = bootState(storeState().config, probed)

  debug('tryboot: bootState', bstate)

  let cfs = bstate.currentFileSystem 
  if (cfs) {

    // boot fruitmix
    debug('tryBoot, store, developer', storeState().developer)

    if (!storeState().developer.noFruitmix) {
      createFruitmix(path.join(cfs.mountpoint, 'wisnuc', 'fruitmix'))
    }
    else {
      console.log('!!! fruitmix not started due to developer setting')
    }

    storeDispatch({ type: 'CONFIG_LAST_FILESYSTEM', cfs })

    // boot appifi only if fruitmix booted
    let install = storeState().config.dockerInstall
    debug('dockerInstall', install)      
    
    let dockerRootDir = path.join(cfs.mountpoint, 'wisnuc')
    docker.init(dockerRootDir) 
  }

  storeDispatch({ type: 'UPDATE_SYSBOOT', data: bstate })
  return bstate
}

// try boot system
export const tryBoot = (callback) => tryBootAsync().asCallback(callback)






