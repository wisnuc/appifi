const Promise = require('bluebird')
const path = require('path')
const EventEmitter = require('events')

const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

const Thumbnail = require('src/lib/thumbnail')

const cwd = process.cwd()
const fruitmixPath = path.join(cwd, 'tmptest')

const vpaiFingerprint = '529e471a71866e439d8892179e4a702cf8529ff32771fcf4654cfdcea68c11fb'
const vpaiFile = path.join(cwd, 'testdata', 'vpai001.jpg')

describe(path.basename(__filename), () => {

  let retrieveFiles = () => []

  beforeEach(async () => {
    await rimrafAsync(fruitmixPath)
    await mkdirpAsync(fruitmixPath)
  })

  describe('do something', () => {

    it('do nothing', done => {
      let thumbnail = new Thumbnail(fruitmixPath, 116) 
      done()
    })

    it('request should return EABORT error if thumbnailer aborted', async () => {

      let thumbnail = new Thumbnail(fruitmixPath, 116, retrieveFiles) 
      thumbnail.abort()

      try {
        await thumbnail.requestAsync(vpaiFingerprint, { width: 160, height: 160 }, [])
        throw new Error('should throw error')
      } catch (e) {
        expect(e).to.be.an('error')
        expect(e.code).to.equal('EABORT')
      }
    })

    it('request should return EABORT error after abort 2', async () => {

      let thumbnail = new Thumbnail(fruitmixPath, 116, retrieveFiles) 
      let r = await thumbnail.requestAsync(vpaiFingerprint, { width: 160, height: 160 }, [vpaiFile])

      expect(r instanceof EventEmitter).to.be.true

      let thumb = await new Promise((res, rej) => r.on('finish', (err, thumb) => err ? rej(err) : res(thumb)))

      // TODO 
    })
  }) 
})
