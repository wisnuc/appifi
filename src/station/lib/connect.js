const fs = require('fs')
const path = require('path')
const debug = require('debug')('station')

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
    debug('socket_error', err)
    return error(err)
  })
  socket.on('connect_error', err => {
    state = 'disconnected'
    debug('connect_error', err)
    return error(err)
  })
}

let getSocketAsync = Promise.promisify(getSocket)

class Connect { 

  constructor() {
    this.initialized = false
    this.state = CONNECT_STATE.DISCED
    this.socket = undefined
    this.error = undefined
    this.token = undefined
    this.privateKey = undefined
    this.sa = undefined
    this.froot = undefined
    this.handler = undefined
    this.init()
  }

  init() {
    broadcast.on('StationRegisterFinish', station => {
      this.sa = station.sa
      this.froot = station.froot
      this.privateKey = station.privateKey
      this.handler = new Map()
      this.startConnectAsync(CONFIG.CLOUD_PATH)
        .then(() => {})
        .catch(e => { debug(e) })
    })
    broadcast.on('StationStop', () => {if(this.initialized) this.deinit()})
  }

  _changeState(state, error) {
    if(state === CONNECT_STATE.DISCED && error) this.error = error
    else this.error = null
    
    debug(1)
    this.state = state
    debug(2)
    if(state === CONNECT_STATE.DISCED){
      if(this.socket) this.socket.close()
      if(this.initialized){
        this.socket = undefined
        this.deinit()
        broadcast.emit('Connect_Disconnect', this)
      }
    }
    debug(3)
    debug(state)
    if(state === CONNECT_STATE.CONNED){
      debug(4)
      broadcast.emit('Connect_Connected', this)
    }
  }

  deinit(){
    this.disconnect()
    this.error = null
    this.froot = null
    this.state = CONNECT_STATE.DISCED
    this.sa = null
    this.socket = null
    this.privateKey = null
    this.token = null
    this.initialized = false
    this.handler.clear()
    this.handler = undefined
    debug('connect deinit')
  }

  async startConnectAsync(address) {
    if(this.socket && this.socket.connected) throw new　Error('Connent is connected now')
    if(this.socket) socket.close()
    this.socket = undefined
    this._changeState(CONNECT_STATE.CONNING)
    try{
      this.socket = await getSocketAsync(address, this.sa.id, this.privateKey)
      this._changeState(CONNECT_STATE.CONNED)
      this.token = this.socket.token
      this.initialized = true
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
        debug('socket_error', err)
        this._changeState(CONNECT_STATE.DISCED, err)
      })
      this.socket.on('connect_error', err => {
        this._changeState(CONNECT_STATE.DISCED, err)
      })
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
      if(this.socket && this.socket.connected) {
        this._changeState(CONNECT_STATE.DISCING)
        this.socket.disconnect()
        this.socket.close()
        this.socket = null
      } 
    }
  }

  connect() {
    if(this.state === CONNECT_STATE.DISCED)
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

module.exports = new Connect()
