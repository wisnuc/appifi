const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))

const createBigFileAsync = Promise.promisify(require('./createBigFile'))
const { 
  btrfsCloneAsync, btrfsCloneAndAppendAsync, btrfsCloneAndTruncateAsync, btrfsConcatAsync 
} = require('./btrfs')

const join = name => path.join('test-files', name)

const createTestFilesAsync = async () => {

  await rimrafAsync('test-files')
  await mkdirpAsync('test-files')

  // create zero file
  await fs.closeAsync(await fs.openAsync(join('zero'), 'w'))

  // create one-byte file
  // await fs.writeFileAsync(join('one-byte-1'), '1')

  // create one-byte-x file
  await fs.writeFileAsync(join('one-byte-x'), 'x')

  // create half-giga
  await createBigFileAsync(join('half-giga'), 1024 * 1024 * 1024 / 2, '')

  // create from scratch
  // await createBigFileAsync(join('one-giga'), 1024 * 1024 * 1024, '')
  // dup and concat
  await btrfsCloneAsync(join('one-giga'), join('half-giga'))
  await btrfsConcatAsync(join('one-giga'), join('half-giga'))

  // plus x
  await btrfsCloneAndAppendAsync(join('one-giga-plus-x'), join('one-giga'), Buffer.from('x'))

  // minus 1
  await btrfsCloneAndTruncateAsync(join('one-giga-minus-1'), join('one-giga'), 1)

  // one and a half
  await btrfsCloneAsync(join('one-and-a-half-giga'), join('one-giga'))
  await btrfsConcatAsync(join('one-and-a-half-giga'), join('half-giga'))

  // two giga
  await btrfsCloneAsync(join('two-giga'), join('one-giga'))
  await btrfsConcatAsync(join('two-giga'), join('one-giga'))
 
  // two giga plus x 
  await btrfsCloneAndAppendAsync(join('two-giga-plus-x'), join('two-giga'), Buffer.from('x'))

  // two giga minus 1
  await btrfsCloneAndTruncateAsync(join('two-giga-minus-1'), join('two-giga'), 1)

  // two and a half
  await btrfsCloneAsync(join('two-and-a-half-giga'), join('two-giga'))
  await btrfsConcatAsync(join('two-and-a-half-giga'), join('half-giga'))

  // three giga
  await btrfsCloneAsync(join('three-giga'), join('two-giga'))
  await btrfsConcatAsync(join('three-giga'), join('one-giga'))

  // three giga plus x
  await btrfsCloneAndAppendAsync(join('three-giga-plus-x'), join('three-giga'), Buffer.from('x'))

  // three giga minus 1
  await btrfsCloneAndTruncateAsync(join('three-giga-minus-1'), join('three-giga'), 1)

  // three and a half
  await btrfsCloneAsync(join('three-and-a-half-giga'), join('three-giga'))
  await btrfsConcatAsync(join('three-and-a-half-giga'), join('half-giga'))

  // 4 giga
  await btrfsCloneAsync(join('four-giga'), join('two-giga'))
  await btrfsConcatAsync(join('four-giga'), join('two-giga'))

  // 5 giga
  await btrfsCloneAsync(join('five-giga'), join('four-giga')) 
  await btrfsConcatAsync(join('five-giga'), join('one-giga'))
}

const createTestFiles = callback =>
  createTestFilesAsync()
    .then(() => callback())
    .catch(e => callback(e))

module.exports = { createTestFiles, createTestFilesAsync }

if (process.argv.find(arg => arg.endsWith('src/utils/createTestFiles.js'))) {
  createTestFilesAsync().then(() => console.log('test-files generated'), e => console.log(e))
}



