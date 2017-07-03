const Promise = require('bluebird')
const child = Promise.promisifyAll(require('child_process'))
// const debug = require('debug')('system:boot')

const router = require('express').Router()

const { isUUID } = require('../common/assertion')
const broadcast = require('../common/broadcast')

/**

@module Boot
*/

/**
Copy of config.lastFileSystem
@type {string} - file system uuid
*/
let last

/**
Copy of config.bootMode
@type {string} - 'normal' or 'maintenance'
*/
let mode

/**
Copy of storage
@type {module:Storage~Storage} - see Storage module
*/
let storage

/**
This is boot module state, not apps state.
@type {string} - `starting`, `started`, `stopping`.
*/
let state = 'starting'

/**
File system uuid of currently used file system.
@type {string} - file system uuid
*/
let current = null

/**
Error code when current is null
@type {string} - error code if `current` is null
*/
let error = null

/**
Module init. Hook listeners to `ConfigUpdate` and `StorageUpdate` events.
@listens ConfigUpdate
@listens StorageUpdate
*/
const init = () => {
  const readyToBoot = () =>
    mode !== undefined && last !== undefined && storage !== undefined

  broadcast.on('ConfigUpdate', (err, config) => {
    if (err) return
    if (config.bootMode !== 'normal' && config.bootMode !== 'maintenance') {
      process.nextTick(() => broadcast.emit('BootModeUpdate', null, 'normal'))
      return
    }
    if (config.lastFileSystem !== null && !isUUID(config.lastFileSystem)) {
      process.nextTick(() => broadcast.emit('FileSystemUpdate', null, null))
      return
    }
    mode = config.bootMode
    last = config.lastFileSystem
    if (state === 'starting' && readyToBoot()) boot()
  })

  broadcast.on('StorageUpdate', (err, _storage) => {
    if (err) return
    if (storage === _storage) return
    storage = _storage
    if (state === 'starting' && readyToBoot()) boot()
  })
}

/**
Boot the system
@fires FileSystemUpdate
*/
const boot = () => {
  let volumes = storage.volumes
  let v

  if (last && (v = volumes.find(v => v.fileSystemUUID === last.uuid))) {
    if (!v.isMounted) {
      current = null
      error = 'ELASTNOTMOUNT'
    } else if (v.isMissing) {
      current = null
      error = 'ELASTMISSING'
    } else if (!Array.isArray(v.users)) {
      current = null
      error = 'ELASTDAMAGED'
    } else {
      current = v.fileSystemUUID
      error = null
    }
  } else { // either last not found or last not bootable
    if (volumes.length === 1 &&
      volumes[0].isMounted &&
      !volumes[0].isMissing &&
      Array.isArray(volumes[0].users)) {
      current = volumes[0].fileSystemUUID
      error = null
    } else {
      current = null
      error = 'ENOALT'
    }
  }

  state = 'started'
  broadcast.emit('FileSystemUpdate', error, current)
}

init()

/**
see apib document
*/
router.get('/', (req, res) =>
  res.status(200).json({ mode, last, state, current, error }))

/**
see apib document
*/
router.patch('/', (req, res) => {
  let arg = req.body

  const err = (code, message) => res.status(code).json({ message })

  if (arg.hasOwnProperty('current')) {
    if (arg.hasOwnProperty('state')) return err(400, 'curent and state cannot be patched simultaneously')
    if (arg.hasOwnProperty('mode')) return err(400, 'current and mode cannot be patched simultaneously')
    if (current !== null) return err(400, 'current file system is already set')

    let v = storage.volumes.find(v => v.uuid === arg.current.uuid)
    if (!v) return err(400, 'volume not found')
    if (!v.isMounted) return err(400, 'volume is not mounted')
    if (v.isMissing) return err(400, 'volume has missing devices')
    if (!Array.isArray(v.users) && v.users !== 'ENOENT') return err(400, 'only volumes without fruitmix or with users can be used')

    current = v.fileSystemUUID
    error = null

    if (mode === 'maintenance') broadcast.emit('BootModeUpdate', null, 'normal')
    broadcast.emit('FileSystemUpdate', null, current)

    res.status(200).end()
  } else if (arg.hasOwnProperty('state')) {
    if (arg.state !== 'poweroff' && arg.state !== 'reboot') return err(400, 'invalid state')
    if (arg.state === 'reboot' && arg.mode === 'maintenance') broadcast.emit('BootModeUpdate', null, 'maintenance')

    broadcast.emit('SystemShutdown')
    setTimeout(() => child.exec(arg.state), 4000)
    res.status(200).end()
  } else {
    err(400, 'either current or state must be provided')
  }
})

module.exports = router
