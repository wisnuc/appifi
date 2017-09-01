var path = require('path')
var fs = require('fs')
var mkdirp = require('mkdirp')

let xxhashBase64, xxhash, xattrBase64, xattr, bundlejs, indexHtml, robotoCSS, styleCSS, 
  robotoThinBase64, robotoThin, robotoLightBase64, robotoLight,
  robotoRegularBase64, robotoRegular, robotoMediumBase64, robotoMedium,
  robotoBoldBase64, robotoBold, robotoBlackBase64, robotoBlack, faviconBase64, favicon

if (global.WEBPACK) {
  xxhashBase64 = require('raw-loader!./assets/xxhash.node.base64')
  xattrBase64 = require('raw-loader!./assets/xattr.node.base64')
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

console.log('assets loaded')

setTimeout(() => require('./src/app'), 1000)
