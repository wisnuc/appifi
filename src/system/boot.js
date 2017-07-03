const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
const debug = require('debug')('system:boot')

const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirpAsync = Promise.promisify(mkdirp)

const router = require('express').Router()

const broadcast = require('../common/broadcast')

const Config = require('./config')
const Storage = require('./storage')

let config = null
let storage = null
let state = 'starting'
let currentFileSystem = null
let error = null

const init = () => {

  broadcast.on('ConfigUpdate', (err, data) => {
    if (config === null && storage !== null) process.nextTick(() => boot())
    config = data
  })

  broadcast.on('StorageUpdate', (err, data) => {
    if (storage === null && config !== null) process.nextTick(() => boot())
    storage = data
  })
}

const boot = () => {

  let volumes = storage.volumes
  let last = config.lastFileSystem
  let v

  if (last && (v = volumes.find(v => v.fileSystemUUID === last.uuid))) {
    if (!v.isMounted) {
      // last file system found but not mounted
      currentFileSysten = null
      error = 'ELASTMOUNT'
    }
    else if (v.isMissing) {
      // last file system found but has missing devices
      currentFileSystem = null
      error = 'ELASTMISSING'
    } 
    else if (!Array.isArray(v.users)) {
      // last file system user file damaged
      currentFileSystem = null
      error = 'ELASTDAMAGED' 
    }
    else {
      let { fileSystemType: type, fileSystemUUID: uuid, mountpoint } = v
      currentFileSystem = { type, uuid, mountpoint }
      error = null
    }
  } else { // either last not found or last not bootable
    if (volumes.length === 1 
      && volumes[0].isMounted
      && !volumes[0].isMissing
      && Array.isArray(volumes[0].users)) {

      let { fileSystemType: type, fileSystemUUID: uuid, mountpoint } = volumes[0]
      currentFileSystem = { type, uuid, mountpoint }
      error = null
    }
    else {
      state = 'started'
      currentFileSystem = null
      error = 'EALT'
    }
  }
 
  broadcast.emit('FileSystemUpdate', error, currentFileSystem)
}

init()

router.get('/', (req, res) => {

  let mode = config.bootMode
  let last = config.lastFileSystem
  let current = currentFileSystem === null
    ? null
    : {
        type: currentFileSystem.type,
        uuid: currentFileSystem.uuid
      }

  res.status(200).json({ mode, last, state, current, error })
})

/**
see apib document
*/
router.patch('/', (req, res) => {

  let arg = req.body

  const err = (code, message) => res.status(code).json({ message })

  if (arg.hasOwnProperty('current')) {
    if (arg.hasOwnProperty('state')) 
      return err(400, 'curent and state cannot be patched simultaneously')
    if (arg.hasOwnProperty('mode')) 
      return err(400, 'current and mode cannot be patched simultaneously')
    if (currentFileSystem !== null) 
      return err(400, 'current file system is already set') 
    
    let v = storage.volumes.find(v => v.uuid === arg.current.uuid)
    if (!v) return err(400, 'volume not found')
    if (!v.isMounted) return err(400, 'volume is not mounted')
    if (v.isMissing) return err(400, 'volume has missing devices')
    if (!Array.isArray(v.users) && v.users !== 'ENOENT') 
      return err(400, 'only volumes without fruitmix or with users can be used')

    let { fileSystemType: type, fileSystemUUID: uuid, mountpoint } = v
    currentFileSystem = { type, uuid, mountpoint }
    error = null
    broadcast.emit('FileSystemUpdate', error, currentFileSystem)
    
    res.status(200).end()
  }
  else if (arg.hasOwnProperty('state')) {
    if (arg.state !== 'poweroff' && arg.state !== 'reboot')
      return err(400, 'invalid state')

    if (arg.mode === 'maintenance') {
      // TODO
    }     

    (async () => {
      try {
        if (barcelona) await child.execAsync('echo "PWR_LED 3" > /proc/BOARD_io')
      }
      finally {
      }

      await Promise.delay(3000)
      await child.execAsync(arg.state)
    })()
      .then(() => res.status(200).end())
      .catch(e => res.status(500).json({ code: e.code, message: e.message }))
  }
  else {
    err(400, 'either current or state must be provided')
  }
})

module.exports = router

