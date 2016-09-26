var fs = require('fs')

let xxhashBase64, xxhash, xattrBase64, xattr, bundlejs, indexHtml, robotoCSS, styleCSS, 
  robotoThinBase64, robotoThin, robotoLightBase64, robotoLight,
  robotoRegularBase64, robotoRegular, robotoMediumBase64, robotoMedium,
  robotoBoldBase64, robotoBold, robotoBlackBase64, robotoBlack

if (global.WEBPACK) {

  xxhashBase64 = require('raw!./assets/xxhash.node.base64')
  xattrBase64 = require('raw!./assets/xattr.node.base64')

  robotoThinBase64 = require('raw!./assets/robotoThin.base64')
  robotoLightBase64 = require('raw!./assets/robotoLight.base64')
  robotoRegularBase64 = require('raw!./assets/robotoRegular.base64')
  robotoMediumBase64 = require('raw!./assets/robotoMedium.base64')
  robotoBoldBase64 = require('raw!./assets/robotoBold.base64')
  robotoBlackBase64 = require('raw!./assets/robotoBlack.base64')

  bundlejs = require('raw!./assets/bundle.js.raw')
  indexHtml = require('raw!./assets/index.html.raw')

  robotoCSS = require('raw!./assets/roboto.css.raw')
  styleCSS = require('raw!./assets/style.css.raw')
}

if (xxhashBase64) {
  let decode = Buffer.from(xxhashBase64.toString(), 'base64')
  fs.writeFileSync('./xxhash.node', decode)
  xxhash = require('xxhash')

  console.log('hash hash')
  console.log(xxhash.hash(Buffer.from('hello'), 1234))
}

if (xattrBase64) {
  let decode = Buffer.from(xattrBase64.toString(), 'base64')
  fs.writeFileSync('./xattr.node', decode)
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

console.log('assets loaded')

module.exports = {
  bundlejs, indexHtml, robotoCSS, styleCSS,
  robotoThin, robotoLight, robotoRegular, robotoMedium, robotoBold, robotoBlack  
}

setTimeout(() => require('./src/app'), 1000)
