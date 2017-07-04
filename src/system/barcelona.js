const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))

const router = require('express').Router()
const debug = require('debug')('system:barcelona')

const broadcast = require('../common/broadcast')

/**
`barcelona` wraps functions specific to WS215i.

This is a reactive module.

```
fires `FanScaleUpdate` ->
  Config module update and fires `ConfigUpdate` ->
    set fanScale to config.barcelonaFanScale and write fan scale to kernel.
```

@module Barcelona
@requires Broadcast
*/

/**
Fired when a user sets fanScale or this module sets it to default value. Config module should listen to this event.

@event FanScaleUpdate
@global
*/

/**
Fired when user long pressed the power button for several seconds.

This is an WS215i specific event, fired by [Barcelona]{@link System.module:Barcelona}.

@event PowerButtonLongPress
@global
*/

/**
This path is WS215i specific file for GPIO events. It is used to read power button status. It is also used to check WS215i model.

@const
*/
const BOARD_EVENT = '/proc/BOARD_event'

/**
This path is WS215i specific file for FAN operation. It is used to read fan speed (in rpm) and set PWM duty cycle (in percentage).

@const
*/
const FAN_IO = '/proc/FAN_io'

/**
Barcelona fan scale. This value is updated when config updated (reactive value). Don't update it directly.
*/
let fanScale = -1

/**
Read fan speed.
@param {function} callback - `(err, fanSpeed) => {}`, returns err or fan speed in rpm.
*/
const readFanSpeed = callback =>
  fs.readFile(FAN_IO, (err, data) => {
    if (err) return callback(err)

    let fanSpeed = parseInt(data.toString().trim())
    if (!Number.isInteger(fanSpeed)) { return callback(new Error('Parse Failed')) }

    callback(null, fanSpeed)
  })

/**
Write fan scale (PWM duty cycle), from 0 to 100 percents). This function is only used in listener.
@param {number} fanScale
@param {function} callback - `err => {}`, returns err if failed.
*/
const writeFanScale = (fanScale, callback) =>
  (!Number.isInteger(fanScale) || fanScale < 0 || fanScale > 100)
    ? callback(new Error('fanScale must be integer from 0 to 100'))
      : child.exec(`echo ${fanScale} > ${FAN_IO}`, err => callback(err))

/**
Polling power button every 1 second. When power button held down for over 5 seconds, broadcasts an {@link PowerButtonLongPress} event.
@fires PowerButtonLongPress
*/
const pollingPowerButton = () => setInterval(() => {
  let powerButtonCounter = 0

  fs.readFile(BOARD_EVENT, (err, data) => {
    if (err) {
      powerButtonCounter = 0
      debug('board event error', powerButtonCounter)
      return
    }

    let read = data.toString().trim()
    if (read === 'PWR ON') {
      powerButtonCounter++
      if (powerButtonCounter > 4) {
        console.log('[barcelona] user long-pressed the power button, shutting down')
        child.exec('poweroff')
      }
    } else {
      powerButtonCounter = 0
    }

    debug('board event', read, powerButtonCounter)
  })
}, 1000)

/**
Check if given fan scale value is valid.

@param {number} fanScale - a integer between 0 and 100, inclusive.
@returns {boolean}
*/
const isValidFanScale = fanScale => Number.isInteger(fanScale) && fanScale >= 0 && fanScale <= 100

/**
Module init function. It starts power button polling and hooks `ConfigUpdate` listener.

@fires FanScaleUpdate
@listens ConfigUpdate
@listens SystemShutdown
*/
const init = () => {
  try {
    fs.lstatSync(BOARD_EVENT)
  } catch (e) {
    return
  }

  console.log('[barcelona] set power LED to white on')
  child.exec('echo "PWR_LED 1" > /proc/BOARD_io')

  console.log('[barcelona] start polling power button')
  pollingPowerButton()

  broadcast.on('ConfigUpdate', (err, config) => {
    if (err) return
    if (config.barcelonaFanScale === fanScale) return

    // if config not valid, set it to default value
    if (!isValidFanScale(config.barcelonaFanScale)) {
      broadcast.emit('FanScaleUpdate', null, 50)
      return
    }

    writeFanScale(config.barcelonaFanScale, err => {
      if (err) {
        console.log('[barcelona] failed set barcelonaFanScale')
        console.log(err)
      } else {
        console.log(`[barcelona] fanScale set to ${fanScale}`)
        fanScale = config.barcelonaFanScale
      }
    })
  })

  broadcast.on('SystemShutdown', () => child.exec('echo "PWR_LED 3" > /proc/BOARD_io'))

  router.get('/', (req, res) => readFanSpeed((e, fanSpeed) => e
    ? res.status(500).json({ code: e.code, message: e.message })
    : res.status(200).json({ fanScale, fanSpeed })))

  router.patch('/', (req, res) => {
    if (Number.isInteger(req.body.fanScale) && req.body.fanScale >= 0 && req.body.fanScale <= 100) {
      broadcast.emit('FanScaleUpdate', req.body.fanScale)
      res.status(200).end()
    } else {
      res.status(400).end()
    }
  })

  module.exports = {
    /**
    `romcodes` is an object containing serial number, p2p code and mac address.
    @member
    @const
    */
    romcodes: (() => {
      try {
        let serial = child
          .execSync('dd if=/dev/mtd0ro bs=1 skip=1697760 count=11')
          .toString()
        let p2p = child
          .execSync('dd if=/dev/mtd0ro bs=1 skip=1697664 count=20')
          .toString()
        let mac = child
          .execSync('dd if=/dev/mtd0ro bs=1 skip=1660976 count=6 | xxd -p')
          .trim()
          .match(/.{2}/g)
          .join(':')

        return { serial, p2p, mac }
      } catch (e) {
        return null
      }
    })(),

    /**
    See API documents
    @member
    */
    router
  }
}

init()
