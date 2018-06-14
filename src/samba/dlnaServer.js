const Promise = require('bluebird')
const path = require('path')
const events = require('events')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))

const debug = require('debug')('dlna')

const dlnaConfPath = '/etc/minidlna.conf'

const confGen = mediaPath => `
  media_dir=${mediaPath}
  log_dir=/var/log
  db_dir=/var/cache/minidlna
  port=8200
  album_art_names=Cover.jpg/cover.jpg/AlbumArtSmall.jpg/albumartsmall.jpg
  album_art_names=AlbumArt.jpg/albumart.jpg/Album.jpg/album.jpg
  album_art_names=Folder.jpg/folder.jpg/Thumb.jpg/thumb.jpg
`

class DlnaServer extends events.EventEmitter {
  constructor(opts, user, drive, vfs) {
    super()
    this.froot = opts.fruitmixDir
    this.user = user
    this.drive = drive
    this.vfs = vfs

    new Pending(this)

    this.drive.on('Update', (data) => {
      this.update()
    })
  }

  update() {
    if (this.isActive()) this.state.start()
  }

  isActive() {
    try {
      let status = child.spawnSync('systemctl', ['is-active', 'minidlna']).stdout.toString()
      status = status.split('\n').join('')
      return status === 'active' ? true : false
    } 
    catch(e) {
      debug(e)
      return false
    }
  }

  GET(user, props, callback) {
    let isActive = this.isActive()
    callback(null, { isActive })
  }

  PATCH (user, props, callback) {
    let ops = ['close', "start"]
    if (!ops.includes(props.op)) callback(new Error('unkonw operation'))
    else if (props.op === 'close') this.state.setState(Pending, callback)
    else {
      if (this.state.constructor.name === 'Working') callback(null)
      else this.state.start(callback)
    }
  }
}

class State {
  constructor(ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)
  }

  setState(NextState, ...args) {
    this.exit()
    debug(`enter ${NextState.valueOf().name} state`)
    new NextState(this.ctx, ...args)
  }

  enter() { }

  exit() { }

  start(callback) {
    this.setState(Initialize, this.user, this.drive, callback)
  }
}

class Pending extends State {
  enter(callback) {
    if (callback) process.nextTick(() => callback(null))
  }
}

class Working extends State {
  exit() {
    try {
      child.execSync('systemctl stop minidlna')
    } catch (e) { console.log(e) }
  }
}

class Failed extends State {
  enter(err) { this.error = err }
}

class Initialize extends State {
  // 启动dlna服务
  async enter(user, drive, callback) {
    this.callbacks = []
    if (callback) this.callbacks.push(callback)
    try {
      let mediaPath = this.getMediaPath()
      if (!mediaPath) throw new Error('get public path failed')
      let conf = confGen(mediaPath)
      debug(conf)
      child.execSync('chown minidlna:minidlna /var/cache/minidlna')
      await fs.writeFileAsync(dlnaConfPath, conf)
      child.execSync('systemctl enable minidlna')
      child.execSync('systemctl restart minidlna')
      debug('dlna start!')
      this.callbacks.forEach(call => call(null))
      this.setState(Working)
    } catch (e) {
      debug(e)
      this.setState(Failed, e)
    }
  }

  getMediaPath() {
    let publicDrive = this.ctx.drive.drives.find(item => 
      item.tag === 'built-in' && item.type === 'public')
    if (publicDrive) return path.join(this.ctx.froot, 'drives', publicDrive.uuid)
    else return null
  }

  start(callback) {
    this.callbacks.push(callback)
  }
}

module.exports = DlnaServer