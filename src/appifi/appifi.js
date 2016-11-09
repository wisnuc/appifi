import { observeDocker } from '../reducers'

import docker from './lib/docker'
import appstore from './lib/appstore'

export default () => {
  console.log('[appifi] init')
  docker.init()
  appstore.reload()
}
