const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')
const bluebird = require('bluebird')
const UUID = require('uuid')
const { Init, Working, Failed } = require('./transStateMachine')
const TransObserver = require('./transObserver')
const Task = require('./task')
const debug = require('debug')('transmission')
const formidable = require('formidable')

bluebird.promisifyAll(fs)

class Manager extends EventEmitter{
  constructor(opts, user, drive, vfs) {
    super()
    this.tempPath = opts.path // 下载缓存目录
    this.storagePath = path.join(this.tempPath, 'storage.json') // 下载信息存储
    this.client = null // 所有下载任务同用一个下载实例
    this.downloading = [] // 下载任务列表
    this.downloaded = [] // 完成列表
    this.moveReadyQueue = []
    this.movingQueue = []
    this.lockNumber = 0 // 等待更新数量
    this.lock = false // 存储任务锁
    this.observer = null
    this.state = new Init(this)
    this.state.on('Working', () => {
      if (this.observer) return
      this.startObserver()
    })

    this.user = user
    this.drive = drive
    this.vfs = vfs
  }

  // 启用观察者
  startObserver() {
    this.observer = new TransObserver(this)
    this.observer.on('update', this.syncList.bind(this))
  }

  // 同步transmission 任务数据
  syncList(arg) {
    let tasks = arg.torrents
    let errArr = []
    this.downloading.forEach(item => {
      let result = tasks.find(task => task.id == item.id)
      if (result) item.set(result)
      // 无法在transmission任务列表中找到对应任务， 移除本地任务
      else errArr.push(item)
    })
    // 从队列中移除错误任务
    errArr.forEach(async item => {
      let index = this.downloading.indexOf(item)
      this.downloading.splice(index, 1)
      await this.cache()
    })
  }

  // 创建磁链、种子下载任务 ---
  async createTransmissionTask(type, source, driveUUID, dirUUID, userUUID, callback) {
    try {
      // 创建transmission任务
      let result, options = { "download-dir": this.tempPath }
      if (type === 'magnet') result = await this.client.addUrlAsync(source, options)
      else result = await this.client.addFileAsync(source, options)
      // 检查当前用户是否已创建过相同任务
      let resultInDownloading = this.downloading.find(item => {
        return item.id == result.id && 
        item.users.findIndex(user => user.userUUID == userUUID) !== -1
      })
      // 检查完成任务（相同ID、相同用户）
      let resultInDownloaded = this.downloaded.find(item => item.id == result.id)
      if (resultInDownloading) throw new Error('exist same task in downloading list')
      if (resultInDownloaded) return resultInDownloaded.state.add(dirUUID, userUUID, UUID.v4(), callback)
      // 创建本地任务
      else {
        await this.taskFactory(result.id, driveUUID, dirUUID, userUUID)
        this.observer.get(result, callback)
      }
    } catch (e) { callback(e) }
  }

  // 创建任务对象(创建、存储、监听) ---
  async taskFactory(id, driveUUID, dirUUID, userUUID) {
    try {
      // 创建
      let tasks = await this.get(id)
      if (tasks.torrents.length !== 1) throw new Error('create task error')
      // 检查是否有其他用户创建过相同任务
      let uuid = UUID.v4()
      let sameIdTask = this.downloading.find(item => item.id == id)
      if (sameIdTask) sameIdTask.add({driveUUID, dirUUID, userUUID, uuid})
      else new Task(id, [{driveUUID, dirUUID, userUUID, uuid}], null, this)
      // 存储
      await this.cache()
    } catch (err) { throw err }
  }

