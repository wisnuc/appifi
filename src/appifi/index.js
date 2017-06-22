const Promise = require('bluebird')
const path = require('path')

const Debug = require('debug')
const INDEX = Debug('APPIFI:INDEX')

const httpServer = require('./component/http/httpServer')
const dockerInit = require('./component/docker/docker')
const { daemonStart, daemonStop, getDockerStatus } = require('./component/docker/docker')

const appifiInit = async (mountpoint) => {

  httpServer()
  INDEX('Appifi HTTP server runs')

  // /run/wisnuc/volumes/xxxx/appifi
  dockerInit.init(path.join(mountpoint, 'appifi'))
  INDEX('Docker initialized')
}

const appstoreStart = async () => {
  await daemonStart()
}

const appstoreStop = async () => {
  await daemonStop()
}

const getDockerInfor = () => {
  return getDockerStatus()
}

module.exports = {
  appifiInit,
  appstoreStart,
  appstoreStop,
  getDockerInfor,
}
