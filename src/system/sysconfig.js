import fs from 'fs'

import validator from 'validator'
import Debug from 'debug'

const debug = Debug('system:config')

const K = x => y => x

const configFilePath = '/etc/wisnuc.json'

let config = {}

const validateVersion = (ver) => ver === 1 ? 1 : undefined

const validateLastUsedVolume = (luv) => 
  luv === null || (typeof luv === 'string' && validator.isUUID(luv)) ? luv : undefined

const validateLastFileSystem = (lfs) => {
  if (lfs === null) return lfs
  if (lfs instanceof Object &&
      (lfs.type === 'btrfs' || lfs.type === 'ext4' || lfs.type === 'ntfs') &&
      typeof lfs.uuid === 'string' && validator.isUUID(lfs.uuid)) 
    return lfs
}

const validateBootMode = (bm) => (bm === 'normal' || bm === 'maintenance') ? bm : undefined

const validateBarcelonaFanScale = (scale) =>
  Number.isInteger(scale) && scale >= 0 && scale <= 100 ? scale : undefined

const validateIpAliasing = (ipAliasing) => 
  Array.isArray(ipAliasing) ? ipAliasing.filter(ent => 
    typeof ent.mac === 'string' && validator.isMACAddress(ent.mac) &&
    typeof ent.ipv4 === 'string' && validator.isIP(ent.ipv4, 4)) : undefined 
    

const writeConfig = () => {
  let text = JSON.stringify(config, null, '  ')
  fs.writeFile(configFilePath, text, err => {
    debug(`sysconfig written`, config)
  })
}

const initialize = () => {

  let writeback = false
  let parsed

  const load = (prop, validate, def) => { 

    let valid = validate(parsed[prop])
    if (valid !== undefined)
      config[prop] = valid
    else
      config[prop] = K(def)(writeback = true)
  }
 
  try {

    // read config file
    let read = fs.readFileSync(configFilePath, { encoding: 'utf8' }) 
    parsed = JSON.parse(read.toString())

    if (parsed.constructor !== Object) throw 'not an object'

    load('version', validateVersion, 1)
    load('lastUsedVolume', validateLastUsedVolume, null)
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
      lastFileSystem: null,
      bootMode: 'normal',
      barcelonaFanScale: 50,
      ipAliasing: []
    } 

    writeback = true
  }

  writeback && writeConfig()

  console.log('[sysconfig] initialized', config)
}

initialize()

export default {

  get: (key) => config[key],
  set: (key, val) => {

    if ((key === 'barcelonaFanScale' && validateBarcelonaFanScale(val)) ||
        (key === 'lastUsedVolume' && validateLastUsedVolume(val)) ||
        (key === 'lastFileSystem' && validateLastFileSystem(val)) ||
        (key === 'bootMode' && validateBootMode(val)) ||
        (key === 'ipAliasing' && validateIpAliasing(val))) {

      config[key] = val
      writeConfig()
    }
  }
}



