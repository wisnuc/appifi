const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const UUID = require('uuid')

const broadcast = require('../../common/broadcast')
const { saveObjectAsync } = require('../lib/utils')

/*
  fruitmix/repo          // store blob 
          /boxes
            [uuid]/
              manifest  // 
              commits   // database
*/


class Box {

  constructor() {

    this.initialized = false

    this.dir = undefined
    this.tmpDir = undefined
    this.map = undefined

    broadcast.on('FruitmixStart', froot => {
    
      let dir = path.join(froot, 'boxes')
      let tmpDir = path.join(froot, 'tmp') 

      this.init(dir, tmpDir)
    })

    broadcast.on('FruitmixStop', () => this.deinit())
  }

  init(dir, tmpDir) {

    mkdirp(dir, err => {

      if (err) {
        console.log(err) 
        broadcast.emit('BoxInitDone', err)
        return
      }

      this.initialized = true
      this.dir = dir
      this.tmpDir = tmpDir
      this.map = new Map()

      broadcast.emit('BoxInitDone')
    })
  }

  deinit() {

    this.initialized = false
    this.dir = undefined
    this.tmpDir = undefined
    this.map = undefined

    process.nextTick(() => broadcast.emit('BoxDeinitDone'))
  }

/**
  async initAsync(boxesDir, tmpDir) {

    this.dir = boxesDir
    this.tmpDir = tmpDir
    this.map = new Map()

    await mkdirpAsync(this.dir)
  }
**/

  async createBoxAsync(props) {

    // create temp dir  
    // save manifest to temp dir
    // move to boxes dir

    let tmpDir = await fs.mkdtempAsync(path.join(this.tmpDir, 'tmp'))
    let box = {
      uuid: UUID.v4(),
      name: props.name,
      owner: props.owner,
      users: props.users,
    }  

    // FIXME refactor saveObject to avoid rename twice
    await saveObjectAsync(path.join(tmpDir, 'manifest'), this.tmpDir, box)
    await fs.renameAsync(tmpDir, path.join(this.dir, box.uuid))

    this.map.set(box.uuid, box)
    return box
  }
}

module.exports = new Box()
