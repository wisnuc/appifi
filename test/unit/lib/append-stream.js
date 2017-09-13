const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const path = require('path')
const EventEmitter = require('events')

const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

const AppendStream = require('src/lib/append-stream')
const { FILES } = require('test/agent/lib')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

describe(path.basename(__filename), () => {

  let { alonzo, empty, oneByteX, halfGiga } = FILES

  const genTest = name => function (done) {
    this.timeout(0)
    let x = FILES[name]
    let filePath = path.join(tmptest, name)
    let as = new AppendStream(filePath)
    let rs = fs.createReadStream(x.path)
    as.on('finish', () => {
      expect(as.digest).to.equal(x.hash)
      expect(as.bytesWritten).to.equal(x.size)
      expect(fs.lstatSync(filePath).size).to.equal(x.size)
      done()
    })
    rs.pipe(as)
  }

  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
  })

  it('new alonzo', genTest('alonzo'))
  it('new empty', genTest('empty'))
  it('new oneByteX', genTest('oneByteX'))
  it('new halfGiga', genTest('halfGiga'))
  it('new oneGigaMinus1', genTest('oneGigaMinus1'))
  it('new oneGiga', genTest('oneGiga'))
})


