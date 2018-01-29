const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const rimrafAsync = Promise.promisify(require('rimraf'))

const debug = require('debug')('dlna')

const dlnaConfPath = '/etc/minidlna.conf'

const nodlna = !!process.argv.find(arg => arg === '--disable-dlna') || process.env.NODE_PATH !== undefined

const confGen = mediaPath => `
  media_dir=${mediaPath}
  log_dir=/var/log
  db_dir=/var/cache/minidlna
  port=8200
  album_art_names=Cover.jpg/cover.jpg/AlbumArtSmall.jpg/albumartsmall.jpg
  album_art_names=AlbumArt.jpg/albumart.jpg/Album.jpg/album.jpg
  album_art_names=Folder.jpg/folder.jpg/Thumb.jpg/thumb.jpg
`
class DlnaServer {
  constructor(froot) {
    this.froot = froot
    this.isStop = true
  }

  async startAsync(mediaPath) {
    if (process.env.hasOwnProperty('NODE_PATH')) {
      // mute
      // console.log('bypass dlna in auto test')
      return
    }
    this.isStop = false
    let conf = confGen(mediaPath)
    await child.execAsync('chown minidlna:minidlna /var/cache/minidlna')
    await fs.writeFileAsync(dlnaConfPath, conf)
    await this.restartAsync()
    debug('dlna start!')
  }

  async stopAsync() {
    this.isStop = true
    await child.execAsync('systemctl stop minidlna')
    debug('dlna stop!')
  }

  async restartAsync(mediaPath) {
    await child.execAsync('systemctl enable minidlna')
    await Promise.delay(1000)
    await child.execAsync('systemctl restart minidlna')
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

  destory() {
    this.froot = undefined
    this.stopAsync().then(() => {})
  }
}

module.exports = DlnaServer
