const DeepFreeze = require('deep-freeze')

let FILE = {
    PUBKEY: 'pubkey.pub',
    PVKEY: 'pv.pem',
    SA: 'sa.json'
}

let CONFIG = {
    CLOUD_PATH: 'http://10.10.9.59:5757/'
}

Object.freeze(FILE)
Object.freeze(CONFIG)

module.exports = { FILE, CONFIG }