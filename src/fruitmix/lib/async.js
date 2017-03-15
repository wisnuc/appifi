import fs from 'fs'
import mkdirp from 'mkdirp'
import rimraf from 'rimraf'
import xattr from 'fs-xattr'

Promise.promisifyAll(fs)
Promise.promisifyAll(xattr)

const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

export { mkdirp, mkdirpAsync, rimraf, rimrafAsync }


