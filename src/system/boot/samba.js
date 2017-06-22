const Promise = require('bluebird')

const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')

const EventEmitter = require('events').EventEmitter
let { sambaAudit } = require('./fruitmix')

const Debug = require('debug')
const BOOT_SAMBA = Debug('SAMBA:BOOT_SAMBA')

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

  let froot = path.join(cfs.mountpoint, 'wisnuc', 'fruitmix/drives')
  let modpath = path.resolve(__dirname, '../../samba/samba')

	BOOT_SAMBA(`Forking samba, waiting for 10s before start`)

  return new Samba(child.fork(modpath, ['--path', froot], { 
		env: Object.assign({}, process.env, { FORK: 1 }),
		stdio: ['ignore', 1, 2, 'ipc'] // this looks weird, but must be in this format, see node doc
	}))
}

module.exports = {
  fork
}
