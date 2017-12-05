const UUID = require('uuid')

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
}

const createIpcMain = (worker) => {

  let ipc = new IpcMain(worker)

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

  return ipc
}

module.exports = createIpcMain
