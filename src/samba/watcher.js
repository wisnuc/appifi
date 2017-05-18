let fs = require('fs')
let path = require('path')

let SambaManager = require('./sambaManager')

Promise.promisifyAll(fs)

const userListConfigPath = '../../test/samba/model.json'
let debounceTime = 5000 // millisecond

const startWatchAsync = async () => {
  let handler = new SambaManager(debounceTime)
  let watcher = fs.watch(userListConfigPath, (eventType) => {
    if (eventType === 'change') {
        handler.resetSamba(path.basename(userListConfigPath) + ' has changed!')
      }    
  })

  return watcher
}

const endWatchAsync = async (watcher) => {
  watcher.close()
}

module.exports = { startWatchAsync, endWatchAsync }