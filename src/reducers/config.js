import validator from 'validator'
import Debug from 'debug'

import { storeState, storeDispatch } from '../reducers'
import { writeObjectAsync } from '../common/async'

const debug = Debug('reducers:config')
const K = x => y => x

// 
// all validators returns original object/value if valid, 
// returns undefined if invalid 
//

// version validator
const validateVersion = ver => ver === 1 ? 1 : undefined

// dockerInstall, 'rootfs' or 'fruitmix'
const validateDockerInstall = di => {

  if (di === null) return di
  if (di instanceof Object) {
    if (di.type === 'fruitmix')
      return di
    if (di.type === 'roofs')
      return di
  } 
}

// lastFileSystem validator
const validateLastFileSystem = lfs => {
  if (lfs === null) return lfs
  if (lfs instanceof Object &&
      (lfs.type === 'btrfs' || lfs.type === 'ext4' || lfs.type === 'ntfs') &&
      typeof lfs.uuid === 'string' && validator.isUUID(lfs.uuid)) 
    return lfs
}

// bootMode validator
const validateBootMode = bm => (bm === 'normal' || bm === 'maintenance') ? bm : undefined

// barcelona fanscale 
const validateBarcelonaFanScale = scale =>
  Number.isInteger(scale) && scale >= 0 && scale <= 100 ? scale : undefined

// ip aliasing
const validateIpAliasing = ipAliasing => 
  Array.isArray(ipAliasing) ? ipAliasing.filter(ent => 
    typeof ent.mac === 'string' && validator.isMACAddress(ent.mac) &&
    typeof ent.ipv4 === 'string' && validator.isIP(ent.ipv4, 4)) : undefined 

//
// end of validators
//


// input: a parsed config
// output: if changed, new config object
const initConfig = (raw) => {

  let parsed, config = {}
  const load = (prop, validate, def) => { 

    let valid = validate(parsed[prop])
    if (valid !== undefined)
      config[prop] = valid
    else
      config[prop] = K(def)(writeback = true)
  }

  try {
    parsed = JSON.parse(raw.toString())
    if (parsed.constructor !== Object) throw 'not an object'

    load('version', validateVersion, 1)
//    load('lastUsedVolume', validateLastUsedVolume, null)
    load('dockerInstall', validateDockerInstall, null)
    load('lastFileSystem', validateLastFileSystem, null)
    load('bootMode', validateBootMode, 'normal')
    load('barcelonaFanScale', validateBarcelonaFanScale, 50)
    load('ipAliasing', validateIpAliasing, [])
  }
  catch (e) {

    console.log(e)
    config = {
      version: 1,
      lastUsedVolume: null,
      dockerInstall: null,
      lastFileSystem: null,
      bootMode: 'normal',
      barcelonaFanScale: 50,
      ipAliasing: []
    } 
  }

  return config
}

const config = (state = null, action) => {

  switch (action.type) {
  case 'CONFIG_INIT':
    return initConfig(action.data) 

  case 'CONFIG_BARCELONA_FANSCALE':
    return validateBarcelonaFanScale(action.data) ?
      Object.assign({}, state, { barcelonaFanScale: action.data }) : state

  case 'CONFIG_DOCKER_INSTALL':
    return validateDockerInstall(action.data) ?
      Object.assign({}, state, { dockerInstall: action.data }) : state

  case 'CONFIG_LAST_FILESYSTEM':
    return validateLastFileSystem(action.data) ?
      Object.assign({}, state, { lastFileSystem: action.data }) : state

  case 'CONFIG_BOOT_MODE':
    return validateBootMode(action.data) ?
      Object.assign({}, state, { bootMode: action.data }) : state

  case 'CONFIG_IP_ALIASING':
    return validateIpAliasing(action.data) ?
      Object.assign({}, state, { ipAliasing: action.data }) : state
  
  default:
    return state
  }
}

export default config


