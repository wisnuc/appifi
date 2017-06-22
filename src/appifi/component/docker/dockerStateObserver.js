const child = require('child_process')
const deepEqual = require('deep-equal')

const Debug = require('debug')
const DOCKER_STATE_OBSERVER = Debug('APPIFI:DOCKER_STATE_OBSERVER')

const Advertiser = require('../avahi/advertiser')
const DefaultParam = require('../../lib/defaultParam')

// default service
let wisnucAppstationPort = new DefaultParam().getWisnucAppstationPort()
const appifiAdvertiser = new Advertiser('WISNUC AppStation', wisnucAppstationPort)
appifiAdvertiser.start()

class DockerStateObserver {

  constructor() {
    this.appAdvertiserList = []
  }

  // used for map // TODO why placed here
  _getRunningContainerInfo(installed) {

    let container = installed.containers[0]
    if (container.State !== 'running') {
      return null
    }

    let Ports = container.Ports
    if (!Ports || !Array.isArray(Ports) || Ports.length === 0) {
      return null
    }

    // { IP: '0.0.0.0', PrivatePort: 80, PublicPort: 10088, Type: 'tcp' }
    let Port = Ports.find(p => p.Type === 'tcp' && p.PublicPort !== undefined) 
    if (!Port) return null

    // typeof Port.PublicPort is 'number' 
    return {
      appname: installed.recipe.appname,
      open: Port.PublicPort
    }
  }

  _createNewAdvertisingList(advertisingList, serviceList) {

    let newServiceList = serviceList.filter(srv => {
      if (advertisingList.find(adv => adv.name === srv.appname && adv.port === srv.open)) 
        return false
      return true 
    })

    newServiceList.forEach(srv => {
      let adv = new Advertiser(srv.appname, srv.open)
      adv.start()
      advertisingList.push(adv)
    })

    return advertisingList
  }

  _createSurvivorAdvertisingList(advertisingList, serviceList) {

    let survivorList = []

    // find existing advertiser and stop it
    advertisingList.forEach(adv => {

      if (serviceList.find(srv => srv.appname === adv.name && srv.open === adv.port)) {
        survivorList.push(adv)
      }
      else {
        adv.abort()
      }
    })

    return survivorList
  }

  observe(newState, state) {

    DOCKER_STATE_OBSERVER('Process advertising list')

    if (newState !== null && 
      newState.data!== null && 
      newState.computed !== null) {

      let runningServiceList = newState.computed.installeds
        .map(inst => this._getRunningContainerInfo(inst))
        .filter(obj => obj !== null)

      let survivorList = this._createSurvivorAdvertisingList(this.appAdvertiserList, runningServiceList)
      this.appAdvertiserList = this._createNewAdvertisingList(survivorList, runningServiceList) 
    }
  }
}

module.exports = DockerStateObserver


