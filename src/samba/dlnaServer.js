const Promise = require('bluebird')
const path = require('path')
const events = require('events')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))

const debug = require('debug')('dlna')

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
  constructor(opts, user, drive) {
    super()
    this.froot = opts.fruitmixDir
    this.user = user
    this.drive = drive

    new Pending(this)

    this.user.on('Update', (data) => {
      this.update()
    })

    this.drive.on('Update', (data) => {
      this.update()
    })
  }

  update() {
    this.state.start()
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

  start(user, drive, callback) {
    this.setState(Initialize, user, drive, callback)
  }
}

class Pending extends State {
  enter(callback) {
    this.name = 'pending'
    if (callback) process.nextTick(() => callback(null))
  }
}

class Working extends State {
  enter() { this.name = 'working' }

  async exit() {
    await child.execAsync('systemctl stop smbd')
    await child.execAsync('systemctl stop nmbd')
  }
}

class Initialize extends State {
  // 启动dlna服务
  async enter(user, drive, callback) {
    this.name = 'initialize'
    this.next = false

    let conf = confGen(mediaPath)
    await child.execAsync('chown minidlna:minidlna /var/cache/minidlna')
    await fs.writeFileAsync(dlnaConfPath, conf)
    await child.execAsync('systemctl enable minidlna')
    await Promise.delay(1000)
    await child.execAsync('systemctl restart minidlna')
    debug('dlna start!')

    if (this.next) this.setState(Initialize, user, drive)
    else this.setState(Working)
  }

  start() {
    this.next = true
  }
}