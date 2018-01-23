const path = require('path')
const child = require('child_process')
const UUID = require('uuid')
const mkdirp = require('mkdirp')
const getFruit = require('../fruitmix')
const broadcast = require('../common/broadcast')
const fs = require('fs')
const Promise = require('bluebird')


var torrentTmpPath = ''
var ipc = null 


// init torrent after fruitmix started
broadcast.on('FruitmixStarted', () => {
  // create torrentTmp if it has not been created
  if (process.env.hasOwnProperty('NODE_PATH')) {
    // console.log('bypass webtorrent in auto test')
    return
  }
  torrentTmpPath = path.join(getFruit().fruitmixPath, 'torrentTmp')
  mkdirp.sync(torrentTmpPath)
  // if switch is not exist , webtorrent will not start
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

class IpcMain {

  constructor(worker) {
    this.jobs = []
    this.worker = worker
  }

  createJob(op, args, callback) {
    let job = new Job(op, args, callback)
    jobs.push(job)
    return job
  }

  call(op, args, callback) {

    // change to debug TODO
    // console.log('ipc call', op, args)

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

  destroy() {
    this.worker.kill()
  }
}

const createIpcMain = () => {
  // create webtorrent mean open switch
  let switchPath = path.join(torrentTmpPath, 'switch')
  fs.writeFileSync(switchPath, 'switch')
  if (ipc) return console.log('warning: ipc is exist')
  if (!ipc && !torrentTmpPath) return console.log('can not create ipcmain')
  // fork child process
  let worker = child.fork(path.join(__dirname, 'webtorrent.js'), [torrentTmpPath])
  worker.on('error', err => console.log('sub process error : ', err))
  worker.on('exit', (code, signal) => console.log('sub process exit:', code, signal))
  worker.on('message', async msg => {
    if (msg.type !== 'move') return
    let fruitmix = getFruit()
    let user = {uuid: msg.torrent.userUUID}
    let drive = fruitmix.getDrives(user).find(item => item.tag == 'home')
    let dirUUID = msg.torrent.dirUUID
    let dirPath = fruitmix.getDriveDirPath(user, drive.uuid, dirUUID)
    console.log('dir path is ' + dirPath)
    let torrentPath
    if (msg.torrent.type == 'http') {
      torrentPath = path.join(msg.torrent.path, msg.torrent.infoHash)
    }else {
      torrentPath = path.join(msg.torrent.path, msg.torrent.name)
    }
    let rename = await getName(dirPath, msg.torrent.name)
    console.log('new name is ', rename)
    fs.rename(torrentPath, rename, err => {
      if (err) return console.log(err) //todo
      fruitmix.driveList.getDriveDir(drive.uuid, dirUUID)
      ipc.call('moveFinish', {userUUID: msg.torrent.userUUID, torrentId: msg.torrent.infoHash},(err,data) => {console.log(err, data, 'this is end')})
    })
  })

  const getName = (dirPath, fileName) => {
    return new Promise((resolve,reject) => {
      let newName, index = 0
      let isFIleExist = () => {
        try {
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
  // create ipc main
  ipc = new IpcMain(worker)

  worker.on('message', msg => {
    // console.log('worker --> ', msg)
    // console.log('ipcworker, msg', msg)

    switch(msg.type) {
      case 'command':
      ipc.handleCommandMessage(msg)
        break
      default:
        break
    }
  })
}

const destroyIpcMain = () => {
  console.log('destroy ipcmain...')
  // destroy webtorrent mean close switch
  let switchPath = path.join(torrentTmpPath, 'switch')
  fs.unlinkSync(switchPath)
  if (!ipc) return console.log('warning: ipc is not exist')
  ipc.destroy()
  ipc = null
}

const getIpcMain = () => ipc



module.exports = { createIpcMain, getIpcMain, destroyIpcMain }
