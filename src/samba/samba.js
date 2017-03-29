let fs = require('fs')
let child = require('child_process')

let getPrependPath = require('./prependPath')
let createUdpServer = require('./udpServer')
let SmbAudit = require('./sambaAudit')
let SambaManager = require('./sambaManager')
let updateSambaFilesAsync = require('./updateSamba')

Promise.promisifyAll(fs)
Promise.promisifyAll(child)

const userListConfigPath = '../../test/appifi/lib/samba/model.json'
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

const beginWatchAsync = async () => {
  let handler = new SambaManager(debounceTime)
  let watcher = fs.watch(userListConfigPath, (eventType) => {
    if (eventType === 'change') {
        handler.resetSamba('Just for testing!')
      }    
  })

  return watcher
}

const endWatch = async (watcher) => {
  watcher.close()
}

// main process for samba service
const watchSambaAsync = async () => {
  getPrependPath()
  await initSambaAsync()
  await updateSambaFilesAsync()
  let watchMan = await beginWatchAsync()
  let udp = await Promise.promisify(createUdpServer)()

  return new SmbAudit(udp)
}

watchSambaAsync().then(() => {
  console.log('Samba Watcher is running!')
}, (error) => {
  console.log(error)
})