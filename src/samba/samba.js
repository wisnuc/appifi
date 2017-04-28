let fs = require('fs')
let child = require('child_process')

// let getPrependPath = require('./prependPath')
let createUdpServer = require('./udpServer')
let updateSambaFilesAsync = require('./updateSamba')
let { startWatchAsync } = require('./watcher')

let getPrependPath = require('./prependPath')

Promise.promisifyAll(fs)
Promise.promisifyAll(child)

//const userListConfigPath = '../../test/samba/model.json'

let path = require('path')
let process = require('process')

// let cwd = process.cwd()
// const userListConfigPath = path.join(getPrependPath(), '..', '/fruitmix/models/model.json')
// if(!fs.existsSync(userListConfigPath)) {
//   throw Error('No Model.json Found!')
// }

let debounceTime = 5000 // millisecond

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
}

// main process for samba service
const runSambaAsync = async () => {
  // getPrependPath()
  await initSambaAsync()
  await updateSambaFilesAsync()
  let watchMan = await startWatchAsync()
  let smbAuditEntity = await Promise.promisify(createUdpServer)()
}

runSambaAsync().then(() => {
  console.log('Samba Watcher is running!')
}, (error) => {
  console.log(error)
})
