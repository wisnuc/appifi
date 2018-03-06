import path from 'path'
import fs from 'fs'
import child from 'child_process'

import UUID from 'node-uuid'
import mkdirp from 'mkdirp'
import rimraf from 'rimraf'
import xattr from 'fs-xattr'

Promise.promisifyAll(fs)
Promise.promisifyAll(child)
Promise.promisifyAll(xattr)

export const mkdirpAsync = Promise.promisify(mkdirp)
export const rimrafAsync = Promise.promisify(rimraf)

export { fs, child, xattr, mkdirp, rimraf }

const writeObject = (target, tmpdir, obj, callback) => {

  let buf, err, os, tmp

  try {
    buf = JSON.stringify(obj, null, '  ')
  }
  catch (e) {
    process.nextTick(() => callback(e))
    return
  }

  let tmpPath = path.join(tmpdir, UUID.v4())
  os = fs.createWriteStream(tmpPath)
  os.on('error', e => callback(err = e))
  os.on('close', () => err || fs.rename(tmpPath, target, err => callback(err)))
  os.write(buf)
  os.end()
}

export const writeObjectAsync = Promise.promisify(writeObject)


