import Promise from 'bluebird'

import mkdirp from 'mkdirp'
import rimraf from 'rimraf'
import fs from 'fs'

console.log('async require fs-xattr')
const xattr = require('fs-xattr')

Promise.promisifyAll(fs)
Promise.promisifyAll(xattr)

export const mkdirpAsync = Promise.promisify(mkdirp)
export const rimrafAsync = Promise.promisify(rimraf)

export { fs, xattr }


