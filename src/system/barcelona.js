import { fs, child } from '../common/async'
import { storeState, storeDispatch } from '../reducers'

const BOARD_EVENT = '/proc/BOARD_event'
const FAN_IO = '/proc/FAN_io'

const readFanSpeed = callback => 
  fs.readFile(FAN_IO, (err, data) => {
    if (err) 
      return callback(err)

    let fanSpeed = parseInt(data.toString().trim())  
    if (!Number.isInteger(fanSpeed))
      return callback(new Error('Parse Failed'))

    callback(null, fanSpeed)
  })

const writeFanScale = (fanScale, callback) => 
  (!Number.isInteger(fanScale) || fanScale < 0 || fanScale > 100) ?
    callback(new Error('fanScale must be integer from 0 to 100')) :
      child.exec(`echo ${fanScale} > ${FAN_IO}`, err => callback(err))

let powerButtonCounter = 0

const job = () => 
  fs.readFile(BOARD_EVENT, (err, data) => 
    err ? (powerButtonCounter = 0) :
      (data.toString().trim() === 'PWR ON' && ++powerButtonCounter > 4) ?
        child.exec('poweroff') : (powerButtonCounter = 0))

const pollingPowerButton = () => setInterval(job, 1000)

const barcelonaInit = () => {

  console.log('[system] barcelona init')

  child.exec('echo "PWR_LED 1" > /proc/BOARD_io')
  console.log('[barcelona] set power LED to white on')
 
  pollingPowerButton() 
  console.log('[barcelona] start polling power button')

  let fanScale = storeState().config.barcelonaFanScale
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

export { readFanSpeed, writeFanScale, barcelonaInit }


