const fs = require('fs')
const path = require('path')

const client = require('socket.io-client')
const ursa = require('ursa')

const { FILE, CONFIG } = require('./const')
const broadcast = require('../../../common/broadcast')

class Connect { 

  constructor() {
    broadcast.on('StationStart', station => {
      this.sa = station.sa
      this.froot = station.froot
      this.connect(CONFIG.CLOUD_PATH)
    })
  }

  connect(address) {
    this.socket = client(address,{
      transports: ['websocket']
    })
    this.socket.on('connect', (() => {
      console.log('connent success')
      this.send('requestLogin',{ id: this.sa.id})
    }).bind(this))
    this.socket.on('event', ((data) => {
      this.dispatch(data.type, data)
    }).bind(this))
    this.socket.on('message', ((data) => {
      this.dispatch(data.type, data.data)
    }).bind(this))
    this.socket.on('disconnect', () => {
      console.log('connent disconnect')
    })
    this.socket.on('connect_error',console.error.bind(console, 'Connnect-Error: '))
  }

  dispatch(eventType, data) {
    console.log('dispatch:', eventType, data)
    if(eventType === 'checkLogin'){
      let secretKey = ursa.createPrivateKey(fs.readFileSync(path.join(this.froot, 'station', FILE.PVKEY)))
      let seed = secretKey.decrypt(data.encryptData, 'base64', 'utf8')
      this.send('login', { seed })
    }
    if(eventType === 'login'){
      let success = data.success
      console.log(success)
    }
  }

  send(eventType, data) {
    console.log(eventType, data)
    this.socket.emit('message', { type: eventType, data})
  }

  disconnect() {
    if(this.socket && this.socket.connected) 
      this.socket.disconnect()
  }

  isConnect() {
    if(this.socket && this.socket.connected)
      return true
    return false
  }
}

module.exports = new Connect()