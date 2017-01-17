import child from 'child_process'
import events from 'events'

class advertiser extends events {

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
      console.log('[advertiser] error', error)
    })

    this.handle.on('exit', (code, signal) => {

      console.log(`[advertiser] stop advertising ${this.name} @ ${this.port}`)
      this.handle = null
      this.emit('exit', code, signal)
    })

    console.log(`[advertiser] start advertising ${this.name} @ ${this.port}`)
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

const createAdvertiser = (name, port) => {
  let adv = new advertiser(name, port)
  adv.start()
  return adv
}

export default createAdvertiser

