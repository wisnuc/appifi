const path = require('path')
const fs = require('fs')
const webT = require('webtorrent')
const mkdirpAsync = require('bluebird').promisify(require('mkdirp'))

const asCallback = (fn) => {
  return (props, callback) => {
    fn(props)
      .then(data => callback(null, data))
      .catch(e => callback(e))
  }
}

const syncCallback = (fn) => {
  return (props, callback) => {
    try{
      let result = fn(props)
      callback(null, result)
    } catch(e) {
      callback(e)
    }
  }
}

class IpcWorker {

  constructor() {
    this.commandMap = new Map()
  }

  register(key, val) {
    this.commandMap.set(key, val)
  }

  registerMap(map) {
    this.commandMap = new Map([...this.commandMap, ...map])
  }

  // no id is illegal
  handleCommand(worker, msg) {

    let { id, op, args } = msg
    let handler = this.commandMap.get(op)

    if (!handler) {
      return worker.send({
        type: 'command',
        id,
        err: {
          code: 'ENOHANDLER',
          message: `no handler found for ${op}`
        }
      })
    }

    // default data to null, otherwise it will be eliminated
    handler(msg.args, (err, data = null) => {

      // change to debug TODO
      // console.log('handler', err || data)

      if (err) {
        worker.send({
          type: 'command',
          id: id,
          err: {
            code: err.code,
            message: err.message
          }
        })
      }
      else {
        worker.send({ type: 'command', id, data })
      }
    })
  }

  handle(worker, msg) {
    switch (msg.type) {
      case 'command':
        this.handleCommand(worker, msg)
        break
      default:
        break
    }
  }
}

const createIpcWorker = () => new IpcWorker()

var logA = function () {
  let { infoHash, timeRemaining, downloaded, downloadSpeed, progress, numPeers, path, name, torrentPath, magnetURL, dirUUID, state, userUUID, isPause, finishTime } = this
  return { infoHash, timeRemaining, downloaded, downloadSpeed, progress, numPeers, path, name, torrentPath, magnetURL, dirUUID, state, userUUID, isPause, finishTime }
}

var logB = function() {
  
}

class WebTorrentService {
  constructor(tempPath) {
    this.tempPath = tempPath
    this.catchPath = path.join(this.tempPath, 'storage.json')
    // this.client = new webT()
    // this.client.on('torrent', this.newTorrent)
    // this.client.on('error', this.clientError)
    this.clients = []
    this.downloading = []
    this.downloaded = []
    this.writing = false
    this.lockNumber = 0
    this.init()
    console.log('WebTorrent Start!')
  }

  //read storage & create tasksuuid:
  init() {
    if (!fs.existsSync(this.catchPath)) return console.log('catch path not exist')
    try {
      let tasks = JSON.parse(fs.readFileSync(this.catchPath))
      this.downloaded = tasks.downloaded
      this.downloaded.forEach(item => item.log = logA)
      tasks.downloading.forEach((file, index) => {
        if (file.torrentPath) 
          this.addTorrent({ torrentPath: file.torrentPath, dirUUID: file.dirUUID, user: {uuid: file.userUUID} })
        else if (file.magnetURL) 
          this.addMagnet({ magnetURL: file.magnetURL, dirUUID: file.dirUUID, user: {uuid: file.userUUID} })
      })
    } catch (e) {
      console.log('Error in init ', e)
      fs.unlinkSync(this.catchPath)
      console.log('this catch file has been removed')
    }
  }

  // each user has own client will be created in first request
  getClient(userUUID) {
    let client = this.clients.find(item => item.userUUID == userUUID)
    if (client) return client
    let newClient = new webT()
    newClient.userUUID = userUUID
    newClient.on('error', err => {
      console.log('client error : ' + err.message)
    })
    this.clients.push(newClient)
    return newClient
  }

  //add task with torrent file
  async addTorrent({ torrentPath, dirUUID, user }) {
    if (!fs.existsSync(torrentPath)) throw new Error('torrent file not exist')
    let torrentBuffer = fs.readFileSync(torrentPath)
    return await this.createTorrent({ torrentSource: torrentBuffer, dirUUID, torrentPath, user })
  }

  //add task with magnet url
  async addMagnet({ magnetURL, dirUUID, user }) {
    if (typeof magnetURL !== 'string' || magnetURL.indexOf('magnet') == -1) 
      throw new Error('magnetURL is not a legal magnetURL')
    return await this.createTorrent({ torrentSource: magnetURL, dirUUID, user })
  }

  // create torrent & storage
  async createTorrent({ torrentSource, dirUUID, torrentPath, user }) {
    // create client(not necessary) & create torrent
    let userTmpPath = path.join(this.tempPath, user.uuid)
    let torrent = this.getClient(user.uuid).add(torrentSource, { path: userTmpPath })
    // let server = torrent.createServer()
    // server.listen(3456)
    if (!torrent.infoHash) throw new Error('unknow torrent')

    // add property to torrent object & add object to downloading list
    if (this.downloading.findIndex(item => item.infoHash == torrent.infoHash && item.userUUID == user.uuid) !== -1) throw new Error('torrent exist')
      
    torrent.dirUUID = dirUUID
    torrent.log = logA
    torrent.state = 'downloading'
    torrent.torrentPath = torrentPath ? torrentPath : null
    torrent.magnetURL = torrentPath ? null : torrentSource
    torrent.userUUID = user.uuid
    torrent.isPause = false
    torrent.on('done', () => {//todo 
      console.log('torrent done trigger ' + torrent.progress)
      if (torrent.progress !== 1) return
      this.enterMove(torrent)
    })
    this.downloading.push(torrent)
    
    // add torrent to storage
    await this.cache()
    return {torrentId: torrent.infoHash}
  }

