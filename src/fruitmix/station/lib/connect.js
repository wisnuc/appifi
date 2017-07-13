const fs = require('fs')
const path = require('path')

const client = require('socket.io-client')
const ursa = require('ursa')

const { FILE } = require('./const')

class Connect { 

  constructor(address, sa, froot) {
    this.address = address
    this.connect(address)
    this.sa = sa
    this.froot = froot
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
    if(this.socket.connected) 
      this.socket.disconnect()
  }

  isConnect() {
    return this.socket.connected
  }
}

module.exports = Connect