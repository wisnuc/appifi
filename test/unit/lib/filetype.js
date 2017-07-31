const Promise = require('bluebird')
const path = require('path')

const fileType = require('src/lib/filetype')

const UUID = require('uuid')
const sinon = require('sinon')
const chai = require('chai')

chai.use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

describe(path.basename(__filename), () => {

  it('should report jpg file as jpg and image/jpeg', done => {
    let fpath = path.join(process.cwd(), 'testdata', 'vpai001.jpg')
    fileType(fpath, (err, type) => {
      if (err) return done(err)
      expect(type).to.deep.equal({ ext: 'jpg', mime: 'image/jpeg' })
      done()
    })
  })

  it('should report hello as null', done => {
    let fpath = path.join(process.cwd(), 'testdata', 'hello')
    fileType(fpath, (err, type) => {
      if (err) return done(err)
      expect(type).to.be.null
      done()
    })
  })

  it('should report empty file as null', done => {
    let fpath = path.join(process.cwd(), 'testdata', 'empty')
    fileType(fpath, (err, type) => {
      if (err) return done(err)
      expect(type).to.be.null
      done()
    })
  })

  it('should return EISDIR error for folder', done => {
    let fpath = path.join(process.cwd(), 'testdata')
    fileType(fpath, (err, type) => {
      expect(err).to.be.an.error
      expect(err.code).to.equal('EISDIR')
      done()
    })
  })

  it('should return ENOENT error for non-existent file', done => {
    let fpath = path.join(process.cwd(), 'testdata', UUID.v4())
    fileType(fpath, (err, type) => {
      expect(err).to.be.an.error
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })
})

