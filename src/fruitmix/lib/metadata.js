const Promise = require('bluebird')
const path = require('path')

const { isSHA256 } = require('../lib/assertion')

class Meta {

  /**
  Load all metadata from given directory
  */
  async initAsync(metaDir, tmpDir) {

    mkdirpAsync(metaDir)
    mkdirpAsync(tmpDir)

    let map = new Map()
    let entries = await fs.readdirAsync(metaDir)

    let afunc = async entry => {
      if (!isSHA256(entry)) return
      try {
        let fpath = path.join(metaDir, entry)
        let data = await fs.readFileAsync(fpath)    
        let meta = JSON.parse(data) 
        map.set(entry, meta)
      }
      catch (e) {
      }
    } 

    await Promise.map(entries, afunc, { concurrency: 256 })

    this.metaDir = metaDir
    this.tmpDir = tmpDir
    this.map = map
  }

  /**
  Returns meta object for givne file hash, or undefined
  */
  getMeta(hash) {
    return this.map.get
  }
}

module.exports = new Meta
