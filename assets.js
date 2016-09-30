var path = require('path')
var fs = require('fs')
var mkdirp = require('mkdirp')

let xxhashBase64, xxhash, xattrBase64, xattr, bundlejs, indexHtml, robotoCSS, styleCSS, 
  robotoThinBase64, robotoThin, robotoLightBase64, robotoLight,
  robotoRegularBase64, robotoRegular, robotoMediumBase64, robotoMedium,
  robotoBoldBase64, robotoBold, robotoBlackBase64, robotoBlack, faviconBase64, favicon

if (global.WEBPACK) {

  xxhashBase64 = require('raw!./assets/xxhash.node.base64')
  xattrBase64 = require('raw!./assets/xattr.node.base64')

  robotoThinBase64 = require('raw!./assets/robotoThin.base64')
  robotoLightBase64 = require('raw!./assets/robotoLight.base64')
  robotoRegularBase64 = require('raw!./assets/robotoRegular.base64')
  robotoMediumBase64 = require('raw!./assets/robotoMedium.base64')
  robotoBoldBase64 = require('raw!./assets/robotoBold.base64')
  robotoBlackBase64 = require('raw!./assets/robotoBlack.base64')
  faviconBase64 = require('raw!./assets/favicon.base64')

  bundlejs = require('raw!./assets/bundle.js.raw')
  indexHtml = require('raw!./assets/index.html.raw')

  robotoCSS = require('raw!./assets/roboto.css.raw')
  styleCSS = require('raw!./assets/style.css.raw')
}

const dir = 'bin'

if (xxhashBase64) {

  mkdirp.sync(dir)

  let decode = Buffer.from(xxhashBase64.toString(), 'base64')
  fs.writeFileSync(path.join(dir, 'xxhash.node'), decode)

  // test xxhash
  const XXHASH = require('xxhash')
  console.log('test xxhash: ' + XXHASH.hash(Buffer.from('hello'), 1234))
}

if (xattrBase64) {

  mkdirp.sync(dir)

  let decode = Buffer.from(xattrBase64.toString(), 'base64')
  fs.writeFileSync(path.join(dir, 'xattr.node'), decode)

  // test xattr
  const XATTR = require('fs-xattr')
  XATTR.setSync(dir, 'user.foo', 'bar')
  console.log('test xattr: ' + XATTR.getSync(dir, 'user.foo'))
  XATTR.removeSync(dir, 'user.foo')
}

function loadFont (base64, name) {

  if (base64) 
    return Buffer.from(base64, 'base64')
  else
    return fs.readFileSync('./public/stylesheets/Roboto-' + name + '-webfont.woff')
}

robotoThin = loadFont(robotoThinBase64, 'Thin')
robotoLight = loadFont(robotoLightBase64, 'Light')
robotoRegular = loadFont(robotoRegularBase64, 'Regular')
robotoMedium = loadFont(robotoMediumBase64, 'Medium')
robotoBold = loadFont(robotoBoldBase64, 'Bold')
robotoBlack = loadFont(robotoBlackBase64, 'Black')

if (!bundlejs) {
  bundlejs = fs.readFileSync('./public/bundle.js').toString()
}

if (!indexHtml) {
  indexHtml = fs.readFileSync('./public/index.html').toString()
}

if (!robotoCSS) {
  robotoCSS = fs.readFileSync('./public/stylesheets/roboto.css')
}

if (!styleCSS) {
  styleCSS = fs.readFileSync('./public/stylesheets/style.css')
}

if (!favicon) {
  favicon = fs.readFileSync('./public/favicon.ico') 
}

console.log('assets loaded')

module.exports = {
  bundlejs, indexHtml, robotoCSS, styleCSS,
  robotoThin, robotoLight, robotoRegular, robotoMedium, robotoBold, robotoBlack,
  favicon
}

// setTimeout(() => require('./src/app'), 1000)
