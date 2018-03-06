const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs-extra'))
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

const { createTestFilesAsync } = require('src/utils/createTestFiles')
const fingerprintSimpleAsync = Promise.promisify(require('src/utils/fingerprintSimple'))

const fileCopy = require('src/forest/filecopy')

describe(path.basename(__filename), () => {


  // let fp = {}

  let fp = { 
    'five-giga': '757deb7202aa7b81656922322320241fc9cc6d8b5bb7ff60bdb823c72e7ca2fd',
    'half-giga': '767c649bbc1535e53afe18d1d9e21828d36262eac19d60cc3035636e9bc3cdbb',
    'one-and-a-half-giga': 'd723ceb8be2c0f65b3ba359218553187f409f0bbb2ffd6a8f03464aa7dba46f5',
    'one-byte': '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b',
    'one-giga': 'a728498b7d120ea93ff32f548df489e7e9feeefd5dab7124c12ee3e49ff84a91',
    'one-giga-minus-1': 'dfbe42ebd0867f5dc8dc602f035237e88984c93a4e0a7ad7f92f462e326fa6f2',
    'one-giga-plus-x': '9813e8dea92f5d5d2c422aa5191c29694531f012c13229fa65c90bb5538b0c6b',
    'two-giga': 'cf2981f9b932019aaa35122cbecd5cdd66421673d3a640ea2c34601d6c9d3a12',
    'two-giga-minus-1': '881e4980ed2d54067f5c534513b43f408040a615731c9eb76c06ff4945a3e3ae',
    'two-giga-plus-x': '38a664204a7253ef6f6b66bd8162170115d1661cde6a265c4d81c583ac675203',
    'zero': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' 
  }


  before(async function () {
    this.timeout(0)
    await rimrafAsync('test-files')
    await rimrafAsync('tmptest')
    await mkdirpAsync('test-files')
    await mkdirpAsync('tmptest')

    await createTestFilesAsync()

/**
    let entries = await fs.readdirAsync('test-files') 
    for (let i = 0; i < entries.length; i++) {
      fp[entries[i]] = await fingerprintSimpleAsync(path.join('test-files', entries[i])) 
    }

    Object.freeze(fp)
**/
  })

  it('copy zero', function (done) {
    this.timeout(0)
    fileCopy('test-files/zero', 'tmptest/zero', (err, fingerprint) => {
      expect(fingerprint).to.equal(fp['zero'])
      done() 
    })
  })

  it('copy one-byte', function (done) {
    this.timeout(0)
    fileCopy('test-files/one-byte', 'tmptest/one-byte', (err, fingerprint) => {
      expect(fingerprint).to.equal(fp['one-byte'])
      done() 
    })
  })


  it('copy half-giga', function (done) {
    this.timeout(0)
    fileCopy('test-files/half-giga', 'tmptest/half-giga', (err, fingerprint) => {
      expect(fingerprint).to.equal(fp['half-giga'])
      done() 
    })
  })

  it('copy one-giga-minus-1', function (done) {
    this.timeout(0)
    fileCopy('test-files/one-giga-minus-1', 'tmptest/one-giga-minus-1', (err, fingerprint) => {
      expect(fingerprint).to.equal(fp['one-giga-minus-1'])
      done() 
    })
  })
 
  it('copy one-giga', function (done) {
    this.timeout(0)
    fileCopy('test-files/one-giga', 'tmptest/one-giga', (err, fingerprint) => {
      expect(fingerprint).to.equal(fp['one-giga'])
      done() 
    })
  })

  it('copy one-giga-plus-x', function (done) {
    this.timeout(0)
    fileCopy('test-files/one-giga-plus-x', 'tmptest/one-giga-plus-x', (err, fingerprint) => {
      expect(fingerprint).to.equal(fp['one-giga-plus-x'])
      done() 
    })
  })

  it('copy two-giga-plus-x', function (done) {
    this.timeout(0)
    fileCopy('test-files/two-giga-plus-x', 'tmptest/two-giga-plus-x', (err, fingerprint) => {
      expect(fingerprint).to.equal(fp['two-giga-plus-x'])
      done() 
    })
  })

  it('copy all', async function () {
    this.timeout(0)
    let entries = await fs.readdir('test-files')
    let promises = entries.map(async entry => new Promise((resolve, reject) => {
      fileCopy(path.join('test-files', entry), path.join('tmptest', entry), (err, fingerprint) => {
        err ? reject(err) : resolve([entry, fingerprint])
      }) 
    }))

    let r = await Promise.all(promises) 
    let obj = {}
    r.forEach(pair => obj[pair[0]] = pair[1])

    console.log(obj, fp)

    expect(obj).to.deep.equal(fp)
  })
})

