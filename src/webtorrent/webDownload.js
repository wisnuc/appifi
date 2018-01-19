const fs = require('fs')
const path = require('path')
const nodeUrl = require('url')
const EventEmitter = require('events')
const request = require('request')
const uuidv4 = require('uuid/v4')

class WebDownload extends EventEmitter {
  constructor() {
    super()
    this.list = []
  }

  get(id) {
    let obj = this.list.find(item => item.infoHash == id)
    if (obj) return obj
    else return null
  }

  add(path, url, dirUUID, userUUID, obj) {
    let task = new DownloadTask(path, url, dirUUID, userUUID, obj)
    this.list.push(task)
    return task
  }
}

class DownloadTask extends EventEmitter {
  constructor(path, url, dirUUID, user, obj) {
    super()
    let {inforHash, size} = obj
    if (inforHash) console.log('old task')
    else console.log('new task')
    this.type = 'http'
    this.path = path
    this.url = url
    this.dirUUID = dirUUID
    this.userUUID = user.uuid
    this.state = 'ready'
    this.isPause = false
    this.infoHash = inforHash || uuidv4()
    this.timeRemaining = ''
    this.size = size?size:0
    this.downloaded = 0
    this.bytesWritten = 0
    this.countSpeedFrame = 0
    this.downloadSpeed = 0
    this.progress = 0
    this.path = path
    this.name = ''
    this.finishTime = ''
    this.handle = null
    this.countSpeed = setInterval(() => {
      let gap = this.bytesWritten - this.countSpeedFrame
      this.downloadSpeed = gap > 0?gap:0
      this.countSpeedFrame = this.bytesWritten
      console.log(`current progress is ${(this.downloaded/this.size * 100).toFixed(2) } %, speed is ${this.downloadSpeed} downloaded is ${this.downloaded} size is ${this.size}`)
    }, 1000)
    this.init()
  }

  init() {
    console.log(this.infoHash)
    fs.lstat(path.join(this.path, this.infoHash), (err, data) => {
      if (err) {
        console.log('文件不存在， 重新下载')
      }else {
        console.log('文件存在， 继续下载 downloaded is ' + data.size)
        this.downloaded = data.size
      }
      this.run()
    })
  }

  pause() {
    if(!this.handle) return
    console.log('enter pause')
    this.isPause = true
    this.handle.abort()
    this.handle = null
  }

  resume() {
    if (this.handle) return
    console.log('enter resume')
    this.isPause = false
    this.run()
  }

  log() {
    let { type, infoHash, timeRemaining, downloaded, downloadSpeed, progress, path, name, dirUUID, state, userUUID, isPause, finishTime} = this
    return { type, infoHash, timeRemaining, downloaded, downloadSpeed, progress, path, name, dirUUID, state, userUUID, isPause, finishTime}
  }

  run() {
    this.state = 'downloading'
    let httpOptions = {
      method: 'GET',
      url: nodeUrl.parse(this.url),
      headers: {
        Range: `bytes=${this.downloaded}-`
      }
    }

    let streamOptions = {
      flags: this.downloaded == 0 ? 'w' : 'r+',
      start: this.downloaded,
      defaultEncoding: 'utf8',
		  fd: null,
		  mode: 0o666,
		  autoClose: true
    }

    let stream = fs.createWriteStream(path.join(this.path, this.infoHash), streamOptions)
    stream.on('error', err => console.log('stream error trigger', err))

    stream.on('drain', () => {
      let gap = stream.bytesWritten - this.bytesWritten
      this.downloaded += gap
      this.bytesWritten = stream.bytesWritten
      if (this.size !== 0) {
        // console.log(`current progress is ${(this.downloaded/this.size * 100).toFixed(2) } %, speed is ${this.downloadSpeed}`)
      }else {
        console.log('size is 0 , can not count progress')
      }
      // todo store
    })

    stream.on('finish', () => {
      console.log(`stream write stop bw is : ${this.bytesWritten} dd is: ${this.downloaded}`)
      let gap = stream.bytesWritten - this.bytesWritten
      this.downloaded += gap
      this.bytesWritten = stream.bytesWritten
      this.bytesWritten = 0
      if (this.downloaded == this.size) this.finish()
    })

    this.handle = request(httpOptions)
      .on('error', err => console.log('handle error trigger', err))
      .on('response', res => this.getRes(res))

    this.handle.pipe(stream)
  }

  getRes(res) {
    if (this.size == 0) this.size = Number(res.headers['content-length'])
    this.name = this.getFileName(res.headers)
    console.log(`After get response : size is ${this.size} & name is ${this.name}`)
  }

  finish() {
    this.state = 'moving'
    this.finishTime = (new Date()).getTime()
    this.emit('done')
  }

  getFileName(headers) {
    let dis = headers['content-disposition']
    if (dis && typeof dis == 'string' && dis.lastIndexOf('filename=') != -1) {
      let dis = headers['content-disposition']
      let index = dis.lastIndexOf('filename=')
      return dis.substr(index + 9)
    }else {
      let index1 = this.url.lastIndexOf('/')
      if (index1 == -1) return ''
      let s1 = this.url.substr(index1 + 1)
      let index2 = s1.lastIndexOf('?')
      if (index2 == -1) return s1
      else return s1.substring(0, index2)
    }
  }
}


// test

const d = path.normalize('/Users/apple/Documents/code')
const u = 'https://dldir1.qq.com/qqfile/qq/TIM2.1.0/22747/TIM2.1.0.exe'

var webD = new WebDownload()
var task = webD.add(d, u, 'a', 'b', {inforHash: 'fd73ac27-de74-43be-ac66-1a8131d4395e', size: 69697440})
task.on('done', () => {
  console.log('done trigger')
})

// setTimeout(() => {
//   task.pause()
//   // console.log(task)
// }, 5000)

// setTimeout(() => {
//   task.resume()
// }, 8000)