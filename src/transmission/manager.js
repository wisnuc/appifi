const { spawn, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')
const Transmission = require('transmission')
const bluebird = require('bluebird')
const UUID = require('uuid')
const getFruit = require('../fruitmix')

bluebird.promisifyAll(fs)

class Manager extends EventEmitter {
  constructor(tempPath) {
    super()
    this.tempPath = tempPath // 下载缓存目录
    this.storagePath = path.join(this.tempPath, 'storage.json') // 下载信息存储
    this.client = null // 所有下载任务同用一个下载实例
    this.downloading = [] // 下载任务列表
    this.downloaded = [] // 完成列表
    this.moveReadyQueue = []
    this.movingQueue = []
    this.writing = false // 是否正在更新记录文件
    this.lockNumber = 0 // 等待更新数量
    this.lock = false // 存储任务锁
    this.errors = [] // 错误列表
  }

  // 初始化 ---
  async init() {
    // 检查transmission-daemon 
    try {
      let command = 'systemctl'
      let serviceName = 'transmission-daemon'
      // 尝试启动服务
      spawnSync(command, ['enable', serviceName])
      spawnSync(command, ['start', serviceName])
      // 检查服务状态
      let enableResult = spawnSync(command, ['is-enabled', serviceName]).stdout.toString()
      let activeResult = spawnSync(command, ['is-active', serviceName]).stdout.toString()
      if (enableResult.indexOf('enabled') === -1) this.error(enableResult.stderr.toString())
      if (activeResult.indexOf('active') === -1) return this.error(enableResult.stderr.toString())
      // 实例化Transmission
      this.client = new Transmission({
        host: 'localhost',
        port: 9091,
        username: 'transmission',
        password: '123456'
      })
      bluebird.promisifyAll(this.client)
      // 设置transmission属性
      await this.client.sessionAsync({
        seedRatioLimit: 5,
        seedRatioLimited: false,
        'speed-limit-up-enabled': false,
        'speed-limit-down-enabled': false
      })
    } catch (error) { this.error(error) }

    // 读取缓存文件， 创建未完成任务
    if (!fs.existsSync(this.storagePath)) return
    let tasks = JSON.parse(fs.readFileSync(this.storagePath))

    this.downloaded = tasks.downloaded.map(task => {
      let { uuid, id, users, name, finishTime, originExist } = task
      return new Task(uuid, id, users, name, this, finishTime)
    })

    this.downloading = tasks.downloading.map(task => {
      let { uuid, id, users } = task
      return new Task(uuid, id, users, null, this)
    })
  }

  // 错误处理
  error(arg) {
    let err = typeof arg === 'object' ? arg : new Error(arg)
    this.client = null
    this.errors.push(err)
  }

  // 同步transmission 任务数据
  syncList() {
    if (this.sync) return
    this.sync = setInterval(() => {
      this.client.get((err, arg) => {
        let tasks = arg.torrents
        let errArr = []
        this.downloading.forEach((item) => {
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
      })
    }, 1000)
  }

  clearSync() {
    clearInterval(this.sync)
  }

  scaner() {
    if (this.scan) return
    this.scan = setInterval(async () => {
      try {
        // 获取transmission 列表
        let tasks = (await this.client.getAsync()).torrents
        // 遍历已完成任务
        this.downloaded.forEach((task, index) => {
          if (!tasks.find(item => item.id === task.id)) return // 没有在transmission任务中找到对于ID 返回
          // 检查下载中任务是否有相同ID
          let indexOfDownloading = this.downloading.findIndex(item => item.id == task.id)
          // 检查完成任务中是否有相同ID且序号比当前任务大
          let indexOfDownloaded = this.downloaded.findIndex((item, itemIndex) => item.id == task.id && itemIndex > index)
          if (indexOfDownloading !== -1) return // 在下载进行任务中找到任务 返回
          if (indexOfDownloaded !== -1) return  // 在完成列表中找到相同任务 返回
          let timeStart = task.finishTime
          let timeEnd = (new Date()).getTime()
          // 任务已完成超过2小时 删除transmission 对于任务以及文件
          if ((timeEnd - timeStart) / 1000 / 60 / 60 > 12) {
            // console.log('', (timeEnd - timeStart) / 1000 / 60 / 60)
            this.client.removeAsync(task.id, true, (err, result) => {
              if (err) throw err
              task.originExist = false
              this.cache()
            })
          }
        })
      } catch (e) { console.log(`error in scaner`, e) }
    }, 3000)
  }

  /* task object
    * hashString: hash of task
    * id: task id in transmission
    * name: task name
  */

  // 创建磁链、种子下载任务 ---
  async createTransmissionTask(type, source, dirUUID, userUUID) {
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
      // 检查完成任务（相同ID、相同用户、源文件存在）
      // let resultInDownloaded = this.downloaded.find(item => {
      //   return item.id == result.id &&
      //   item.originExist == true
      //   item.users.findIndex(user => user.userUUID == userUUID)
      // })
      if (resultInDownloading) throw new Error('exist same task in downloading list')
      // if (resultInDownloaded) throw new Error('exist same task in downloaded list')
      // 创建本地任务
      else await this.taskFactory(result.id, dirUUID, userUUID)
      return result
    } catch (e) { throw e }
  }

  // 创建任务对象(创建、存储、监听) ---
  async taskFactory(id, dirUUID, userUUID) {
    try {
      // 创建
      let tasks = await this.get(id)
      if (tasks.torrents.length !== 1) throw new Error('create task error')
      // 检查是否有其他用户创建过相同任务
      let sameIdTask = this.downloading.find(item => item.id == id)
      if (sameIdTask) sameIdTask.users.push({dirUUID, userUUID})
      else this.downloading.push(new Task(UUID.v4(), id, {dirUUID, userUUID}, null, this))
      // 存储
      await this.cache()
    } catch (err) { throw err }
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
        downloading: this.downloading.map(file => file.getInfor()),
        downloaded: this.downloaded.map(file => file.getInfor())
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
      let index = item.users.findIndex(user => user.userUUID == userUUID)
      if (index !== -1) downloading.push(item.getSummary())
    })

    this.downloaded.forEach(item => {
      let index = item.users.findIndex(user => user.userUUID == userUUID)
      if (index !== -1) downloaded.push(item.getFinishInfor())
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

  // 暂停、开始、删除任务 ---
  op(id, userUUID, op, callback) {
    // 检查参数op
    let ops = ['pause', 'resume', 'destroy']
    if (!ops.includes(op)) callback(new Error('unknow error'))
    // 检查对应任务是否存在
    let indexCallback = item => item.id == id && 
    item.users.findIndex(user => user.userUUID == userUUID) !== -1
    let indexOfDownloading = this.downloading.findIndex(indexCallback)
    let indexOfDownloaded = this.downloaded.findIndex(indexCallback)
    let notFoundErr = new Error('can not found task')
    let opCallback = (err, data) => {
      if (err) callback(err)
      else callback(null, data)
    }
    console.log(indexOfDownloading, indexOfDownloaded)
    switch (op) {
      // 暂停任务
      case 'pause':
        if (indexOfDownloading == -1) return callback(notFoundErr)
        this.client.stop(id, opCallback)
        break
      // 开始任务
      case 'resume':
        if (indexOfDownloading == -1) callback(notFoundErr)
        this.client.start(id, opCallback)
        break
      // 删除任务
      case 'destroy':
        // 任务对象
        let taskObj = indexOfDownloaded === -1? this.downloaded[indexOfDownloaded]:
          this.downloading[indexOfDownloading]
        // 任务对象是否包含当前用户
        let index = taskObj.users.findIndex(item => item.userUUID == userUUID)
        if (index == -1) callback(new Error('task not include user'))
        // 删除任务对象中的当前用户
        else taskObj.users.splice(index,1)

        if (indexOfDownloading !== -1) {
          // 用户数为0 删除任务
          if (taskObj.users.length == 0 ) {
            this.client.remove(id, false, (err, data) => {
              if (err) return callback(err)
              // 删除内存中任务对象
              this.downloading.splice(indexOfDownloading, 1)
              // 保存
              this.cache().then(() => { callback() })
                .catch(err => callback(err))
            })
          // 用户数不为0 保存
          } else {
            this.cache().then(() => { callback() })
                .catch(err => callback(err))
          }
        } else if (indexOfDownloaded !== -1) {
          // 用户数为0 删除内存中对象
          if (taskObj.users.length == 0) {
            this.downloaded.splice(indexOfDownloaded, 1)
          }
          // 保存
          this.cache().then(() => { callback() })
            .catch(err => callback(err))
        } else callback(notFoundErr)
        break
      default:
        callback(notFoundErr)
    }
  }

  enterFinishState(task) {
    let index = this.downloading.indexOf(task)
    let result = this.downloading.splice(index, 1)[0]
    result.finishTime = (new Date()).getTime()
    this.downloaded.push(result)
    this.cache()
  }


  // 对下载完成需要进行拷贝的任务进行排队
  // 添加任务到准备队列
  addToMoveQueue(task) {
    // 检查任务是否已存在与队列中
    if (task.state !== 'downloading') return
    this.moveReadyQueue.push(task)
    task.state = 'willMove'
    // 使用调度器
    this.scheduleMove()
  }

  // 将拷贝完成的任务从队列中移除
  removeFromMovingQueue(task) {
    let index = this.movingQueue.indexOf(task)
    if (index == -1) return console.log('exist error ')
    this.movingQueue.splice(index, 1)
    this.scheduleMove()
  }

  // 调度拷贝任务
  scheduleMove() {
    while (this.moveReadyQueue.length > 0 && this.movingQueue.length == 0) {
      let task = this.moveReadyQueue.shift()
      if (!task) return
      this.movingQueue.push(task)
      task.move()
    }
  }
}

class Task {
  constructor(uuid, id, users, name, manager, finishTime) {
    this.uuid = uuid
    this.id = id // 任务id
    //this.dirUUID = dirUUID // 下载目标目录
    //this.userUUID = userUUID // 用户uuid
    this.users = Array.isArray(users)?users:[users]
    this.downloadDir = '' // 下载临时目录
    this.name = name ? name : '' // 任务名称
    this.rateDownload = null //下载速率
    this.rateUpload = null // 上传速率
    this.percentDone = 0 // 完成比例
    this.eta = Infinity // 剩余时间
    this.status = null // 当前状态(in transmission)
    this.manager = manager // 容器
    this.state = 'downloading' // 本地状态(downloading/moving/finish)
    this.finishTime = finishTime ? finishTime : null // 任务完成时间
    this.originExist = true
  }

  // 与transmission中对应任务进行同步，判断是否完成
  set(task) {
    let { downloadDir, name, rateDownload, rateUpload, percentDone, eta, status } = task
    let nextState = { downloadDir, name, rateDownload, rateUpload, percentDone, eta, status }
    Object.assign(this, nextState)
    this.judeProgress(task)
  }

  // 判断下载任务是否完成
  judeProgress(task) {
    // 本地任务处于移动或完成状态，跳过
    if (this.state !== 'downloading') return
    // 完成条件1 任务标记为完成
    let conditionA = task.isFinished
    // 完成条件2 任务进入了seed状态
    let conditionB = [5, 6].includes(task.status)
    // 完成条件3 任务处于暂停状态、完成度为100%
    let conditionC = task.status == 0 && task.percentDone == 1
    // 进行移动等操作
    if (conditionA || conditionB || conditionC) this.manager.addToMoveQueue(this)
  }

  // 获取任务关键信息， 存储用 ---
  getInfor() {
    let { uuid, id, users, finishTime, name, originExist } = this
    return { uuid, id, users, finishTime, name, originExist }
  }

  // 获取任务基本信息， 查询用 ---
  getSummary() {
    let { uuid, id, name, rateDownload, percentDone, eta, status } = this
    return { uuid, id, name, rateDownload, percentDone, eta, status }
  }

  // 获取完成任务的基本信息， 查询用 ---
  getFinishInfor() {
    let { uuid, name, finishTime, id } = this
    return { uuid, name, finishTime, id }
  }

  move() {
    try {
      this.state = 'moving'
      let tmpPath = path.join(this.downloadDir, this.name) // 获取下载文件的临时目录
      let fruitmix = getFruit() // 获取fruitmix实例
      let user = { uuid: this.userUUID } // 构造user对象用于查询
      let drive = fruitmix.getDrives(user).find(item => item.tag == 'home') // 获取用户home对象
      let targetDirPath = fruitmix.getDriveDirPath(user, drive.uuid, this.dirUUID) // 获取用户下载目标目录路径
      let targetPath = this.getName(targetDirPath, this.name)  // 检查目标路径是否有相同文件名并重命名
      console.log('文件临时目录: ', tmpPath, '\n', '文件目标目录: ', targetPath)
      let cp = spawn('cp', ['-rf', tmpPath, targetPath])
      cp.stderr.on('data', data => console.log(data.toString(), 'err')) // 错误处理 todo
      cp.on('exit', code => {
        console.log('退出码是: ', code)
        fruitmix.driveList.getDriveDir(drive.uuid, this.dirUUID)
        this.manager.removeFromMovingQueue(this)
        this.manager.enterFinishState(this)
      })
    } catch (e) {
      console.log(e)
    }
  }

  getName(dirPath, fileName) {
    let newName, index = 0
    let isFIleExist = () => {
      try {
        let nameArr = fileName.split('.')
        if (nameArr.length > 1) {
          nameArr[nameArr.length - 2] += (index == 0 ? '' : '(' + (index + 1) + ')')
          newName = path.join(dirPath, nameArr.join('.'))
        } else {
          newName = path.join(dirPath, nameArr[0] + (index == 0 ? '' : '(' + (index + 1) + ')'))
        }
        let exist = fs.existsSync(newName)
        if (!exist) return newName
        else {
          console.log('file exist rename', index)
          index++
          return isFIleExist()
        }
      } catch (e) { console.log(e) }
    }
    return isFIleExist()
  }
}

module.exports = Manager

