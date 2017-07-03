const Promise = require('bluebird')
const child = Promise.promisifyAll(require('child_process'))
// const debug = require('debug')('system:boot')

const router = require('express').Router()

const broadcast = require('../common/broadcast')
const barcelona = require('./barcelona')

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
  broadcast.on('ConfigUpdate', (err, config) => {
    if (err) return
    if (mode === config.bootMode && last === config.lastFileSystem) return
    if (mode === undefined && storage !== undefined) process.nextTick(() => boot())
    mode = config.bootMode
    last = config.lastFileSystem
  })

  broadcast.on('StorageUpdate', (err, _storage) => {
    if (err) return
    if (storage === _storage) return
    if (storage === undefined && mode !== undefined) process.nextTick(() => boot())
    storage = _storage
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
      // last file system found but not mounted
      current = null
      error = 'ELASTMOUNT'
    } else if (v.isMissing) {
      // last file system found but has missing devices
      current = null
      error = 'ELASTMISSING'
    } else if (!Array.isArray(v.users)) {
      // last file system user file damaged
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
      state = 'started'
      current = null
      error = 'ENOALT'
    }
  }

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
    if (arg.hasOwnProperty('state')) { return err(400, 'curent and state cannot be patched simultaneously') }
    if (arg.hasOwnProperty('mode')) { return err(400, 'current and mode cannot be patched simultaneously') }
    if (current !== null) { return err(400, 'current file system is already set') }

    let v = storage.volumes.find(v => v.uuid === arg.current.uuid)
    if (!v) return err(400, 'volume not found')
    if (!v.isMounted) return err(400, 'volume is not mounted')
    if (v.isMissing) return err(400, 'volume has missing devices')
    if (!Array.isArray(v.users) && v.users !== 'ENOENT') { return err(400, 'only volumes without fruitmix or with users can be used') }

    let { fileSystemType: type, fileSystemUUID: uuid, mountpoint } = v
    current = { type, uuid, mountpoint }
    error = null
    broadcast.emit('FileSystemUpdate', error, current)

    res.status(200).end()
  } else if (arg.hasOwnProperty('state')) {
    if (arg.state !== 'poweroff' && arg.state !== 'reboot') { return err(400, 'invalid state') }

    if (arg.mode === 'maintenance') {
      // TODO
    }

    (async () => {
      try {
        if (barcelona.isBarcelona) await child.execAsync('echo "PWR_LED 3" > /proc/BOARD_io')
      } finally {
      }

      await Promise.delay(3000)
      await child.execAsync(arg.state)
    })()
      .then(() => res.status(200).end())
      .catch(e => res.status(500).json({ code: e.code, message: e.message }))
  } else {
    err(400, 'either current or state must be provided')
  }
})

module.exports = router
