const path = require('path')
const fs = require('fs')
const child = require('child_process')
const UUID = require('uuid')

const mkdirp = require('mkdirp')
const getArgs = require('get-args')

const { passwordEncrypt } = require('./lib/utils')
const configurations = require('./configurations')
const Fruitmix = require('./fruitmix/Fruitmix')
const App = require('./app/App')


/**
This is the entry point of the program.

CreateApp parses args and create the App accordingly.

--standalone                  start appifi without bootstrap
  --mdns                      fake mdns broadcasting
  --fruitmix-only             start fruitmix without boot
  --fruitmix-dir path/to/dir  use the given path as fruitmix root directory.
  --alice                     use alice as bound user
--smb                         use smb
--dlna                        use dlna
--transmission                use transmission
--webtorrent                  use webtorrent

@module createApp
*/

let isRoot = process.getuid && process.getuid() === 0
let args = (getArgs(process.argv)).options

const hostname = `wisnuc-generic-deadbeef${UUID.v4().split('-').join('').slice(0, 16)}`

console.log(args)

// only standalone && fruitmix-only mode allows non-priviledged user
if (!(args.standalone && args['fruitmix-only']) && !isRoot)
  throw new Error('boot module requires root priviledge')

if (args.smb && !isRoot) throw new Error('smb feature requires root priviledge')
if (args.dlna && !isRoot) throw new Error('dlna feature requires root priviledge')
if (args.transmission && !isRoot) throw new Error('transmission feature requires root priviledge')

if (args.mdns && !isRoot) throw new Error('mdns requires root priviledge')
if (args.mdns) {
  child.exec(`avahi-set-host-name ${hostname}`)
  child.spawn('avahi-publish-service', ['fakeBootstrap', '_http._tcp', 3000], { stdio: 'ignore' })
}

let fruitmixOpts = {
  useSmb: !!args.smb,
  useDlna: !!args.dlna,
  useTransmission: !!args.transmission,
}

let fruitmixDir = path.join(process.cwd(), 'tmptest')

let appOpts

// in standalone mode
if (args.standalone) {
  if (args['fruitmix-only']) {
    if (args['fruitmix-dir']) {
      fruitmixOpts.fruitmixDir = args['fruitmix-dir']

    } else {
      let cwd = process.cwd()
      let tmptest = path.join(cwd, 'tmptest')
      mkdirp.sync(tmptest)
      fruitmixOpts.fruitmixDir = tmptest
    }

    if (!!args['alice']) {
      fruitmixOpts.boundUser = {
        phicommUserId: 'alice',
        password: passwordEncrypt('alice', 10)
      }
    }

    let fruitmix = new Fruitmix(fruitmixOpts)
    let app = new App({
      fruitmix,
      useServer: true,
    })
  } else {
    let configuration = configurations.phicomm.n2
    console.log('configuration', configuration)
    let app = new App({
      fruitmixOpts,
      configuration,
      useAlice: !!args['alice'],
      useServer: true,
      listenProcess: true
    })
  }
}
