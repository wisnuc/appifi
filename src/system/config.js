const fs = Promise.promisifyAll(require('fs'))
const validator = require('validator')
const deepEqual = require('deep-equal')
const deepFreeze = require('deep-freeze')
const createPersistenceAsync = require('../common/persistence')

/*******************************************************************************

Example wisnuc.json file

{
  "version": 1,
  "dockerInstall": null,
  "lastFileSystem": {
    "type": "btrfs",
    "uuid": "09f8a66c-0fac-4096-8274-7fcf33a6b87c"
  },
  "bootMode": "normal",
  "barcelonaFanScale": 65,
  "ipAliasing": [{ "mac": "xxxx", "ipv4": "xxxx"}]
}

*******************************************************************************/

const defaultConfig = {
  version: 1,
  dockerInstall: null,
  lastFileSystem: null,
  bootMode: 'normal',
  barcelonaFanScale: 50,
  ipAliasing: []
} 

const isUUID = uuid => typeof uuid === 'string' && validator.isUUID(uuid)

const isValidLastFileSystem = lfs => lfs === null || (lfs.type === 'btrfs' && isUUID(lfs.uuid))
const isValidBootMode = bm => bm === 'normal' || bm === 'maintenance'
const isValidBarcelonaFanScale = bfs => Number.isInteger(bfs) && bfs >= 0 && bfs <= 100
const isValidIpAliasing = arr => 
  arr.every(ia => 
    typeof ia.mac === 'string' 
    && validator.isMACAddress(ia.mac)
    && typeof ia.ipv4 === 'string'
    && validator.isIP(ia.ipv4, 4))

/**
 * pseudo class singleton
 */
module.exports = {

  // cannot be written as async initAsync(...) 
  initAsync: async function(fpath, tmpdir) {

    let read, dirty = false

    this.config = Object.assign({}, defaultConfig)
    this.persistence = await createPersistenceAsync(fpath, tmpdir, 500)

    try { read = JSON.parse(await fs.readFileAsync(fpath)) } catch (e) {}

    if (!read) {
      dirty = true
    }
    else {

      if (isValidLastFileSystem(read.lastFileSystem))
        Object.assign(this.config, { lastFileSystem: read.lastFileSystem })

      if (isValidBootMode(read.bootMode))
        Object.assign(this.config, { bootMode: read.bootMode })

      if (isValidBarcelonaFanScale(read.barcelonaFanScale))
        Object.assign(this.config, { barcelonaFanScale: read.barcelonaFanScale })

      if (isValidIpAliasing(read.ipAliasing))
        Object.assign(this.config, { ipAliasing: read.ipAliasing })

      if (!deepEqual(this.config, read)) dirty = true
    }

    deepFreeze(this.config)
    if (dirty) this.persistence.save(this.config)

		console.log('[system] config loaded', this.config)
  },

  merge(props) {

    this.config = Object.assign({}, this.config, props)
    deepFreeze(this.config)

    this.persistence.save(this.config)
  },

  updateLastFileSystem(lfs, forceNormal) {

    if (!isValidLastFileSystem(lfs)) return 
    if (forceNormal !== undefined && typeof forceNormal !== 'boolean') return
    let lastFileSystem = { type: 'btrfs', uuid: lfs.uuid }
    if (forceNormal) 
      this.merge({ lastFileSystem, bootMode: 'normal' })
    else
      this.merge({ lastFileSystem })
  },

  updateBootMode(bm) {
    isValidBootMode(bm) && this.merge({ bootMode: bm })
  },

  updateBarcelonaFanScale(bfs) {
    isValidBarcelonaFanScale(bfs) && this.merge({ barcelonaFanScale: bfs })
  },

  updateIpAliasing(arr) {
    isValidIpAliasing(arr) && this.merge({ ipAliasing: arr })
  },

  get() {
    return this.config
  }
}


