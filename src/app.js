const Boot = require('./system/boot')
const Config = require('./system/config')
const Device = require('./system/device')
const Storage = require('./system/storage')

const system = require('./system/index')
const appifi = require('./appifi/appifi')

const configFile = '/etc/wisnuc.json'
const configTmpDir = '/etc/wisnuc/tmp'
const storageFile = '/run/wisnuc/storage'
const storageTmpDir = '/run/wisnuc/tmp'

const main = async () => {
  await Device.probeAsync()
  await Config.initAsync(configFile, configTmpDir)
  await Storage.initAsync(storageFile, storageTmpDir)
  await Boot.tryBootAsync()
  appifi(system)
}

main().asCallback(err => console.log(err))

