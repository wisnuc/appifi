const path = require('path')
const fs = require('fs')
const child = require('child_process')
const UUID = require('uuid')
const mkdirp = require('mkdirp')
const Promise = require('bluebird')
const getFruit = require('../fruitmix')
const broadcast = require('../common/broadcast')

var torrentTmpPath = ''
var ipc = null 


// 初始化torrent服务
broadcast.on('FruitmixStarted', () => {
  if (process.env.hasOwnProperty('NODE_PATH')) {
    // console.log('bypass webtorrent in auto test')
    return
  }
  // 尝试创建下载临时目录
  torrentTmpPath = path.join(getFruit().fruitmixPath, 'torrentTmp')
  mkdirp.sync(torrentTmpPath)
  // 检查switch开关，创建进程
  let switchPath = path.join(torrentTmpPath, 'switch')
  if (fs.existsSync(switchPath) && !ipc) createIpcMain()
})

// this module implements a command pattern over ipc

/**
 * job :{
 *  id,
 *  op,
 *  args,
 *  timestamp,
 *  callback
 * }
 */
const jobs = []

// 封装子进程调用命令
class Job {

  constructor(op, args, callback) {
    this.id = UUID.v4()
    this.op = op
    this.args = args
    this.callback = callback
    this.timestamp = new Date().getTime()
  }

  message() {
    return {
      type: 'command',
      id: this.id,
      op: this.op,
      args: this.args
    }
  }
}

// 子进程命令容器
class IpcMain {

  constructor(worker) {
    this.jobs = []
    this.worker = worker
  }

  // 创建命令实例
  createJob(op, args, callback) {
    let job = new Job(op, args, callback)
    jobs.push(job)
    return job
  }

  // 创建调用命令
  call(op, args, callback) {

    let job
    try {
      job = this.createJob(op, args, callback)
    }
    catch (e) {
      process.nextTick(() => callback(e))
      return
    }
    this.worker.send(job.message())
  }
  
  async callAsync(op, args) {
    return Promise.promisify(this.call).bind(this)(op, args)
  }  

  // 处理调用返回结果
  handleCommandMessage(msg) {

    let { id, data, err } = msg
    let index = jobs.findIndex(job => job.id === id)

    if (index !== -1) {
      let job = jobs[index]  
      jobs.splice(index, 1)
      job.callback(err ? err : null, data)
    }
    else {
      console.log('job not found' + msg)
    }
  }
  
  // 销毁子进程
  destroy() {
    this.worker.kill()
  }
}

// 创建进程
const createIpcMain = () => {
  // 检查
  if (ipc) return console.log('warning: ipc is exist')
  if (!ipc && !torrentTmpPath) return console.log('can not create ipcmain')
  // 创建进程同时打开开关
  let switchPath = path.join(torrentTmpPath, 'switch')
  fs.writeFileSync(switchPath, 'switch')
  // 创建子进程 argv : [torrentTmpPath]
  let worker = child.fork(path.join(__dirname, 'webtorrent.js'), [torrentTmpPath])
  worker.on('error', err => console.log('sub process error : ', err))
  worker.on('exit', (code, signal) => console.log('sub process exit:', code, signal))
  // 处理子进程消息，此处只处理移动文件操作
  worker.on('message', async msg => {
    if (msg.type !== 'move') return
    let fruitmix = getFruit()
    let user = { uuid: msg.torrent.userUUID } // 创建用户对象
    let drive = fruitmix.getDrives(user).find(item => item.tag == 'home') // 查找drive对象
    let dirUUID = msg.torrent.dirUUID // 目标目录UUID
    let dirPath = fruitmix.getDriveDirPath(user, drive.uuid, dirUUID) // 目标目录路径
    let torrentPath // 下载资源临时路径
    if (msg.torrent.type == 'http') {
      torrentPath = path.join(msg.torrent.path, msg.torrent.infoHash)
    }else {
      torrentPath = path.join(msg.torrent.path, msg.torrent.name)
    }
    // 检查、修改重复文件名
    let rename = await getName(dirPath, msg.torrent.name)
    fs.rename(torrentPath, rename, err => {
      if (err) return console.log(err) //todo
      // 刷新目录内容
      fruitmix.driveList.getDriveDir(drive.uuid, dirUUID)
      // 通知子进程移动完成
      ipc.call('moveFinish', {userUUID: msg.torrent.userUUID, torrentId: msg.torrent.infoHash},(err,data) => {console.log(err, data, 'this is end')})
    })
  })

  // 检查目标文件名，如果重复进行重命名
  const getName = (dirPath, fileName) => {
    return new Promise((resolve,reject) => {
      let newName, index = 0
      let isFIleExist = () => {
        try {
          // exist bug !! todo
          newName = path.join(dirPath, fileName + (index==0?'':'(' + (index + 1) + ')'))
          let exist = fs.existsSync(newName)
          if (!exist) resolve(newName)
          else {
            console.log('file exist rename', index)
            index++
            isFIleExist()
          }
        }catch(e) {console.log(e)}
      }
      isFIleExist()
    })
  }

  // 创建子进程操作
  ipc = new IpcMain(worker)

  // 处理子进程返回的操作结果
  worker.on('message', msg => {
    switch(msg.type) {
      case 'command':
      ipc.handleCommandMessage(msg)
        break
      default:
        break
    }
  })
}

// 关闭子进程
const destroyIpcMain = () => {
  // 关闭下载服务同时关闭开关
  let switchPath = path.join(torrentTmpPath, 'switch')
  fs.unlinkSync(switchPath)
  if (!ipc) return console.log('warning: ipc is not exist')
  ipc.destroy()
  ipc = null
}

// 获取子进程
const getIpcMain = () => ipc

module.exports = { createIpcMain, getIpcMain, destroyIpcMain }
