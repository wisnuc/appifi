const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
// const getFruit = require('../fruitmix')
const getFruit = () => null // TODO
const { clone } = require('../lib/btrfs')

class State {
  constructor(ctx, ...args) {
    // 重置CTX状态对象
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)
  }

  // 设置新态
  setState(NextState, ...args) {
    this.exit()
    new NextState(this.ctx, ...args)
  }

  enter() {}
  exit() {}

  // 下载任务信息 查询用
  get() {
    let { id, name, rateDownload, percentDone, eta, status } = this.ctx
    return { id, name, rateDownload, percentDone, eta, status }
  }

  add(user) {
    this.ctx.users.push(user)
  }

  query(userUUID) {
    let users = []
    let tasks = []
    this.ctx.users.forEach(item => {
      if ( item.userUUID == userUUID ) users.push(item)
    })

    users.forEach(item => {
      tasks.push(Object.assign({}, item, this.get()))
    })
    
     return tasks
  }
}

class Downloading extends State {
  constructor(ctx) {
    super(ctx)
    this.name = 'downloading'
  }

  enter() {
    this.ctx.manager.addToDownloadingQueue(this.ctx)
  }

  exit() {
    this.ctx.manager.removeFromDownloadingQueue(this.ctx)
  }
}

class Moving extends State {
  constructor(ctx) {
    super(ctx)
    this.name = 'moving'
  }

  enter() {
    console.log('enter move', this.ctx.id)
    this.ctx.manager.addToMoveQueue(this.ctx)
  }

  exit() {
    this.ctx.manager.removeFromMoveQueue(this.ctx)
    this.ctx.manager.removeFromDownloadingQueue(this.ctx)
  }

  move() {
    console.log('begin move', this.ctx.id)
    try {
      let { downloadDir, name, users } = this.ctx
      let tmpPath = path.join(downloadDir, name) // 获取下载文件的临时目录
      let index = 0
      console.log('should copy ', users.length)
      let callback = (err, data) => {
        if (err) return console.log(err)
        console.log('after clone')
        users[index].finishTime = (new Date()).getTime()
        if (++index >= users.length) return this.setState(Finish)
        else copy(tmpPath, this.ctx.name, users[index], callback)
      }
      copy(tmpPath, this.ctx.name, users[index], callback)

    } catch (e) {
      console.log(e)
    }
  }
}

class Finish extends State {
  enter() {
    this.ctx.manager.addToDownloadedQueue(this.ctx)
  }

  // 完成任务信息 查询用
  get() {
    let { name, id } = this.ctx
    return { name, id }
  }

  add(dirUUID, userUUID, uuid, callback) {
    let user = {dirUUID, userUUID, uuid}
    let { downloadDir, name, users } = this.ctx
    let tmpPath = path.join(downloadDir, name) // 获取下载文件的临时目录
    
    copy(tmpPath, this.ctx.name, user, (err) => {
      if (err) return callback(err)
      else {
        this.ctx.users.push(Object.assign({}, user, {finishTime: (new Date()).getTime()}))
        this.ctx.manager.cache()
        callback()
      }
    })
  }
}

class Task {
  constructor(id, users, name, manager, isFinish) {
    this.id = id // 任务id
    this.users = users
    this.manager = manager // 容器
    this.name = name ? name : '' // 任务名称
    this.downloadDir = '' // 下载临时目录
    this.rateDownload = null //下载速率
    this.rateUpload = null // 上传速率
    this.percentDone = 0 // 完成比例
    this.eta = Infinity // 剩余时间
    this.status = null // 当前状态(from transmission)
    this.state = null
    // 本地状态(downloading/moving/finish)
    if (isFinish) new Finish(this)
    else new Downloading(this) 
  }

  // 与transmission中对应任务进行同步，判断是否完成
  set(task) {
    let { name, downloadDir, rateDownload, rateUpload, percentDone, eta, status } = task
    let nextState = { downloadDir, name, rateDownload, rateUpload, percentDone, eta, status }
    Object.assign(this, nextState)
    if (judeProgress(this)) {
      console.log('on task is downloaded enter move')
      process.nextTick(this.state.setState.bind(this.state, Moving))
    }
  }

  // 获取任务基本信息 存储用
  getBaseInfor() {
    let { id, users, name } = this
    return {id, users, name }
  }
}

// 判断下载任务是否完成
const judeProgress = (task) => {
  // 本地任务处于移动或完成状态，跳过
  if (task.state.name !== 'downloading') return false
  // 完成条件1 任务标记为完成
  let conditionA = task.isFinished
  // 完成条件2 任务进入了seed状态
  let conditionB = [5, 6].includes(task.status)
  // 完成条件3 任务处于暂停状态、完成度为100%
  let conditionC = task.status == 0 && task.percentDone == 1
  // 进行移动等操作
  if (conditionA || conditionB || conditionC) return true
  else return false
}

const getName = (dirPath, fileName) => {
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
        // console.log('file exist rename', index)
        index++
        return isFIleExist()
      }
    } catch (e) { console.log(e) }
  }
  return isFIleExist()
}

const copy = (src, name, user, callback) => {
  let fruitmix = getFruit() // 获取fruitmix实例
  let uuid = user.userUUID // 用户uuid
  let userObj = { uuid } // 构造user对象用于查询
  let drive = fruitmix.getDrives(userObj).find(item => item.tag == 'home') // 获取用户home对象
  let dirUUID = user.dirUUID // 目标文件夹uuid
  let targetDirPath = fruitmix.getDriveDirPath(userObj, drive.uuid, dirUUID)
  let targetPath = getName(targetDirPath, name)  // 检查目标路径是否有相同文件名并重命名
  console.log('文件临时目录: ', src)
  console.log('文件目标目录: ', targetPath)
  execSync('sync')
  clone(src, targetPath, err => {
    fruitmix.driveList.getDriveDir(drive.uuid, this.dirUUID)
    user.finishTime = (new Date()).getTime()
    callback(null)
  })
}

module.exports = Task
