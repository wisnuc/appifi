let fs = require('fs')
let path = require('path')
let process = require('process')

let SambaManager = require('./sambaManager')
let getPrependPath = require('./prependPath')

let DEBOUNCE_TIME = require('./config').DEBOUNCE_TIME

Promise.promisifyAll(fs)

// let debounceTime = 5000 // millisecond

const startWatchAsync = async () => {
  let handler = new SambaManager(DEBOUNCE_TIME)

  const userListConfigPath = path.join(getPrependPath(), '..', '/fruitmix/models/model.json')
  if(!fs.existsSync(userListConfigPath)) {
    console.log(userListConfigPath)
    throw Error('No Model.json Found!')
  }

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
