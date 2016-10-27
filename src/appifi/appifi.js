import { observeDocker } from './lib/reducers'

import docker from './lib/docker'
import appstore from './lib/appstore'
import observer from './lib/dockerStateObserver'

export default () => {
  console.log('[appifi] init')
  observeDocker(observer)
  docker.init()
  appstore.reload()
}
