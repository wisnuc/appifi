const Promise = require('bluebird')
const path = require('path')
const child = Promise.promisifyAll(require('child_process'))
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

// const debug = require('debug')('system:boot')

const router = require('express').Router()

const { isUUID } = require('../common/assertion')
const broadcast = require('../common/broadcast')
const prerequisite = require('../prerequisite')

/**
`boot` module is responsible for boot logic.

The internal state of `boot` module incl 5 variables. All of them are exposed to clients via restful API.

```
boot {
  mode,     // boot mode
  last,     // file system (uuid)
  state,    // boot module state
  current,  // file system (uuid)
  error,    // boot error
}
```

`mode` is a user configuration rather than a run-time state.

There are two modes defined to boot the system.

+ In `normal` mode, boot module tries to select a file system and to bring up all applications automatically.
+ In `maintenance` mode, boot module won't bring up any application. User can select this mode to fulfill jobs related to disk or file system management.

`last` is a read-only configuration. Each time a file system is selected to bring up applications, the file system is saved to `last` configuration.

`state` is the state of boot module (not the state of applications). It can be `starting`, `started`, `stopping`.

`current` is the currently selected file system used by applications. `error` records an error code when `boot` module fails to set `current`. `error` and `current` are used like `err` and `data` in a node callback.

It is possible that both of them are `null`, when:
+ the system boots into `maintenance` mode by the user,
+ applications are stopped by the user but the system is not shutdown. (not supported yet)

#### Boot Logic

+ If `mode` is `maintenance`, boot module stops, waiting for user requests.
+ If `mode` is `normal`, boot module tries to find the `last` file system.
  + If `last` is found and is OK, it is used as current file system.
  + If `last` is found but not OK, `error` is set.
  + If `last` is not found
    + If there is exactly one btrfs volume and it is OK with fruitmix installed, it is used as current file systme.
    + Otherwise, `error` is set.

#### Restful APIs

`state` or `current` can be updated via http patch.

Updating state to `poweroff` or `reboot` would shutdown or reboot the system, respectively.

When `state` is `reboot`, `mode` can be `normal` or `maintenance` as an option (reboot to normal / maintenance mode)

When `current` is null, it can be set to a btrfs file system uuid. This is the `run` operation.

The file system must either have a good fruitmix installation (`users` is an array) or have no fruitmix at all (`users` is `ENOENT`)

@module Boot
*/

/**
Fired when boot mode changed by the user

@event BootModeUpdate
@global
*/

/**
Fired when currently used file system changed, either by init boot, or by user

@event FileSystemUpdate
@global
*/

/**
Fired when user tries to shutdown the system.

@event SystemShutdown
@global
*/

/**
Copy of config.bootMode
@type {string}
*/
let mode

/**
Copy of config.lastFileSystem
@type {string}
*/
let last

/**
Copy of storage
@type {module:Storage~Storage}
*/
let storage

/**
This is boot module state, not apps state.
@type {string}
*/
let state = 'starting'

/**
File system uuid of currently used file system.
@type {string}
*/
let current = null

/**
Error code when current is null
@type {string}
*/
let error = null

/**
Module init. Hook listeners to `ConfigUpdate` and `StorageUpdate` events.
@listens ConfigUpdate
@listens StorageUpdate
*/
const init = () => {
  const readyToBoot = () =>
    prerequisite.error === null && 
    mode !== undefined && 
    last !== undefined && 
    storage !== undefined

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

  let v
  if (mode === 'maintenance') {
    current = null
    error = null
  } else {
    let volumes = storage.volumes

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

      let vols = volumes.filter(x => x.mountpoint !== '/')

      if (vols.length === 1 &&
        vols[0].isMounted &&
        !vols[0].isMissing &&
        Array.isArray(vols[0].users)) {
        v = vols[0]
        current = v.fileSystemUUID
        error = null
      } else {
        current = null
        error = 'ENOALT'
      }
    }
    broadcast.emit('FileSystemUpdate', error, current)
    if (current) broadcast.emit('FruitmixStart', path.join(v.mountpoint, 'wisnuc', 'fruitmix'))
    if (current) broadcast.emit('StationStart', path.join(v.mountpoint, 'wisnuc', 'fruitmix'))
  }
  state = 'started'
}

init()

/**
see apib document
*/
router.get('/', (req, res) => res.status(200).json({ prerequisite, mode, last, state, current, error }))

/**
see apib document
@function
@fires FileSystemUpdate
@fires BootModeUpdate
*/
router.patch('/', (req, res, next) => {
  let arg = req.body

  if (prerequisite.error) {
    if (arg.hasOwnProperty('mode') || arg.hasOwnProperty('current')) {
      res.status(403).json({ message: 'mode or current cannot be updated when prerequisite not satisfied' })
    }
  }

  const err = (code, message) => res.status(code).json({ message })

  if (arg.hasOwnProperty('current')) {
    if (arg.hasOwnProperty('state')) return err(400, 'curent and state cannot be patched simultaneously')
    if (arg.hasOwnProperty('mode')) return err(400, 'current and mode cannot be patched simultaneously')
    if (current !== null) return err(400, 'current file system is already set')

    let v = storage.volumes.find(v => v.uuid === arg.current)
    if (!v) return err(400, 'volume not found')
    if (!v.isMounted) return err(400, 'volume is not mounted')
    if (v.isMissing) return err(400, 'volume has missing devices')
    if (!Array.isArray(v.users) && v.users !== 'ENOENT') return err(400, 'only volumes without fruitmix or with users can be used')

    let froot = path.join(v.mountpoint, 'wisnuc', 'fruitmix')
    let tmp = path.join(froot, 'tmp')
    rimraf(tmp, err => {
      if (err) return next(err) 
      mkdirp(tmp, err => {
        if (err) return next(err)
        current = v.fileSystemUUID
        error = null

        if (mode === 'maintenance') broadcast.emit('BootModeUpdate', null, 'normal')
        broadcast.emit('FileSystemUpdate', null, current)
        broadcast.emit('FruitmixStart', froot)
        broadcast.emit('StationStart', froot)
        process.nextTick(() => res.status(200).json({ mode, last, state, current, error }))
      })
    })
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
