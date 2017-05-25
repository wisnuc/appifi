import child from 'child_process'
import events from 'events'

import Debug from 'debug'
const debug = Debug('APPIFI:ADVERTISER')

class Advertiser extends events {

  constructor(name, port) {
    super()
    this.name = name
    this.port = port
    this.handle = null
  }

  start() {
    this.handle = child.spawn('avahi-publish-service', [
      this.name,
      '_http._tcp',
      this.port,
      ], { stdio: 'ignore'})

    this.handle.on('error', error => {
      debug('Start error', error)
    })

    this.handle.on('exit', (code, signal) => {
      debug(`Stop advertising: ${this.name} @ ${this.port}`)
      this.handle = null
      this.emit('exit', code, signal)
    })

    debug(`Start advertising: ${this.name} @ ${this.port}`)
  }

  isAdvertising() {
    return !!this.handle 
  }

  abort() {
    if (this.handle) {
      this.handle.kill()
    }
  }
}

export default Advertiser

