const path = require('path')
const fs = require('fs')
const webT = require('webtorrent')
const webD = require('./webDownload')
const mkdirpAsync = require('bluebird').promisify(require('mkdirp'))

// 将promise转化为callback
const asCallback = (fn) => {
  return (props, callback) => {
    fn(props)
      .then(data => callback(null, data))
      .catch(e => callback(e))
  }
}

// 将同步方法转为callback
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

// 子进程命令管理
class IpcWorker {

  constructor() {
    this.commandMap = new Map() 
  }

  // 注册指令
  register(key, val) {
    this.commandMap.set(key, val)
  }

  // 注册指令列表
  registerMap(map) {
    this.commandMap = new Map([...this.commandMap, ...map])
  }

  // 处理父进程指令
  handleCommand(worker, msg) {
    // 查找指令对应方法
    let { id, op, args } = msg
    let handler = this.commandMap.get(op)
    // 指令不存在 返回错误
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
      // 操作出现错误 返回错误
      if (err) {
        worker.send({
          type: 'command',
          id: id,
          err: {
            code: err.code,
            message: err.message
          }
        })
      } else worker.send({ type: 'command', id, data })
    })
  }
  mulu
  // 处理父进程消息
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

// 创建子进程通信服务
const createIpcWorker = () => new IpcWorker()

// 任务信息打印方法
var logA = function () {
  let { type, infoHash, timeRemaining, downloaded, downloadSpeed, progress, numPeers, path, name, url, torrentPath, magnetURL, dirUUID, state, userUUID, isPause, finishTime } = this
  return { type, infoHash, timeRemaining, downloaded, downloadSpeed, progress, numPeers, path, name, url, torrentPath, magnetURL, dirUUID, state, userUUID, isPause, finishTime }
}

// 下载管理服务
class WebTorrentService {
  constructor(tempPath) {
    this.tempPath = tempPath // 下载临时目录
    this.catchPath = path.join(this.tempPath, 'storage.json') // 下载信息存储
    this.client = new webD() // 所有下载任务同用一个HTTP下载实例
    this.clients = [] // 不同用户使用不同BT下载实例
    this.downloading = [] // 下载任务列表
    this.downloaded = [] // 完成列表
    this.writing = false // 是否正在更新记录文件
    this.lockNumber = 0 // 等待更新数量
    this.init() // 初始化
    console.log('WebTorrent Start!')
  }

  // 查看任务缓存信息并创建任务
  init() {
    // 不存在缓存文件 返回
    if (!fs.existsSync(this.catchPath)) return console.log('catch path not exist')
    try {

      let tasks = JSON.parse(fs.readFileSync(this.catchPath))
      // 更新完成任务列表
      this.downloaded = tasks.downloaded
      this.downloaded.forEach(item => item.log = logA)
      // 继续未完成任务
      tasks.downloading.forEach((file, index) => {
        if (file.type == 'http') {
          this.addHttp({url: file.url, dirUUID: file.dirUUID, user: {uuid: file.userUUID}, infor: {infoHash: file.infoHash, size: file.size} })
        }else if (file.torrentPath) 
          this.addTorrent({ torrentPath: file.torrentPath, dirUUID: file.dirUUID, user: {uuid: file.userUUID} })
        else if (file.magnetURL) 
          this.addMagnet({ magnetURL: file.magnetURL, dirUUID: file.dirUUID, user: {uuid: file.userUUID} })
      })
    } catch (e) {
      // 出现错误 移除整个临时目录 todo !
      console.log('Error in init ', e)
      fs.unlinkSync(this.catchPath)
      console.log('this catch file has been removed')
    }
  }

  // 获取用户BT下载实例
  getClient(userUUID) {
    let client = this.clients.find(item => item.userUUID == userUUID)
    if (client) return client
    let newClient = new webT()
    newClient.userUUID = userUUID
    newClient.on('error', err => { // todo
      console.log('client error : ' + err.message)
    })
    this.clients.push(newClient)
    return newClient
  }

  // 添加种子下载任务
  async addTorrent({ torrentPath, dirUUID, user }) {
    if (!fs.existsSync(torrentPath)) throw new Error('torrent file not exist')
    let torrentBuffer = fs.readFileSync(torrentPath)
    return await this.createTorrent({ torrentSource: torrentBuffer, dirUUID, torrentPath, user })
  }

  // 添加磁链下载任务
  async addMagnet({ magnetURL, dirUUID, user, infor }) {
    if (typeof magnetURL !== 'string' || magnetURL.indexOf('magnet') == -1) 
      throw new Error('magnetURL is not a legal magnetURL')
    return await this.createTorrent({ torrentSource: magnetURL, dirUUID, user })
  }

  // 创建HTTP下载任务
  async addHttp({url, dirUUID, user, infor}) {
    if (typeof url !== 'string') throw new Error('url is not legal')
    return await this.createHttpDownload({ url, dirUUID, user, infor})
  }

  // http & 存储
  async createHttpDownload({ url, dirUUID, user, infor}) {
    let obj = this.client.add(this.tempPath, url, dirUUID, user, infor)
    obj.on('done', () => this.enterMove(obj))
    this.downloading.push(obj)
    await this.cache()
    return {}
  }

  // 种子/磁链 & 存储
  async createTorrent({ torrentSource, dirUUID, torrentPath, user }) {
    // 每个用户拥有的种子下载目录(临时目录名 + 用户UUID 组成)
    let userTmpPath = path.join(this.tempPath, user.uuid)
    // 获取种子下载实例（不存在则创建）
    let torrent = this.getClient(user.uuid).add(torrentSource, { path: userTmpPath })
    if (!torrent.infoHash) throw new Error('unknow torrent')
    // 
    if (this.downloading.findIndex(item => item.infoHash == torrent.infoHash && item.userUUID == user.uuid) !== -1) throw new Error('torrent exist')
    // 为下载任务对象添加必要属性
    torrent.type = 'torrent' // 下载类型
    torrent.dirUUID = dirUUID // 下载目标目录UUID
    torrent.log = logA // 打印方法
    torrent.state = 'downloading' // 任务状态
    torrent.torrentPath = torrentPath ? torrentPath : null // 种子路径（magenet没有种子路径）
    torrent.magnetURL = torrentPath ? null : torrentSource // 磁链地址 （torrent没有磁链地址）
    torrent.userUUID = user.uuid //  
    torrent.isPause = false // 是否暂停
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
    if (!torrent) torrent = this.client.get(torrentId)
    if (!torrent) throw new Error('torrent not exist')
    torrent.pause()
    torrent.isPause = true
    return torrent.log()
  }

  //resume a torrent with torrentID
  resume({ torrentId, user }) {
    let torrent = this.getClient(user.uuid).get(torrentId)
    if (!torrent) torrent = this.client.get(torrentId)
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

  // 通知父进程移动下载文件 & 刷新目录
  enterMove(torrent) {
    process.send({type: 'move', torrent: torrent.log()})
  }

  moveFinish({ torrentId, userUUID}) {console.log('torrent move finish', torrentId, userUUID)
    let torrent = this.getClient(userUUID).get(torrentId)
    if (!torrent) torrent = this.client.get(torrentId)
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
    ipc.register('addHttp', asCallback(this.addHttp.bind(this)))
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