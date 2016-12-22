import path from 'path'
import Debug from 'debug'
import { storeState, storeDispatch } from '../reducers'
import { refreshStorage } from './storage'
import { createFruitmix } from '../fruitmix/fruitmix'
import docker from '../appifi/docker'

const debug = Debug('system:boot')

const bootState = () => {

  let { bootMode, lastFileSystem } = storeState().config
  let { blocks, volumes } = storeState().storage

  if (bootMode === 'maintenance') {

    debug('bootMode is set maintenance by user')
    return {
      state: 'maintenance',
      bootMode: 'maintenance',
      error: null,
      currentFileSystem: null,
      lastFileSystem
    }
  }

  // find all file systems, including unmounted, missing, etc.
  let fileSystems = [
    ...blocks.filter(blk => blk.stats.isFileSystem && !blk.stats.isVolume),  
    ...volumes.filter(vol => vol.stats.isFileSystem)
  ]

  // debug('tryBoot: all file systems', fileSystems)

  if (lastFileSystem) {

    let last = fileSystems.find(fsys => 
      fsys.stats.fileSystemType === lastFileSystem.type &&
      fsys.stats.fileSystemUUID === lastFileSystem.uuid)

    if (last) {

      debug('last file system found', last)

      let error = null
      if (!last.stats.isMounted) {
        debug('last file system is not mounted')
        error = 'EMOUNTFAIL'
      }
      else if (last.stats.isVolume && last.stats.isMissing) {
        debug('last file system is volume and has missing device')
        error = 'EVOLUMEMISSING'
      }
      else if (!last.stats.wisnucInstalled) {
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
          type: last.stats.fileSystemType,
          uuid: last.stats.fileSystemUUID,
          mountpoint: last.stats.mountpoint
        }
      }

      return { state, bootMode, error, currentFileSystem, lastFileSystem }
    }
  }

  debug('no last fs in config or last fs not found')

  // no lfs or lfs not found, try alternative
  let alt = fileSystems.filter(fsys => fsys.stats.isMounted &&
    (fsys.stats.isVolume ? (!fsys.stats.isMissing) : true) &&
    fsys.stats.wisnucInstalled) 

  debug('alternatives', alt)

  if (alt.length === 1) {
    return {
      state: 'alternative',
      bootMode,
      error: null,
      currentFileSystem: {
        type: alt[0].stats.fileSystemType,
        uuid: alt[0].stats.fileSystemUUID,
        mountpoint: alt[0].stats.mountpoint
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

export const tryBoot = (callback) => {

  refreshStorage().asCallback(err => {

    if (err) return callback(err)
    let bstate = bootState()
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
    callback()
  })
}



