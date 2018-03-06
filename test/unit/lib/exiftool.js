const Promise = require('bluebird')
const path = require('path')
const sinon = require('sinon')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

const UUID = require('uuid')

const ExifTool = require('src/lib/exiftool')
const exiftool = require('src/lib/exiftool2')

describe(path.basename(__filename), () => {

  it('test vpai jpg', done => {
    exiftool('testdata/vpai001.jpg', 'JPEG', (err, metadata) => {
      if (err) return done(err)
      expect(metadata).to.deep.equal({ 
        m: 'JPEG',
        w: 4624,
        h: 2608,
        orient: 1,
        date: '2017:06:17 17:31:18',
        make: 'Sony',
        model: 'G3116',
        gps: `31 deg 10' 50.67" N, 121 deg 36' 2.80" E`,
        size: 4192863 
      })
      done()      
    })
  })

  it('test png HD PNG', done => {
    exiftool('testdata/pnggradHDrgba.png', 'PNG', (err, metadata) => {
      if (err) return done(err)
      expect(metadata).to.deep.equal({
        m: 'PNG',
        w: 1920,
        h: 1080,
        size: 22002
      })
      done() 
    })
  })

  it('test tumblr GIF', done => {
    exiftool('testdata/tumblr.gif', 'GIF', (err, metadata) => {
      if (err) return done(err)
      expect(metadata).to.deep.equal({
        m: 'GIF',
        w: 660,
        h: 361,
        size: 207320
      })
      done()      
    })
  })

  it('test Sony 3GP', done => {
    exiftool('testdata/sony_3gp_1080p.mp4', '3GP', (err, metadata) => {
      if (err) return done(err)
      expect(metadata).to.deep.equal({ 
        m: '3GP',
        w: 1920,
        h: 1080,
        date: '2017:10:31 05:50:12',
        dur: 1.866,
        rot: 0,
        size: 4058566 
      })
      done()
    })
  })

  it('test Sony MP4', done => {
    exiftool('testdata/sony_mp4_vga.mp4', 'MP4', (err, metadata) => {
      if (err) return done(err)
      expect(metadata).to.deep.equal({ 
        m: 'MP4',
        w: 640,
        h: 480,
        date: '2017:10:31 05:44:11',
        dur: 3.466,
        rot: 0,
        size: 1993214 
      })
      done()
    })
  })

  it('test iPhone MOV', done => {
    exiftool('testdata/iphone7_1080p_4to3.mov', 'MOV', (err, metadata) => {
      if (err) return done(err)
      expect(metadata).to.deep.equal({ 
        m: 'MOV',
        w: 1440,
        h: 1080,
        date: '2016:10:31 06:55:09',
        datec: '2016:10:31 14:55:09+08:00',
        make: 'Apple',
        model: 'iPhone 7',
        gps: `31 deg 11' 28.68" N, 121 deg 17' 50.64" E`,
        dur: 2.135,
        rot: 0,
        size: 2350439 
      })
      done()      
    })
  })

  it('test noMakeModel, f0b6fb81', done => {
    exiftool('testdata/noMakeModel.jpg', 'JPEG', (err, metadata) => {
      if (err) return done(err)
      expect(metadata).to.deep.equal({
        m: 'JPEG', 
        w: 960, 
        h: 720, 
        orient: 0, 
        size: 63669 
      })
      done()
    })
  })

  it('test mysterious 1663 (no create date), b61c5208', done => {
    exiftool('testdata/1663.jpg', 'JPEG', (err, metadata) => {
      if (err) return done(err)
      expect(metadata).to.deep.equal({ 
        m: 'JPEG',
        w: 391,
        h: 480,
        orient: 1,
        make: 'NORITSU KOKI',
        model: 'QSS-32_33',
        size: 132716 
      })
      done()
    })
  }) 
})






