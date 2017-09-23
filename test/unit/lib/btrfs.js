const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const UUID = require('uuid')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

const debug = require('debug')('test-btrfs')

const fingerprint = require('src/lib/fingerprintSync')
const { btrfsClone } = require('src/lib/btrfs')
const { FILES } = require('test/agent/lib')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

describe(path.basename(__filename), () => {

  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
  })

/**

  it('clone alonzo', done => {
    let target = path.join(tmptest, UUID.v4())
    btrfsClone(target, [FILES.alonzo.path], err => {
      if (err) return done(err)

      let hash = crypto.createHash('sha256') 
      let rs = fs.createReadStream(target)
      rs.on('data', data => hash.update(data))
      rs.on('close', () => {
        let digest = hash.digest('hex')
        expect(digest).to.equal(FILES.alonzo.hash)
        done()
      })
    })
  }) 

  it('clone empty', done => {
    let target = path.join(tmptest, UUID.v4())
    btrfsClone(target, [FILES.empty.path], err => {
      if (err) return done(err)
      let hash = crypto.createHash('sha256') 
      let rs = fs.createReadStream(target)
      rs.on('data', data => hash.update(data))
      rs.on('close', () => {
        let digest = hash.digest('hex')
        expect(digest).to.equal(FILES.empty.hash)
        done()
      })
    })
  })

  it('clone empty and alonzo', done => {
    let target = path.join(tmptest, UUID.v4())
    btrfsClone(target, [FILES.empty.path, FILES.alonzo.path], err => {
      if (err) return done(err)
      let hash = crypto.createHash('sha256') 
      let rs = fs.createReadStream(target)
      rs.on('data', data => hash.update(data))
      rs.on('close', () => {
        let digest = hash.digest('hex')
        expect(digest).to.equal(FILES.alonzo.hash)
        done()
      })
    })
  }) 
**/

  // clone single
  Object.keys(FILES).forEach(x => it(`clone ${x}`, function(done) {
    this.timeout(0)
    let target = path.join(tmptest, UUID.v4()) 
    btrfsClone(target, [FILES[x].path], err => {
      if (err) return done(err)
      fingerprint(target, (err, hash) => {
        if (err) return done(err)
        expect(hash).to.equal(FILES[x].hash)
        done()
      })
    })
  }))

  // clone two
  let xs = [
    ['empty', 'empty', 'empty'],
    ['empty', 'oneByteX', 'oneByteX'],
    ['empty', 'halfGiga', 'halfGiga'],
    ['empty', 'oneGigaMinus1', 'oneGigaMinus1'],
    ['empty', 'oneGiga', 'oneGiga'],
    ['oneGiga', 'empty', 'oneGiga'],
    ['oneGiga', 'oneByteX', 'oneGigaPlusX'],
    ['oneGiga', 'halfGiga', 'oneAndAHalfGiga'],
    ['oneGiga', 'oneGigaMinus1', 'twoGigaMinus1'],
    ['oneGiga', 'oneGiga', 'twoGiga'],
    ['twoGiga', 'empty', 'twoGiga'],
    ['twoGiga', 'oneByteX', 'twoGigaPlusX'],
    ['twoGiga', 'halfGiga', 'twoAndAHalfGiga'],
    ['twoGiga', 'oneGigaMinus1', 'threeGigaMinus1'],
    ['twoGiga', 'oneGiga', 'threeGiga']
  ]

  xs.forEach(x => it(`${x[0]} + ${x[1]} = ${x[2]}`, function(done) {
    this.timeout(0)
    let target = path.join(tmptest, UUID.v4()) 
    btrfsClone(target, [FILES[x[0]].path, FILES[x[1]].path], err => {
      if (err) return done(err)
      fingerprint(target, (err, hash) => {
        if (err) return done(err)
        expect(hash).to.equal(FILES[x[2]].hash)
        done()
      })
    })
  }))

/**
  it('clone x to one-giga, e0d398aa', function(done) {
    this.timeout(0)
    let target = path.join(tmptest, UUID.v4()) 
    btrfsClone(target, [FILES.oneGiga.path, FILES.oneByteX.path], err => {
      if (err) return done(err)
      fingerprint(target, (err, hash) => {
        if (err) return done(err)
        expect(hash).to.equal(FILES.oneGigaPlusX.hash)
        done()
      })
    })
  })
**/

  // need more negative tests FIXME
})
