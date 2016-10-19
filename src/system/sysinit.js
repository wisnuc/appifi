import sysconfig from './sysconfig'

import { setFanScale, updateFanSpeed, pollingPowerButton } from './barcelona'

export default () => {
  updateFanSpeed()
  pollingPowerButton()
  setFanScale(sysconfig.get('barcelonaFanScale'))
}

