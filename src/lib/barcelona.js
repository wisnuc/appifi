import child from 'child_process'
import fs from 'fs'
import Promise from 'bluebird'

import { storeDispatch } from './reducers'
import { setConfig } from './appifiConfig'

const BOARD_EVENT = '/proc/BOARD_event'
const FAN_IO = '/proc/FAN_io'

const fsStatAsync = Promise.promisify(fs.stat)
const fsReadFileAsync = Promise.promisify(fs.readFile)
const childExecAsync = Promise.promisify(child.exec)

const updateFanSpeed = () => 
  fsReadFileAsync(FAN_IO)
    .then(data => {
      let fanSpeed = parseInt(data.toString().trim())
      storeDispatch({
        type: 'BARCELONA_FANSPEED_UPDATE',
        data: fanSpeed
      })
    })
    .catch(e => {}) // suppress nodejs red warning

var powerButtonCounter = 0

const pollingPowerButton = () => 
  setInterval(() => 
    fsReadFileAsync(BOARD_EVENT)
      .then(data => {
        if (data.toString().trim() === 'PWR ON') {
          powerButtonCounter++
          if (powerButtonCounter > 4) child.exec('poweroff', () => {})
        }
        else
          powerButtonCounter = 0
      })
      .catch(e => {}) // suppress nodejs red warning

  , 1000)

const setFanScale = async (scale) => {

  if (!(typeof scale === 'number'))
    throw new Error(`scale ${scale} is not a number`)

  let fanScale = Math.floor(scale)

  if (fanScale < 0 || fanScale > 100)
    throw new Error(`fanScale ${fanScale} out of range`)

  await childExecAsync(`echo ${fanScale} > ${FAN_IO}`)

  setConfig('barcelonaFanScale', fanScale)
  storeDispatch({
    type: 'BARCELONA_FANSCALE_UPDATE',
    data: fanScale
  })
}

// workaround
child.exec('echo "PWR_LED 1" > /proc/BOARD_io', err => {})

export {updateFanSpeed, pollingPowerButton, setFanScale}

