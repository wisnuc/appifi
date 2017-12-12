const debug = require('debug')('station')
const mqtt = require('mqtt')
const { CONFIG } = require('./const')
const EventEmiter = require('events').EventEmitter

const CONNECT_STATE = {
  DISCED: 'DISCONNECTED',
  DISCING: 'DISCONNECT_ING',
  CONNED: 'CONNECTED',
  CONNING: 'CONNECT_ING',
  RECONNING: 'RECONNECT_ING',
  UNKNOWN : 'UNKNOWN'
}

class MQTT extends EventEmiter {

  constructor(ctx) {
    super()
    this.state = CONNECT_STATE.DISCED
    this.ctx = ctx 
    this.client = undefined
    this.payload = JSON.stringify({ stationId: ctx.station.id })
    this.settings = {
      clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8),
      clean: false,
      will: {
        topic: `station/disconnect`,
        payload: this.payload,
        qos: 1,
        retain: false
      }
    }
    this.handlers = new Map()
  }

  connect(addr, callback) {
    const client = mqtt.connect(CONFIG.MQTT_URL, this.settings)
    client.on('connect', connack => {
      debug('station connect successfully!', connack)
      client.publish(`station/connect`, this.payload, { qos: 1 })
      client.subscribe(`station/${this.ctx.station.id}/pipe`, { qos: 1 })
    })
  
    client.on('message', (topic, message, packet) => {
      debug(`message`, topic, message, message.toString(), Date.now())
      let data = JSON.parse(message)
      this.dispatch(data.type, data)
    })
    client.on('reconnect', err => {
      debug('reconnect', err)
    })
    client.on('error', err => {
      debug('error:', err)
    })
    client.on('close', () => {
      debug('close')
    })
    this.client = client
  }

  destory() {
    this.ctx = null
    if(this.client) {
      this.client.removeAllListeners()
      this.client.on('error', () => {})
      this.client.end()
      this.client = undefined
    }
    this.handlers.clear()
  }

  register(key, value) {
    this.handlers.set(key, value)
  }

  dispatch(eventType, data) {
    if (this.handlers.has(eventType))
      this.handlers.get(eventType)(data)
    else
      debug('NOT FOUND EVENT HANDLER', eventType, data)
  }

  getState() {
    if(!this.client) return CONNECT_STATE.DISCED
    return this.client.disconnected ? CONNECT_STATE.DISCED : this.client.disconnecting ? CONNECT_STATE.DISCING
                : this.client.connected ? CONNECT_STATE.CONNED : this.client.reconnecting ? CONNECT_STATE.reconnecting
                 : CONNECT_STATE.UNKNOWN
  }

  isConnected() {
    return this.getState() === CONNECT_STATE.CONNED
  }
}

module.exports.MQTT = MQTT
module.exports.CONNECT_STATE = CONNECT_STATE