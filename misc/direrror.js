const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))

const testAsync = async () => {

  let stats

  await rimrafAsync('tmptest')
  await mkdirpAsync('tmptest/hello/world')

  stats = await fs.lstatAsync('tmptest/hello/world')
  console.log('tmptest/hello/world stats', stats)

  await rimrafAsync('tmptest')
  await mkdirpAsync('tmptest/hello')
  await child.execAsync('touch tmptest/hello/world')

  try {
    stats = await fs.lstatAsync('tmptest/hello/world')
  } 
  catch (e) {
    console.log('when tmptest/hello/world world is a file', e.code)
  }

  await rimrafAsync('tmptest')
  await mkdirpAsync('tmptest/hello')

  try {
    stats = await fs.lstatAsync('tmptest/hello/world')
  } 
  catch (e) {
    console.log('when tmptest/hello hello is dir', e.code)
  }

  await rimrafAsync('tmptest')
  await mkdirpAsync('tmptest')
  await child.execAsync('touch tmptest/hello')

  try {
    stats = await fs.lstatAsync('tmptest/hello/world')
  } 
  catch (e) {
    console.log('when tmptest/hello hello is a file', e.code)
  }

  await rimrafAsync('tmptest')
  await mkdirpAsync('tmptest')

  try {
    stats = await fs.lstatAsync('tmptest/hello/world')
  } 
  catch (e) {
    console.log('when tmptest tmptest is a dir', e.code)
  }

  await rimrafAsync('tmptest')
  await child.execAsync('touch tmptest')

  try {
    stats = await fs.lstatAsync('tmptest/hello/world')
  } 
  catch (e) {
    console.log('when tmptest tmptest is a file', e.code)
  }
}

testAsync().then(() => null, () => null)
