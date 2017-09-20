const DeepFreeze = require('deep-freeze')

let FILE = {
    PUBKEY: 'pb.pub',
    PVKEY: 'pv.pem',
    SA: 'station.json'
}

let CONFIG = {}
if(process.env.NODE_ENV === 'test')
    CONFIG.CLOUD_PATH = 'http://www.siyouqun.org/'
else
    CONFIG.CLOUD_PATH = 'http://www.siyouqun.org/'
Object.freeze(FILE)
Object.freeze(CONFIG)

module.exports = { FILE, CONFIG }