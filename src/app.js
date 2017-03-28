const Boot = require('./system/boot')
const Config = require('./system/config')
const Device = require('./system/device')
const Storage = require('./system/storage')

const system = require('./system/index')
const systemServer = require('./system/system')
// const appifi = require('./appifi/appifi')

const configFile = '/etc/wisnuc.json'
const configTmpDir = '/etc/wisnuc/tmp'
const storageFile = '/run/wisnuc/storage'
const storageTmpDir = '/run/wisnuc/tmp'

const main = async () => {
	// config should start before device, otherwise, barcelona init would fail.
  await Config.initAsync(configFile, configTmpDir)
  await Device.probeAsync()
  await Storage.initAsync(storageFile, storageTmpDir)
  await Boot.autoBootAsync()
  // appifi(system)
  systemServer(system)
}

main().asCallback(err => err && console.log(err))

