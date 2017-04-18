import Debug from 'debug'
const INDEX = Debug('APPIFI:INDEX')

import httpServer from './component/http/httpServer'
import dockerInit from './component/docker/docker'

const appifiInit = () => {

  httpServer()
  INDEX('Appifi HTTP server ran...')

  dockerInit.init('/home/wisnuc/git/appifi/run/wisnuc/app')
  INDEX('Docker initialized')
}

export default appifiInit