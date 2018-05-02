const path = require('path')
const fs = require('fs')

const mkdirp = require('mkdirp')
const getArgs = require('get-args')

const Fruitmix = require('./fruitmix/Fruitmix')
const App = require('./app/App')

/**
This is the entry point of the program.

CreateApp parses args and create the App accordingly.

--standalone                  start appifi without bootstrap
  --mdns                      fake mdns broadcasting
  --fruitmix-only             start fruitmix without boot
  --fruitmix-dir path/to/dir  use the given path as fruitmix root directory.
--smb                         use smb
--dlna                        use dlna
--transmission                use transmission
--webtorrent                  use webtorrent


@module createApp
*/

let isRoot = process.getuid && process.getuid() === 0 
let args = (getArgs(process.argv)).options

console.log(args)

// only standalone && fruitmix-only mode allows non-priviledged user
if (!(args.standalone && args["fruitmix-only"]) && !isRoot) 
  throw new Error('boot module requires root priviledge')

if (args.smb && !isRoot) throw new Error('smb feature requires root priviledge')
if (args.dlna && !isRoot) throw new Error('dlna feature requires root priviledge')
if (args.transmission && !isRoot) throw new Error('transmission feature requires root priviledge')

let fruitmixOpts = {
  smb: !!args.smb, 
  dlna: !!args.dlna,
  transmission: !!args.transmission
}

let fruitmixDir = path.join(process.cwd(), 'tmptest')

let appOpts

// in standalone mode
if (args.standalone) {
  if (args["fruitmix-only"]) {
    if (args["fruitmix-dir"]) {
      fruitmixOpts.fruitmixDir = args["fruitmix-dir"]
    } else {
      let cwd = process.cwd()
      let tmptest = path.join(cwd, 'tmptest')
      mkdirp.sync(tmptest)
      fruitmixOpts.fruitmixDir = tmptest
    }

    let fruitmix = new Fruitmix(fruitmixOpts)
    let app = new App({ fruitmix, useServer: true })
  }
}
