const DeepFreeze = require('deep-freeze')

let FILE = {
    PUBKEY: 'pb.pub',
    PVKEY: 'pv.pem',
    SA: 'station.json'
}

let CONFIG = {}
if(process.env.NODE_ENV === 'test')
    CONFIG.CLOUD_PATH =  'http://10.10.9.59:4000/'
else{}
Object.freeze(FILE)
Object.freeze(CONFIG)

module.exports = { FILE, CONFIG }