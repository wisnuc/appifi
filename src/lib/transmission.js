const { spawn, spawnSync } = require('child_process')
const Transmission = require('transmission')

const command = 'systemctl'
const serviceName = 'transmission-daemon'


const getEnableState = () => {
  return spawnSync(command, ['is-enabled', serviceName]).stdout.toString()
}

const getActiveState = () => {
  return spawnSync(command, ['is-active', serviceName]).stdout.toString()
}

const getTransmission = (host, port, username, password) => {
  return new Transmission({
    host, port, username, password
  })
}



module.exports = {
  getEnableState,
  getActiveState,
  getTransmission
}