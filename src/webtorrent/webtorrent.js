const path = require('path')
const fs = require('fs')
const webT = require('webtorrent')

const ipc = require('./ipcWorker')

class WebTorrent {
  constructor(tempPath) {
    this.tempPath = tempPath
    this.catchPath = path.join(this.tempPath, 'storage.json')
    this.client = new webT()
    // this.client.on('torrent', this.newTorrent)
    this.client.on('error', this.clientError)
    this.downloading = []
    this.downloaded = []
    this.writing = false
    this.lockNumber = 0
    this.log = function() {
      let infoHash = this.infoHash
      let timeRemaining = this.timeRemaining
      let downloaded = this.downloaded
      let downloadSpeed = this.downloadSpeed
      let progress = this.progress
      let numPeers = this.numPeers
      let path = this.path
      let state = this.state
      let name = this.name
      let torrentPath = this.torrentPath
      let magnetURL = this.magnetURL
      let downloadPath = this.downloadPath
      return {infoHash, timeRemaining, downloaded, downloadSpeed, progress, numPeers, path, name, torrentPath, magnetURL, downloadPath}
    }
    this.init()
  }

  //read storage & create tasks
  init() {
    if (!fs.existsSync(this.catchPath)) return console.log('catch path not exist')
    try {
      let tasks = JSON.parse(fs.readFileSync(this.catchPath))
      this.downloaded = tasks.downloaded
      tasks.downloading.forEach((file, index) => {
        if (file.torrentPath) this.addTorrent({ torrentPath:file.torrentPath, downloadPath:file.downloadPath })
        else if (file.magnetURL) this.addMagnet({ magnetURL:file.magnetURL, downloadPath:file.downloadPath })
      })
    }catch(e) {
      console.log('Error in init ', e)
      fs.unlinkSync(this.catchPath)
      console.log('this catch file has been removed')
    }
  }

  //add task with torrent file
  async addTorrent({torrentPath, downloadPath}) {
    if (!fs.existsSync(torrentPath)) throw new Error('torrent file not exist')
    let torrentBuffer = fs.readFileSync(torrentPath)
    return await this.createTorrent({torrentBuffer, downloadPath, torrentPath})
  }

  //add task with magnet url
  async addMagnet({magnetURL, downloadPath}) {
    if (typeof magnetURL !== 'string' || magnetURL.indexOf('magnet') == -1) throw new Error('magnetURL is not a legal magnetURL')
    return await this.createTorrent({magnetURL, downloadPath})
  }

  // create torrent & storage
  async createTorrent({torrentSource, downloadPath, torrentPath}) {
    let torrent = this.client.add(torrentSource, {path: this.tempPath})
    if (this.downloading.findIndex(item => item.infoHash == torrent.infoHash) !== -1) return console.log('torrent exist now')
    torrent.downloadPath = downloadPath
    torrent.log = this.log
    torrent.state = 'downloading'
    torrent.torrentPath = torrentPath?torrentPath:null
    torrent.magnetURL = torrentPath?null:torrentSource
    torrent.on('done', () => {
      console.log('torrent done trigger ' + torrent.progress)
      // pause also will trigger done event
      if (torrent.progress !== 1) return
      torrent.state = 'downloaded'
      // stop torrent uploading & move to downloaded array
      torrent.destroy(async () => {
        fs.renameSync(path.join(torrent.path, torrent.name), path.join(torrent.downloadPath, torrent.name))
        let index = this.downloading.indexOf(torrent)
        if (index == -1) throw new Error('torrent is not exist in downloading array')
        this.downloading.splice(index,1)
        this.downloaded.push(torrent)
        await this.cache()
        console.log('torrent destory success')
        console.log(this.downloading.length + ' -- ' + this.downloaded.length)
      })
    })
    this.downloading.push(torrent)
    await this.cache()
    return torrent.infoHash
  }

  //pasuse a torrent with torrentID
  pause({torrentId}) {
    let torrent = this.client.get(torrentId)
    if (!torrent) return {code: -1}
    torrent.files.forEach(file => {file.deselect()})
    return {code: 0}
  }

  //resume a torrent with torrentID
  resume({torrentId}) {
    let torrent = this.client.get(torrentId)
    if (!torrent) return {code: -1}
    torrent.files.forEach(file => {file.select()})
    return {code: 0}
  }

  //query summary of downloading torrent (torrentID is not necessary)
  getSummary({torrentId}) {
    if (torrentId) {
      if (typeof torrentId !== 'string' || torrentId.length < 1) throw new Error('torrentId is not legal')
      let result = this.client.get(torrentId)
      if (!result) return []
      else return [result.log()]
    }else {
      return this.downloading.map(torrent => torrent.log() )
    }
  }

  //query summary of downloaded torrent
  getFinish() {
    return this.downloaded.map(file => file.log())
  }

  //storage list of torrent
  cache() {
    return new Promise((resolve,reject) => {
      console.log('begin cache ...')
      if (this.writing) {
        console.log('schedule is writing catche now, waiting...')
        this.lockNumber++
        resolve()
        return
      }
      this.writing = true
      let obj = {
        downloading: this.downloading.map(file => file.log()),
        downloaded: this.downloaded.map(file => file.log())
      }
      fs.writeFile(this.catchPath, JSON.stringify(obj,null, '\t'), err => {

        this.writing = false
        if (err) {
          console.log('cache tasks failed')
          reject(err)
        }
        else {
          console.log('cache tasks success, lockNumber: ' + this.lockNumber)
          if (this.lockNumber > 0) {
            this.lockNumber = 0
            this.cache()
          }
          resolve()
        }
      })
    })
  }

  //delete torrent task
  destory({torrentId}) {
    return new Promise(async (resolve, reject) => {
      let torrent = this.downloading.find(item => item.infoHash == torrentId)
      if (torrent) {
        torrent.destroy(async () => {
          console.log('torrent has been destory')
          let index = this.downloading.indexOf(torrent)
          console.log('index in downloading is : ' + index)
          this.downloading.splice(index, 1)
          await this.cache()
          resolve()
        })
      }else {
        torrent = this.downloaded.find(item => item.infoHash == torrent)
        if (!torrent) reject()
        let index = this.downloaded.indexOf(torrent)
        console.log('index in downloaded is : ' + index)
        this.downloaded.splice(index, 1)
        await this.cache()
        resolve()
      }
    })

  }

  clientError() {

  }

  register(ipc) {
    
  }
}


module.exports = WebTorrent