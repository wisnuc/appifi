const fs = require('fs')
const child = require('child_process')

const commands = [

  'rm -rf assets',
  'mkdir assets',

  // patch body-parser
  'cp patch/body-parser/1.13.3/urlencoded.js node_modules/body-parser/lib/types/urlencoded.js',
  'base64 node_modules/fs-xattr/build/Release/xattr.node > assets/xattr.node.base64',
  'base64 node_modules/xxhash/build/Release/hash.node > assets/xxhash.node.base64',
]

commands.forEach(item => child.execSync(item))

child.spawnSync('node_modules/.bin/webpack', ['--config', 'backpack.config.js', '-p'], { stdio: 'inherit' })

