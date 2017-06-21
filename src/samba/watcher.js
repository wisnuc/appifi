let fs = require('fs')
let path = require('path')
let process = require('process')

let SambaManager = require('./sambaManager')
let getPrependPath = require('./prependPath')

import Debug from 'debug'
const WATCHER = Debug('SAMBA:WATCHER')

let DEBOUNCE_TIME = require('./config').DEBOUNCE_TIME

Promise.promisifyAll(fs)

const startWatchAsync = async () => {
  let handler = new SambaManager(DEBOUNCE_TIME)

  const userListConfigPath = path.join(getPrependPath(), '..', '/models/model.json')
  if(!fs.existsSync(userListConfigPath)) {
    WATCHER('Wrong path: ' + userListConfigPath)
    throw Error('No Model.json Found!')
  }

  let watcher = fs.watch(userListConfigPath, (eventType) => {
    if (eventType === 'change') {
        handler.resetSamba(path.basename(userListConfigPath) + ' has changed!')
      }    
  })

  WATCHER('Start watcher')

  return watcher
}

const endWatchAsync = async (watcher) => {

  WATCHER('Stop watch')

  watcher.close()
}

module.exports = { startWatchAsync, endWatchAsync }
