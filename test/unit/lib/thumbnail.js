const Promise = require('bluebird')
const path = require('path')
const EventEmitter = require('events')

const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

const Thumbnail = require('src/lib/thumbnail2')

const cwd = process.cwd()
const froot = path.join(cwd, 'tmptest')

const vpaiFingerprint = '529e471a71866e439d8892179e4a702cf8529ff32771fcf4654cfdcea68c11fb'
const vpaiFile = path.join(cwd, 'testdata', 'vpai001.jpg')

const pluck = (obj, names) => names.reduce((o, n) => (o[n] = obj[n], o), {})

describe(path.basename(__filename), () => {

  describe('constructor', () => {

    beforeEach(async () => {
      await rimrafAsync(froot)
      await mkdirpAsync(froot)
    })

    it('construct new thumbnail', done => {

      let thumbDir = path.join(path.join(froot, 'thumbnail'))
      let tmpDir = path.join(path.join(froot, 'tmp'))
      let thumb = new Thumbnail(thumbDir, tmpDir)
   
      let names = ['thumbDir', 'tmpDir', 
        'pending', 'converting', 'renaming', 
        'concurrency', 'destroyed' ] 

      expect(pluck(thumb, names)).to.deep.equal({ thumbDir, tmpDir, 
        pending: [], converting: [], renaming: [], concurrency: 4, destroyed: false })
      
      done() 
    })
  }) 

  describe('methods', () => {

    let thumbDir = path.join(path.join(froot, 'thumbnail'))
    let tmpDir = path.join(path.join(froot, 'tmp'))
    let thumb
 
    beforeEach(async () => {
      await rimrafAsync(froot)
      await mkdirpAsync(froot)
      thumb = new Thumbnail(thumbDir, tmpDir)
    })

    it('genProps', done => {
      let query = { width: '160', height: '160' }
      let props = thumb.genProps(vpaiFingerprint, query)  
      // TODO
      let key = "529e471a71866e439d8892179e4a702cf8529ff32771fcf4654cfdcea68c11fb0b1ff93c7c5063ea61b0fbf62889185b4aa290088cddd5acae655591a83c84e4"
      expect(props).to.deep.equal({
        fingerprint: vpaiFingerprint,
        opts: { width: 160, height: 160, autoOrient: undefined, modifier: undefined },
        key,
        path: path.join(thumbDir, key)
      })
      done() 
    })

    it('convert', done => {
      let query = { width: '160', height: '160' }
      let props = thumb.genProps(vpaiFingerprint, query)

      thumb.convert(props, vpaiFile, err => done(err))
      // thumb.on('step', (op, x) => console.log(op, x))
    })

    it('convert many times', done => {
      let query = { width: '160', height: '160' }
      let props = thumb.genProps(vpaiFingerprint, query)

      let count = 5
      thumb.convert(props, vpaiFile, err => (!--count) && done())
      thumb.convert(props, vpaiFile, err => (!--count) && done())
      thumb.convert(props, vpaiFile, err => (!--count) && done())
      thumb.convert(props, vpaiFile, err => (!--count) && done())
      thumb.convert(props, vpaiFile, err => (!--count) && done())

      thumb.on('step', (op, x) => {
        // console.log(op, pluck(thumb, ['pending', 'converting', 'renaming']))
      })

      // console.log(pluck(thumb, ['pending', 'converting', 'renaming']))
    })
  })
})


