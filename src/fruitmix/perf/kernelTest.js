import path from 'path'
import fs from 'fs'
import child from 'child_process'

import Promise from 'bluebird'

import rimraf from 'rimraf'
import mkdirp from 'mkdirp'
import xattr from 'fs-xattr'
import UUID from 'node-uuid'

import { createDrive } from '../lib/drive'

const rimrafAsync = Promise.promisify(rimraf)
const mkdirpAsync = Promise.promisify(mkdirp)
const createDriveAsync = Promise.promisify(createDrive)

Promise.promisifyAll(fs)
Promise.promisifyAll(xattr)

const FRUITMIX = 'user.fruitmix'
const cwd = process.cwd()
const TMPDIR = path.join(cwd, 'tmptest')
const KERNEL_TARBALL = path.join(cwd, 'testdata/linux-4.7.tar.xz')


const preset = JSON.stringify({
  uuid: UUID.v4(),
  owner: [UUID.v4()],
  writelist:[],
  readlist: []
})

const pretty = (num) => (num / 1024 / 1024)

async function test() {

  console.log(`removing ${TMPDIR}`)
  await rimrafAsync(TMPDIR)

  console.log(`mkdir ${TMPDIR}`)
  await mkdirp(TMPDIR)

  console.log(`set xattr`)
  await xattr.setAsync(TMPDIR, FRUITMIX, preset)

  console.log(`untar`)
  await Promise.promisify(child.exec)(`tar xf ${KERNEL_TARBALL} -C ${TMPDIR} --strip-components=1`)
 
  console.log('create drive') 
  let drive = await createDriveAsync(TMPDIR)

  let before = process.memoryUsage()

  console.log('starting scan')
  await new Promise((resolve, reject) => 
    drive.scan((err) => err? reject(err) : resolve(null)))

  let after = process.memoryUsage()

  console.log('delta rss: ' + pretty(after.rss - before.rss))
  console.log('delta heapTotal: ' + pretty(after.heapTotal - before.heapTotal))
  console.log('delta heapUsed: ' + pretty(after.heapUsed - before.heapUsed))
}

test()
  .then(() => { console.log('end') })
  .catch(e => console.log(e))
