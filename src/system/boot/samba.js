const Promise = require('bluebird')

const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')

const EventEmitter = require('events').EventEmitter
let { sambaAudit } = require('./fruitmix')

const debug = require('debug')('samba')

class Samba extends EventEmitter {

  constructor(child) {
    super()

    this.child = child
    this.state = 'starting'

    this.child.on('error', err => {
      this.error = err
    })

    this.child.on('message', message => {
      sambaAudit.emit('sambaAudit', message)
    })

    this.child.on('exit', (code, signal) => {
      this.state = 'exited'
      this.code = code
      this.signal = signal
    })

    this.callback = null
  }

  getState() {

    let obj = { state: this.state }
    
    if (this.error)
      obj.error = {
        code: this.error.code,
        message: this.error.message
      }

    if (this.state === 'exited')
      obj.exit = {
        code: this.code,
        signal: this.signal
      }

    return obj
  }
}

const fork = cfs => {

  let froot = path.join(cfs.mountpoint, 'wisnuc', 'samba')
  let modpath = path.resolve(__dirname, '../../samba/samba')

	console.log(`Forking samba, waiting for 120s before timeout`)

  return new Samba(child.fork(modpath, ['--path', froot], { 
		env: Object.assign({}, process.env, { FORK: 1 }),
		stdio: ['ignore', 1, 2, 'ipc'] 		// this looks weird, but must be in this format, see node doc
	}))
}

// const fork = (cfs, init, callback) => {

//   let froot = path.join(cfs.mountpoint, 'wisnuc', 'samba')
//   let modpath = path.resolve(__dirname, '../../samba/samba')

//   console.log(`forking samba, waiting for 120s before timeout`)

//   let finished = false
//   let samba = child.fork(modpath, ['--path', froot], {
//     env: Object.assign({}, process.env, { FORK: 1 }),
//     stdio: ['ignore', 1, 2, 'ipc']  // this looks weird, but must be in this format, see node doc
//   })

//   if(samba && samba !== undefined && samba !== null) {
//     finished = true
//   }

//   samba.on('error', err => {

//     console.log('[BOOT] samba error: ', err)

//     samba.kill()
//     finished = true
//     callback(err)
//   })

//   samba.on('message', message => {

//     sambaAudit.emit('sambaAudit', message)

//     callback(null, samba)
//   })

//   samba.on('close', (code, signal) => {

//     console.log(`[BOOT] samba closed. code: ${code}, signal: ${signal}`)

//     finished = true
//     callback(new Error(`unexpected exit with code ${code} and signal ${signal}`))
//   })

//   setTimeout(() => {

//     if (finished === true) return

//     console.log(`[BOOT] failed to start samba in 120s`)

//     samba.kill()
//     finished = true
//     callback(new Error('fork samba timeout'))
//   }, 120000)

//   callback(null, samba)
// }

module.exports = {
  fork
}
