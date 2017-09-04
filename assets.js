const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')

let xxhashBase64, xxhash, xattrBase64, xattr

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

require('./src/app')
