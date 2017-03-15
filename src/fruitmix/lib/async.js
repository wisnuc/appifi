var fs = require('fs')
var mkdirp = require('mkdirp')
var rimraf = require('rimraf')
var xattr = require('fs-xattr')
var Promise = require('bluebird')

Promise.promisifyAll(fs)
Promise.promisifyAll(xattr)

const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

module.exports = { mkdirp, mkdirpAsync, rimraf, rimrafAsync }


