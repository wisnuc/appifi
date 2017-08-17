const fs = require('fs')
const path = require('path')
const debug = require('debug')('station')
const EventEmitter = require('events')

const client = require('socket.io-client')
const ursa = require('ursa')
const Promise = require('bluebird')

const { FILE, CONFIG } = require('./const')
const broadcast = require('../../common/broadcast')


const CONNECT_STATE = {
  DISCED: 'DISCONNECTED',
  DISCING: 'DISCONNECT_ING',
  CONNED: 'CONNECTED',
  CONNING: 'CONNECT_ING'
}
Object.freeze(CONNECT_STATE)


function getSocket(address, saId, privateKey, callback) {
  let socket = client(address,{
      transports: ['websocket']
  })
  
  let finished = false
  let state = 'disconnect'

  let finish = (token) => {
    if(finished) return
    socket.removeAllListeners()
    return callback(null, socket)
  }

  let error = (err) => {
    if(finished) return
    socket.close()
    socket = null
    return callback(err)
  }

  socket.on('connect',() => {
    state = 'connecting'
    socket.emit('message', { type: 'requestLogin', data:{ id: saId } })
  })
  socket.on('message', (data) => {
    debug(data)
    if(data.type === 'checkLogin'){
      let secretKey = ursa.createPrivateKey(privateKey)
      let seed  = secretKey.decrypt(data.data.encryptData, 'base64', 'utf8')
      socket.emit('message',{ type: 'login', data: { seed }})
    }
    if(data.type === 'login'){
      let success = data.data.success
      if(success){
        state = 'connected'
        socket.token = data.data.token
        return finish()
      }else{
        socket.disconnect()
        return error(new Error('login error'))
      }
      debug(success)
    }
  })
  socket.on('disconnect', data => {
    state = 'disconnected'
    return error(new Error('disconnect'))
  })
  socket.on('error', err => {
    state = 'disconnected'
    debug('socket_error', err.message)
    return error(err)
  })
  socket.on('connect_error', err => {
    state = 'disconnected'
    debug('connect_error', err.message)
    return error(err)
  })
}

let getSocketAsync = Promise.promisify(getSocket)

class Connect extends EventEmitter{ 

  constructor(station) {
    super()
    this.state = CONNECT_STATE.DISCED
    this.privateKey = station.privateKey
    this.saId = station.sa.id
    this.froot = station.froot
    this.handler = new Map()
    this.socket = undefined
    this.error = undefined
    this.token = undefined
    this.initialized = false
  }

  async initAsync() {
    return this.startConnectAsync(CONFIG.CLOUD_PATH)
  }
  
  deinit(){
    this.disconnect()
    this.error = null
    this.froot = null
    this.state = CONNECT_STATE.DISCED
    this.saId = null
    this.socket = null
    this.privateKey = null
    this.token = null
    this.initialized = false
    this.handler.clear()
    this.handler = undefined
    debug('connect deinit')
  }


  _changeState(state, error) {
    if(state === CONNECT_STATE.DISCED && error) this.error = error
    else this.error = null

    this.state = state
    this.emit('ConnectStateChange', state)
  }

  async startConnectAsync(address) {
    if(this.socket) socket.close() // reconnect 
    this.socket = undefined
    this._changeState(CONNECT_STATE.CONNING)
    try{
      this.socket = await getSocketAsync(address, this.saId, this.privateKey)
      this._changeState(CONNECT_STATE.CONNED)
      this.token = this.socket.token
      debug('connect success')
      this.socket.on('event', ((data) => {
        this.dispatch(data.type, data)
      }).bind(this))
      this.socket.on('message', ((data) => {
        this.dispatch(data.type, data.data)
      }).bind(this))
      this.socket.on('disconnect', data => {
        this._changeState(CONNECT_STATE.DISCED)
        debug('connent disconnect', data)
      })
      this.socket.on('error', err => {
        debug('socket_error', err.message)
        this._changeState(CONNECT_STATE.DISCED, err)
      })
      this.socket.on('connect_error', err => {
        this._changeState(CONNECT_STATE.DISCED, err.message)
      })
      this.initialized = true
      return this.token
    }catch(e){
      debug(e)
      this._changeState(CONNECT_STATE.DISCED, e)
    }
  }

  dispatch(eventType, data) {
    if(this.handler.has(eventType))
      this.handler.get(eventType)(data)
    else
      debug('NOT FOUND EVENT HANDLER', eventType, data)
  }

  send(eventType, data) {
    debug(eventType, data)
    this.socket.emit('message', { type: eventType, data})
  }

  disconnect() {
    if(this.state !== CONNECT_STATE.DISCED){
        this.socket.disconnect()
        this.socket.close()
        this.socket = null
        this._changeState(CONNECT_STATE.DISCING)
    }
  }

  connect() { // reconnect
    this.startConnectAsync(CONFIG.CLOUD_PATH).then(() => {})
  }

  getState(){
    return this.state
  }

  isConnected() {
    return this.state === CONNECT_STATE.CONNED ? true : false
  }

  register(name, callback) {
    this.handler.set(name, callback)
  }
}

module.exports.Connect = Connect
module.exports.CONNECT_STATE = CONNECT_STATE
