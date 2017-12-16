const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))

const test = async () => {

  await rimrafAsync('tmptest') 
  await mkdirpAsync('tmptest/hello')

  await fs.mkdirAsync('tmptest/hello/world')
  console.log('mkdir tmptest/hello/world success')

  await rimrafAsync('tmptest')

  try {
    await fs.mkdirAsync('tmptest/hello/world')
  }
  catch (e) {
    console.log(`tmptest, mkdir tmptest/hello/world, ${e.code}`)
  }
}

test().then(x => x, x => x)