  //pasuse a torrent with torrentID
  pause({ torrentId, user }) {
    let torrent = this.getClient(user.uuid).get(torrentId)
    if (!torrent) throw new Error('torrent not exist')
    torrent.pause()
    torrent.isPause = true
    return torrent.log()
  }

  //resume a torrent with torrentID
  resume({ torrentId, user }) {
    let torrent = this.getClient(user.uuid).get(torrentId)
    if (!torrent) throw new Error('torrent not exist')
    torrent.resume()
    torrent.isPause = false
    return torrent.log()
  }

  //query summary of downloading torrent (torrentID is not necessary)
  getSummary({ torrentId, type, user}) {
    let client = this.getClient(user.uuid)
    if (torrentId) {
      // get summary with id
      if (typeof torrentId !== 'string' || torrentId.length <= 1) throw new Error('torrentId is not legal')
      let result = client.get(torrentId) || this.downloaded.find(item => item.infoHash == torrentId && item.userUUID == user.uuid)
      if (result) return result.log() 
      else throw new Error ('torrentId is not legal')
    } else if (type){
      // get summary with type
      if ([ 'finished', 'running' ].indexOf(type) == -1) throw new Error('type is not legal')
      return type == 'running'? this.getDownloading(user): this.getDownloaded(user)
    } else return { running : this.getDownloading(user), finish: this.getDownloaded(user)}
  }

  //query summary of downloading torrent with userUUID
  getDownloading(user) {
    return this.downloading.filter(file => file.userUUID == user.uuid).map(file => file.log())
  }

  //query summary of downloaded torrent with userUUID
  getDownloaded(user) {
    return this.downloaded.filter(file => file.userUUID == user.uuid).map(file => file.log())
  }

  //storage list of torrent
  cache() {
    return new Promise((resolve, reject) => {
      if (this.writing) {
        this.lockNumber++
        resolve()
        return
      }
      this.writing = true
      let obj = {
        downloading: this.downloading.map(file => file.log()),
        downloaded: this.downloaded.map(file => file.log())
      }
      fs.writeFile(this.catchPath, JSON.stringify(obj, null, '\t'), err => {
        this.writing = false
        if (err) reject(err)
        else {
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
  destory({ torrentId, user }) {
    return new Promise(async (resolve, reject) => {
      console.log(torrentId, user.uuid)
      let torrent = this.downloading.find(item => item.infoHash == torrentId && item.userUUID == user.uuid)
      if (torrent) {
        console.log('find torrent in downloading array')
        torrent.destroy(async () => {
          console.log('torrent has been destory')
          let index = this.downloading.indexOf(torrent)
          console.log('index in downloading is : ' + index)
          this.downloading.splice(index, 1)
          await this.cache()
          resolve()
        })
      } else {
        torrent = this.downloaded.find(item => item.infoHash == torrent)
        if (!torrent) reject()
        let index = this.downloaded.indexOf(torrent)
        console.log('index in downloaded is : ' + index)
        this.downloaded.splice(index, 1)
        await this.cache()
        resolve()
      }

      // todo remove cache
    })
  }

  enterMove(torrent) {
    process.send({type: 'move', torrent: torrent.log()})
  }

  moveFinish({ torrentId, userUUID}) {console.log('torrent move finish', torrentId, userUUID)
    let torrent = this.getClient(userUUID).get(torrentId)
    if (!torrent) throw new Error('not found torrent')
    torrent.state = 'finish'
    torrent.finishTime = (new Date).getTime()
    // stop torrent uploading & move to downloaded array
    torrent.destroy(() => {
      // fs.renameSync(path.join(torrent.path, torrent.name), path.join(torrent.dirUUID, torrent.name))
      let index = this.downloading.indexOf(torrent)
      if (index == -1) throw new Error('torrent is not exist in downloading array')
      this.downloading.splice(index, 1)
      this.downloaded.push(torrent)
      this.cache()
      console.log('torrent destory success')
    })
  }

  clientError() {

  }

  register(ipc) {
    ipc.register('addTorrent', asCallback(this.addTorrent.bind(this)))
    ipc.register('addMagnet', asCallback(this.addMagnet.bind(this)))
    ipc.register('getSummary', syncCallback(this.getSummary.bind(this)))
    ipc.register('pause', syncCallback(this.pause.bind(this)))
    ipc.register('resume', syncCallback(this.resume.bind(this)))
    ipc.register('destroy', asCallback(this.destory.bind(this)))
    ipc.register('moveFinish', syncCallback(this.moveFinish.bind(this)))
  }
}

let ipc = createIpcWorker()

// folder
let wPath = process.argv[2]

let webTorrentService = new WebTorrentService(wPath)
webTorrentService.register(ipc)

process.on('message', msg => ipc.handle(process, msg))