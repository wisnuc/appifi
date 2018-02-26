const DeepFreeze = require('deep-freeze')

let FILE = {
  PUBKEY: 'pb.pub',
  PVKEY: 'pv.pem',
  SA: 'station.json'
}

let CONFIG = {}

if (process.env.NODE_ENV === 'dev') {
  CONFIG.CLOUD_PATH = 'http://10.10.9.87:4000/'
  CONFIG.MQTT_URL = 'mqtt://test.siyouqun.com:1883'
} else if (process.env.NODE_ENV === 'test') {
  CONFIG.CLOUD_PATH = 'http://test.siyouqun.com/'
  CONFIG.MQTT_URL = 'mqtt://test.siyouqun.com:1883'
} else {
  CONFIG.CLOUD_PATH = 'http://www.siyouqun.com/'
  CONFIG.MQTT_URL = 'mqtt://mqtt.siyouqun.com:1883'
}

Object.freeze(FILE)
Object.freeze(CONFIG)

module.exports = { FILE, CONFIG }