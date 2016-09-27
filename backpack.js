var fs = require('fs')
var child = require('child_process')

const commands = [

  // clean
  'rm -rf assets',

  // mkdir
  'mkdir assets',

  // patch body-parser
  'cp patch/body-parser/1.13.3/urlencoded.js node_modules/body-parser/lib/types/urlencoded.js',

  // xattr bin
  'base64 node_modules/fs-xattr/build/Release/xattr.node > assets/xattr.node.base64',

  // xxhash bin
  'base64 node_modules/xxhash/build/Release/hash.node > assets/xxhash.node.base64',

  // fonts
  'base64 public/stylesheets/Roboto-Thin-webfont.woff > assets/robotoThin.base64',
  'base64 public/stylesheets/Roboto-Light-webfont.woff > assets/robotoLight.base64',
  'base64 public/stylesheets/Roboto-Regular-webfont.woff > assets/robotoRegular.base64',
  'base64 public/stylesheets/Roboto-Medium-webfont.woff > assets/robotoMedium.base64',
  'base64 public/stylesheets/Roboto-Bold-webfont.woff > assets/robotoBold.base64',
  'base64 public/stylesheets/Roboto-Black-webfont.woff > assets/robotoBlack.base64',
  'base64 public/favicon.ico > assets/favicon.base64',

   // other assets
  'cp public/index.html assets/index.html.raw',
  'cp public/bundle.js assets/bundle.js.raw',
  'cp public/stylesheets/roboto.css assets/roboto.css.raw',
  'cp public/stylesheets/style.css assets/style.css.raw',
]

child.spawnSync('node_modules/.bin/webpack', ['--config', 'webpack.config.js', '-p'], { stdio: 'inherit' })

commands.forEach(item => child.execSync(item))

child.spawnSync('node_modules/.bin/webpack', ['--config', 'backpack.config.js', '-p'], { stdio: 'inherit' })

