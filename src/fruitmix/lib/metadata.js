const Promise = require('bluebird')
const path = require('path')

const { isSHA256 } = require('../lib/assertion')

/**
Metadata provides lookup of metadata. It accepts external report.

path: <fruitmixPath> / <meta> / type / <ver> / <hash>

example: 




@module metadata
*/

const version = {
  JPEG: 0,
}

/**
*/
class Metadata {


  /**
  */
  constructor() {
  }

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

  metaPath(magic, hash) {

    return path.join(this.dir, magic, '' + version[magic], hash)
  }

  /**
  Returns meta object for givne file hash, or undefined
  */
  getMeta(hash) {
    return this.map.get(hash) 
  }

  /**
  */
  async reportMediaFileAsync(magic, hash, filePath, uuid) {

    if (this.map.has(hash)) return //

    try {
      let meta = JSON.parse(await fs.readFile(metaPath(magic, hash)))
      this.map.set(hash, { magic, meta })
      return
    }
    catch (e) {

      if (!(e instanceof SyntaxError) && e.code !== 'ENOENT') throw e
    }

    let string = await child.execAsync("identify format '" + '')
    let meta = parseString(string)
    
    save() 

    this.map.set(hash, { magic, meta })
  }

  reportMediaFile(magic, hash, filePath, uuid) {
    
    if (this.map.has(hash)) return

    // if in meta directory, load it 
    // else calculate
    fs.readFile(metaPath(magic, hash), (err, data) => {

    }) 
  }
}

module.exports = new Metadata
