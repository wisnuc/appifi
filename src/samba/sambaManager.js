let fs = require('fs')
let child = require('child_process')

let getPrependPath = require('./prependPath')
let createUdpServer = require('./udpServer')
let SmbAudit = require('./sambaAudit')
let Persistence = require('./persistence')
let updateSambaFilesAsync = require('./updateSamba')

Promise.promisifyAll(fs)
Promise.promisifyAll(child)

const userListConfigPath = '../../test/appifi/lib/samba/model.json'
let debounceTime = 5000; // millisecond

const initSambaAsync = async () => {
  const logConfigPath = '/etc/rsyslog.d/99-smbaudit.conf'
  const logConfig = 'LOCAL7.*    @127.0.0.1:3721'

  // update rsyslog config if necessary
  let config = null
  try { config = await fs.readFileAsync(logConfigPath) } catch (e) {console.log('initSamba: Not find Samba service')}
  if (config !== logConfig) {
    await fs.writeFileAsync(logConfigPath, logConfig)  
    await child.execAsync('systemctl restart rsyslog')
  }

  await child.execAsync('systemctl start nmbd')
  await child.execAsync('systemctl start smbd')
}

const beginWatchAsync = async () => {
  let result = new Persistence(debounceTime)
  let watcher = fs.watch(userListConfigPath, (eventType) => {
    if (eventType === 'change') {
        result.resetSamba('Only for test!!!')
      }    
  })

  return watcher
}

const endWatch = async (watcher) => {
  watcher.close()
}

// main process for samba service
const watchSambaAsync = async () => {
  try {
    getPrependPath()
    await initSambaAsync()
    await updateSambaFilesAsync()
    let watchMan = await beginWatchAsync()
    let udp = await Promise.promisify(createUdpServer)()

    return new SmbAudit(udp)
  }
  catch(error) {
    console.log(error)
    throw new Error('watch samba async error!')
  }
}

watchSambaAsync().then(() => {
  console.log('"WatchSamba" service is running!');
}, (error) => {console.log(error)});