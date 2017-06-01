import path from 'path'

import Debug from 'debug'
const INDEX = Debug('APPIFI:INDEX')

import httpServer from './component/http/httpServer'
import dockerInit from './component/docker/docker'
import { daemonStart, daemonStop, getDockerStatus } from './component/docker/docker'

// import { DOCKER_PID_FILE } from './docker/config'

const appifiInit = async (mountpoint) => {

  httpServer()
  INDEX('Appifi HTTP server ran...')

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

export {
  appifiInit,
  appstoreStart,
  appstoreStop,
  getDockerInfor,
}