const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))

const Config = require('./config')

const debug = require('debug')('system:barcelona')

/**
Barcelona wraps functions specific to WS215i

@module Barcelona
@requires Broadcast
@requires Config
*/

/**
This path is WS215i specific file for GPIO events. It is used to read power button status. It is also used to check WS215i model.

@const
@private
@default
*/
const BOARD_EVENT = '/proc/BOARD_event'

/**
This path is WS215i specific file. It is used to read fan speed (in rpm) and set PWM duty cycle (in percentage).

@const
@private
@default
*/
const FAN_IO = '/proc/FAN_io'

/**
Telling if this device is barcelona. Initialized when module loaded using sync io method.

@const
@default
*/
const isBarcelona = (() => {

  try {
    return !!fs.lstatSync(BOARD_EVENT)
  }
  catch (e) {
    return false
  }

})()

/**
Read fan speed.
@param {function} callback - `(err, fanSpeed) => {}`, returns err or fan speed in rpm.
*/
const readFanSpeed = callback => 
  fs.readFile(FAN_IO, (err, data) => {
    if (err) return callback(err)

    let fanSpeed = parseInt(data.toString().trim())  
    if (!Number.isInteger(fanSpeed))
      return callback(new Error('Parse Failed'))

    callback(null, fanSpeed)
  })

/**
Write fan scale (PWM duty cycle), from 0 to 100 percents).
@param {number} fanScale
@param {function} callback - `err => {}`, returns err if failed.
*/
const writeFanScale = (fanScale, callback) => 
  (!Number.isInteger(fanScale) || fanScale < 0 || fanScale > 100) ?
    callback(new Error('fanScale must be integer from 0 to 100')) :
      child.exec(`echo ${fanScale} > ${FAN_IO}`, err => callback(err))

/**
Fired when user long pressed the power button for several seconds.

This is an WS215i specific event, fired by [Barcelona]{@link System.module:Barcelona}.

@event PowerButtonLongPress
@global
*/

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
    }
    else {
      powerButtonCounter = 0
    }

    debug('board event', read, powerButtonCounter)
  })

}, 1000)

const romInfoAsync = async () => {

  try {
    await fs.statAsync('/proc/BOARD_io')
    let arr = await Promise.all([
      child.execAsync('dd if=/dev/mtd0ro bs=1 skip=1697760 count=11'),
      child.execAsync('dd if=/dev/mtd0ro bs=1 skip=1697664 count=20'),
      child.execAsync('dd if=/dev/mtd0ro bs=1 skip=1660976 count=6 | xxd -p')
    ])
    return {
      serial: arr[0].toString(),
      p2p: arr[1].toString(),
      mac: arr[2].trim().match(/.{2}/g).join(':')
    }
  } catch (e) {}
}

const init = () => {

  console.log('[system] barcelona init')

  child.exec('echo "PWR_LED 1" > /proc/BOARD_io')
  console.log('[barcelona] set power LED to white on')
 
  pollingPowerButton() 
  console.log('[barcelona] start polling power button')

  let fanScale = Config.get().barcelonaFanScale
  writeFanScale(fanScale, err => {
    if (err) {
      console.log('[barcelona] failed set barcelonaFanScale')
      console.log(err)
    }
    else {
      console.log(`[barcelona] fanScale set to ${fanScale}`)
    }
  })
} 

module.exports = { 
  readFanSpeed, 
  writeFanScale, 
  init, 
  isBarcelona
}


