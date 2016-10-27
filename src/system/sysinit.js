import sysconfig from './sysconfig'

import { setFanScale, updateFanSpeed, pollingPowerButton } from './barcelona'

console.log('barcelona imported')

export default () => {
  updateFanSpeed()
  pollingPowerButton()
  setFanScale(sysconfig.get('barcelonaFanScale'))
}

