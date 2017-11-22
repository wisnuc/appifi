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


function createSocket(address, saId, privateKey, callback) {
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
    return error(new Error('createSocket:disconnect'))
  })
  socket.on('error', err => {
    state = 'disconnected'
    debug('createSocket:socket_error', err)
    return error(err)
  })
  socket.on('connect_error', err => {
    state = 'disconnected'
    debug('createSocket:connect_error', err)
    return error(err)
  })
}

let createSocketAsync = Promise.promisify(createSocket)


/*

In current design, each STORE or FETCH operation send socket message only once, 
when the communication session is initiated from client.  
So there is no need to classify message type further.
This should NOT be changed in future.

Direction: from cloud to station.


cloud is responsible for method validation.

{
  type: 'pipe',   // socket communication multiplexing
  
  sessionId:      // client-cloud-station pipe session id (uuid)
  user: {         // valid user data format

  },
  method: 'GET', 'POST', 'PUT', 'DELETE', 'PATCH',
  resource: 'path string', // req.params
  body: {         // req.body, req.query
  
  },

  serverAddr:     // valid ip address, whitelist
}
*/


class Connect extends EventEmitter{ 

  constructor(ctx) {
    super()
    this.state = CONNECT_STATE.DISCED
    this.privateKey = ctx.privateKey
    this.saId = ctx.station.id
    this.froot = ctx.froot
    this.handler = new Map()
    this.socket = undefined
    this.error = undefined
    this.token = undefined
    this.pipe = undefined
    this.address = undefined
    this.initialized = false
    this.reconnectCounter = 0
    this.reconnectTimer = undefined
  }

  async initAsync(address) {
    return this.startConnectAsync(address)
  }
  
  deinit(){
    this.disconnect()
    this.error = undefined
    this.froot = undefined
    this.state = CONNECT_STATE.DISCED
    this.saId = undefined
    this.socket = undefined
    this.privateKey = undefined
    this.token = undefined
    this.pipe = undefined
    this.address = undefined
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
    if(this.socket) {
      this.socket.disconnect()
      this.socket.close()
    }
    this.socket = undefined
    this._changeState(CONNECT_STATE.CONNING) 
    this.address = address
    try{
      this.socket = await createSocketAsync(address, this.saId, this.privateKey)
      //reset
      this.reconnectCounter = 0
      let error = false
      let errorHandle = e => {
        if(error) return 
        error = true
        process.nextTick(() => this.connectErrorHandler(address, e))
      }
      this.token = this.socket.token
      this._changeState(CONNECT_STATE.CONNED)
      debug('connect success')
      this.socket.on('event', ((data) => {
        this.dispatch(data.type, data)
      }).bind(this))
      this.socket.on('message', ((data) => {
        this.dispatch(data.type, data)
      }).bind(this))
      this.socket.on('disconnect', errorHandle)
      this.socket.on('error', errorHandle)
      this.socket.on('connect_error', errorHandle)
      this.initialized = true
      return this.token
    }
    catch(e){ this.connectErrorHandler(e) }
  }

  connectErrorHandler(address, err) {
    debug(address, err)
    this._changeState(CONNECT_STATE.DISCED, err)
    this.reconnect(address)
  }

  reconnect(address) {
    debug('Socket Reconnect: ' + this.reconnectCounter)
    clearTimeout(this.reconnectTimer)
    let time = Math.pow(2, this.reconnectCounter) * 1000
    if(this.reconnectCounter >= 50) this.reconnectCounter = 0
    this.reconnectTimer = setTimeout(() => this.connect.bind(this)(address), time)
    this.reconnectCounter ++
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

  connect(address) { // reconnect
    this.startConnectAsync(address)
      .then(() => {})
      .catch(e => debug(e))
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
