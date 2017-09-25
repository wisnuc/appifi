const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')

const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const UUID = require('uuid')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

const { pipeHash, drainHash }  = require('src/lib/tailhash')
const { FILES } = require('test/agent/lib')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

const pluck = (obj, names) => names.reduce((o, n) => (o[n] = obj[n], o), {})

describe(path.basename(__filename), () => {

  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
  })

  Object.keys(FILES).forEach(name => {
    if (FILES[name].size <= 1024 * 1024 * 1024) {
      it(`tailhash ${name}`, function (done) {
        this.timeout(10000)
        let rs = fs.createReadStream(FILES[name].path)
        let tmp = path.join(tmptest, UUID.v4())
        let pipe = pipeHash(rs, tmp, (err, { bytesWritten, hash }) => {
          if (err) done(err)
          let drain = drainHash(hash, bytesWritten, (err, digest) => {
            if (err) done(err)
            expect(digest).to.equal(FILES[name].hash)
            done()
          })
        })
      })
    }
  })

})

