import fs from 'fs'
import xattr from 'fs-xattr'
import mkdirp from 'mkdirp'
import rimraf from 'rimraf'

Promise.promisifyAll(fs)
Promise.promisifyAll(xattr)

export const mkdirpAsync = Promise.promisify(mkdirp)
export const rimrafAsync = Promise.promisify(rimraf)

export { mkdirp, rimraf }


