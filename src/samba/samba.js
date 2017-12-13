/*
let fs = require('fs')
let child = require('child_process')

import Debug from 'debug'
const SAMBA = Debug('SAMBA:SAMBA')

let createUdpServer = require('./udpServer')
let updateSambaFilesAsync = require('./updateSamba')
let { startWatchAsync } = require('./watcher')

const LOG_CONFIG_PATH = require('./config').LOG_CONFIG_PATH
const LOG_CONFIG = require('./config').LOG_CONFIG

Promise.promisifyAll(fs)
Promise.promisifyAll(child)

let path = require('path')
let process = require('process')

const initSambaAsync = async () => {

  // update rsyslog config if necessary
  let config = await fs.readFileAsync(LOG_CONFIG_PATH)

  if (config !== LOG_CONFIG) {
    await fs.writeFileAsync(LOG_CONFIG_PATH, LOG_CONFIG)  
    await child.execAsync('systemctl restart rsyslog')
  }

  await child.execAsync('systemctl start nmbd')
  await child.execAsync('systemctl start smbd')

  SAMBA('Init samba')
}

// main process for samba service
const runSambaAsync = async () => {
  await initSambaAsync()
  await updateSambaFilesAsync()
  let watchMan = await startWatchAsync()
  let smbAuditEntity = await Promise.promisify(createUdpServer)()

  SAMBA('Run samba')
}

runSambaAsync().then(() => {
  SAMBA('Samba Watcher is running!')
}, (error) => {
  SAMBA(error)
})
*/

const events = require('events')

class SambaServer extends events.EventEmitter {
  constructor() {
    super()
    this.froot = undefined
  }

  start(fpath, callpack) {
    this.froot = fpath
  }

  async startAsync(fpath) {

  }

  stop(callpack) {

  }

  async stopAsync() {

  }

  restart(callpack) {

  }

  async restartAsync() {

  }

  update(users, drives) {

  }

  destory() {

  }
}

