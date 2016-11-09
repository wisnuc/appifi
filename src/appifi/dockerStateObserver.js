import child from 'child_process'
import Debug from 'debug'
import deepEqual from 'deep-equal'

const debug = Debug('appifi:dockerStateObserver')

import createAdvertiser from './advertiser'

const appifiAdvertiser = createAdvertiser('WISNUC AppStation', 3000)

let appAdvertisers = []

// used for map // TODO why placed here
const openable = (installed) => {

  let container = installed.containers[0]
  if (container.State !== 'running') return null

  let Ports = container.Ports
  if (!Ports || !Array.isArray(Ports) || Ports.length === 0)
    return null

  // { IP: '0.0.0.0', PrivatePort: 80, PublicPort: 10088, Type: 'tcp' }
  let Port = Ports.find(p => p.Type === 'tcp' && p.PublicPort !== undefined) 
  if (!Port) return null

  // console.log(typeof Port.PublicPort) is 'number' 
  return {
    appname: installed.recipe.appname,
    open: Port.PublicPort
  }
}

const removeAdvertising = (advertising, services) => {

  let survive = []

  // find existing advertiser and stop it
  advertising.forEach(adv => {

    if (services.find(srv => srv.appname === adv.name && srv.open === adv.port)) {
      survive.push(adv)
    }
    else {
      adv.abort()
    }
  })

  return survive
}

const addAdvertising = (advertising, services) => {

  let newServices = services.filter(srv => {
    if (advertising.find(adv => adv.name === srv.appname && adv.port === srv.open)) 
      return false
    return true 
  })

  newServices.forEach(srv => {
    let adv = createAdvertiser(srv.appname, srv.open)
    advertising.push(adv)
  })

  return advertising
}

const dockerStateObserver = (newState, state) => {

  if (newState !== null && 
    newState.data!== null && 
    newState.computed !== null) {

    let services = newState.computed.installeds
      .map(inst => openable(inst))
      .filter(obj => obj !== null)

    let survive = removeAdvertising(appAdvertisers, services)
    appAdvertisers = addAdvertising(survive, services) 
  }
}

export default dockerStateObserver


