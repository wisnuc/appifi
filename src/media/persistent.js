const path = require('path')
const fs = require('fs') 
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const UUID = require('uuid')

const debug = require('debug')('persistent-mediamap')

const MediaMap = require('./map')

class PersistentMediaMap extends MediaMap {

  constructor(dbPath, tmpDir) {
    super()

    this.path = dbPath
    this.tmpDir = tmpDir
    this.ws = null

    if (this.loadSync()) this.saveSync()

    this.ws = fs.createWriteStream(this.path, { flags: 'a' })
  }

  // this function load 
  // return true if something dirty
  loadSync () {

    // assure the dir exists
    mkdirp.sync(path.dirname(this.path))

    let raw
    try {
      raw = fs.readFileSync(this.path, { encoding: 'utf8' })
    } catch (e) {
      if (e.code === 'ENOENT') {
        return false
      } else {
        console.log(`error loading ${this.path}`)
        console.log(e)
        throw e
      }
    }

    let dirty = false
    raw.split('\n')
      .forEach(l => {
        if (l.length === 0) {
          // removing empty lines
          dirty = true
          return
        } 

        let pair
        try {
          pair = JSON.parse(l)
        } catch (e) {
          dirty = true
          return
        }

        if (!Array.isArray(pair) || pair.length !== 2) {
          dirty = true
          return
        }

        if (this.hasMetadata(pair[0])) {
          // duplicate found in metadata db
          dirty = true
          return
        }

        this.setMetadata(pair[0], pair[1])
      })

    console.log(`metadataDB loaded, ${this.map.size} entries`)
    return dirty
  }

  saveSync () {
    let data = Array
      .from(this.map)
      .map(([key, meta]) => JSON.stringify([key, meta.metadata]))
      .join('\n')

    let tmp = path.join(this.tmpDir, UUID.v4())
    fs.writeFileSync(tmp, data)
    fs.rename(tmp, this.path, err => {
      if (err) {
        console.log(`failed to fully re-write metadataDB (non-critical)`)
      } else {
        console.log(`metadataDB fully rewritten`)
      }
    })
  }

  saveMetadata (key, metadata) {
    if (this.ws) {
      this.ws.write('\n' + JSON.stringify([key, metadata]))
    }
  }

  destroy () {
    if (this.ws) this.ws.end()
  }
}

module.exports = PersistentMediaMap

