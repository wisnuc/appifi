import UUID from 'node-uuid'

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

class IpcWorker {

  constructor() {
    this.jobs = []
  }

  createJob(op, args, callback) {
    let job = new Job(op, args, callback)
    jobs.push(job)
    return job
  }

  call(op, args, callback) {

    let job
    try {
      job = this.createJob(op, args, callback)
    }
    catch (e) {
      process.nextTick(() => callback(e))
      return
    }

    process.send(job.message())
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

const createIpcWorker = () => {

  let ipc = new IpcWorker()

  process.on('message', msg => {

    console.log('ipcworker, msg', msg)

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

export default createIpcWorker
