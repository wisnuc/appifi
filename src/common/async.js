import fs from 'fs'
import child from 'child_process'

import mkdirp from 'mkdirp'
import rimraf from 'rimraf'
import xattr from 'fs-xattr'

Promise.promisifyAll(fs)
Promise.promisifyAll(child)
Promise.promisifyAll(xattr)

export const mkdirpAsync = Promise.promisify(mkdirp)
export const rimrafAsync = Promise.promisify(rimraf)

export { fs, child, xattr, mkdirp, rimraf }


