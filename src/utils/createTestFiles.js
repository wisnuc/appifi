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
  await fs.writeFileAsync(join('one-byte'), '1')

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

  // 2 giga
  await btrfsCloneAsync(join('two-giga'), join('one-giga'))
  await btrfsConcatAsync(join('two-giga'), join('one-giga'))
 
  // 2 giga plus x 
  await btrfsCloneAndAppendAsync(join('two-giga-plus-x'), join('two-giga'), Buffer.from('x'))

  // 2 giga minus 1
  await btrfsCloneAndTruncateAsync(join('two-giga-minus-1'), join('two-giga'), 1)

  // 5 giga
  await btrfsCloneAsync(join('five-giga'), join('two-giga')) 
  await btrfsConcatAsync(join('five-giga'), join('two-giga'))
  await btrfsConcatAsync(join('five-giga'), join('one-giga'))
}

const createTestFiles = callback =>
  createTestFilesAsync()
    .then(() => callback())
    .catch(e => callback(e))

module.exports = { createTestFiles, createTestFilesAsync }