    // 暂停、开始、删除任务 ---
  op(id, uuid, userUUID, op, callback) {
    // 检查参数op
    let ops = ['pause', 'resume', 'destroy']
    if (!ops.includes(op)) callback(new Error('unknow error'))
    // 检查对应任务是否存在
    let indexCallback = item => item.id == id && 
      item.users.findIndex(user => user.userUUID == userUUID) !== -1
    let indexOfDownloading = this.downloading.findIndex(indexCallback)
    let indexOfDownloaded = this.downloaded.findIndex(indexCallback)
    let notFoundErr = new Error('can not found task')
    if (indexOfDownloaded == -1 && indexOfDownloading == -1) return callback(notFoundErr)
    // console.log(indexOfDownloading, indexOfDownloaded) 
    switch (op) {
      // 暂停任务
      case 'pause':
        this.client.stop(id, err => {
          if (err) callback(err)
          else this.observer.get({id, limit:5000, status: 0, times:0}, callback)
          
        })
        break
      // 开始任务
      case 'resume':const debug = require('debug')('transmission')
        this.client.start(id, err => {
          if (err) callback(err)
          else this.observer.get({id, limit:5000, status: 4, times:0}, callback)
        })
        break
      // 删除任务
      case 'destroy':
        // 任务对象
        let taskObj = indexOfDownloaded !== -1? this.downloaded[indexOfDownloaded]:
          this.downloading[indexOfDownloading]
        // 任务对象是否包含当前用户
        let index = taskObj.users.findIndex(item => item.uuid == uuid)
        if (index == -1) return callback(new Error('task not include this uuid'))
        
        // 删除任务对象中的当前用户
        taskObj.users.splice(index,1)
        // 判断transmission 任务是否有用户关联
        if (taskObj.users.length == 0) {
          if (indexOfDownloaded == -1) this.downloading.splice(indexOfDownloading, 1)
          else this.downloaded.splice(indexOfDownloaded, 1)
          this.client.remove(taskObj.id, false, callback)
        }else callback()
        this.cache()
        break
      default:
        callback(notFoundErr)
    }
  }

  // 存储任务信息 ---
  async cache() {
    if (this.lock) {
      // 有文件正在写入
      this.lockNumber++
    } else {
      // 写入操作
      this.lock = true
      this.lockNumber = 0
      let storageObj = {
        downloading: this.downloading.map(task => task.getBaseInfor()),
        downloaded: this.downloaded.map(task => task.getBaseInfor())
      }
      await fs.writeFileAsync(this.storagePath, JSON.stringify(storageObj, null, '\t'))
      this.lock = false
      // 检查被阻塞的写入操作
      if (this.lockNumber) this.cache()
    }
  }

  // 查询所有任务 ---
  getList(userUUID) {
    let downloading = [], downloaded = []
    this.downloading.forEach(item => {
      downloading.push(...(item.state.query(userUUID)))
    })

    this.downloaded.forEach(item => {
      downloaded.push(...(item.state.query(userUUID)))
    })
    return { downloading, downloaded }
  }

  // 查询任务 ---
  async get(id) {
    try {
      if (id) return await this.client.getAsync(id)
      else return await this.client.getAsync()
    } catch (e) {
      // todo
      console.log(e)
    }
  }

  addToDownloadingQueue(task) {
    this.downloading.push(task)
    this.cache()
  }

  removeFromDownloadingQueue(task) {
    this.downloading.splice(this.downloading.indexOf(task))
    this.cache()
  }

  addToDownloadedQueue(task) {
    this.downloaded.push(task)
    this.cache()
  }

  // 对下载完成需要进行拷贝的任务进行排队
  // 添加任务到准备队列
  addToMoveQueue(task) {
    this.moveReadyQueue.push(task)
    // 使用调度器
    this.scheduleMove()
  }

  // 将拷贝完成的任务从队列中移除
  removeFromMoveQueue(task) {
    let index = this.movingQueue.indexOf(task)
    this.movingQueue.splice(index, 1)
    this.scheduleMove()
  }

  // 调度拷贝任务
  scheduleMove() {
    while (this.moveReadyQueue.length > 0 && this.movingQueue.length == 0) {
      let task = this.moveReadyQueue.shift()
      if (!task) return
      this.movingQueue.push(task)
      task.state.move()
    }
  }

  LIST({ uuid }, props, callback) {
    callback(null, this.getList(uuid))
  }

  POST({ uuid }, props, callback) {
    let { magnetURL, dirUUID, driveUUID, type } = props
    if (props.type === 'magnet') {
      if (!magnetURL || !dirUUID) return callback(new Error('parameter error'))
      this.createTransmissionTask(type, magnetURL, driveUUID, dirUUID, uuid, callback)
    } else {
      let { req, type } = props
      let transmissionTmp = path.join(this.tempPath, 'torrents')
      let form = new formidable.IncomingForm()
      form.uploadDir = transmissionTmp
      form.keepExtensions = true
      form.parse(req, (err, fields, files) => {
        if (err) return callback(err)
        let dirUUID = fields.dirUUID
        let torrentPath = files.torrent.path
        if (!dirUUID || !torrentPath) return callback(new Error('parameter error'))
        this.createTransmissionTask('torrent', torrentPath, driveUUID, dirUUID, uuid, callback)
      })
    }
  }

  PATCH() {
    
  }
}

module.exports = Manager

