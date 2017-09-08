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

  let { alonzo } = FILES

  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
  })

  it('do nothing', done => {
    done()
  })

  it('stream alonzo', done => {

    let filePath = path.join(tmptest, 'alonzo.jpg') 
    let as = new AppendStream(filePath)
    let rs = fs.createReadStream(alonzo.path) 

    as.on('finish', () => {
      expect(as.digest).to.equal(alonzo.hash)
      expect(as.bytesWritten).to.equal(alonzo.size)
      done()
    })

    rs.pipe(as)
  })
})


