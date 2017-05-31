let fs = require('fs')
let child = require('child_process')

import Debug from 'debug'
const SAMBA = Debug('SAMBA:SAMBA')

let createUdpServer = require('./udpServer')
let updateSambaFilesAsync = require('./updateSamba')
let { startWatchAsync } = require('./watcher')

Promise.promisifyAll(fs)
Promise.promisifyAll(child)

let path = require('path')
let process = require('process')

const initSambaAsync = async () => {
  const logConfigPath = '/etc/rsyslog.d/99-smbaudit.conf'
  const logConfig = 'LOCAL7.*    @127.0.0.1:3721'

  // update rsyslog config if necessary
  let config = await fs.readFileAsync(logConfigPath)

  if (config !== logConfig) {
    await fs.writeFileAsync(logConfigPath, logConfig)  
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
