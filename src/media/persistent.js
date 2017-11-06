const path = require('path')
const fs = require('fs') 

const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const UUID = require('uuid')

const MediaMap = require('./map')

class PersistentMediaMap extends MediaMap {

  constructor(dbPath, tmpDir) {
    super()

    this.path = dbPath
    this.tmpDir = tmpDir

    if (this.loadSync()) {
      this.saveSync()
    }

    console.log(this.map)

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
      .filter(x => !!x.length)
      .forEach(l => {
        try {
          let pair = JSON.parse(l)
          if (!Array.isArray(pair) || pair.length !== 2) throw new Error('invalid')
          // this.map.set(pair[0], pair[1]) // TODO
          this.setMetadata(pair[0], pair[1])
        } catch (e) {
          dirty = true
        }
      })

    return dirty
  }

  saveSync () {

    console.log('full save persistent map')

    let data = Array.from(this.map) // TODO
      .map(pair => JSON.stringify(pair))
      .join('\n')

    let tmp = path.join(this.tmpDir, UUID.v4())
    fs.writeFileSync(tmp, data)
    fs.rename(tmp, this.path)
  }

}

module.exports = PersistentMediaMap

