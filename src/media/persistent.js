const MediaMap = require('./map')


const PersistentMediaMap extends MediaMap {

  constructor(dbPath, tmpDir) {
    super()

    this.path = dbPath
    this.tmpDir = tmpDir

    if (this.loadSync()) {
      this.saveSync()
    }

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
          this.map.set(pair[0], pair[1])
        } catch (e) {
          dirty = true
        }
      })

    return dirty
  }

  saveSync () {

    console.log('full save persistent map')

    let data = Array.from(this.map)
      .map(pair => JSON.stringify(pair))
      .join('\n')

    let tmp = path.join(this.tmpDir, UUID.v4())
    fs.writeFileSync(tmp, data)
    fs.rename(tmp, this.path)
  }

}

