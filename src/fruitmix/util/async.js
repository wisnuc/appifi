import Promise from 'bluebird'

import mkdirp from 'mkdirp'
import rimraf from 'rimraf'
import fs from 'fs'
import xattr from 'fs-xattr'

Promise.promisifyAll(fs)
Promise.promisifyAll(xattr)

export const mkdirpAsync = Promise.promisify(mkdirp)
export const rimrafAsync = Promise.promisify(rimraf)

export { fs, xattr }


