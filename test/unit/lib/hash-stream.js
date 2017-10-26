const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')
const crypto = require('crypto')

const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const UUID = require('uuid')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

const HS = require('src/lib/hash-stream')
const { FILES } = require('test/agent/lib')
const { alonzo, vpai001, empty } = FILES

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmpfile = path.join(tmptest, 'tmpfile')
const postfile = path.join(tmptest, 'postfile')

const pluck = (obj, names) => names.reduce((o, n) => (o[n] = obj[n], o), {})

const createPostFile = (origPath, hash) => {
  fs.copyFileSync(origPath, postfile)
  fs.writeFileSync(postfile, Buffer.from(hash, 'hex'), { flag: 'a' }) 
} 

describe(path.basename(__filename), () => {

  describe('test ipre stream', () => {
    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmptest)
    })

    it('stream alonzo should succeed, f9404af3', done => {
      let rs = fs.createReadStream(alonzo.path)
      let hs = HS.createStream(rs, tmpfile, alonzo.size, alonzo.hash) 
      expect(hs instanceof HS.IPre).to.be.true
      hs.on('finish', err => {
        if (err) return done(err)
        let data = fs.readFileSync(tmpfile)
        expect(data.length).to.equal(alonzo.size)
        expect(crypto.createHash('sha256').update(data).digest('hex')).to.equal(alonzo.hash)

        // internal state
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        done()
      })
    }) 

    it('stream empty should success, 8ba7fcfc', done => {
      let rs = fs.createReadStream(empty.path)
      let hs = HS.createStream(rs, tmpfile, empty.size, empty.hash)
      hs.on('finish', err => {
        if (err) return done(err)
        let data = fs.readFileSync(tmpfile)
        expect(data.length).to.equal(empty.size)
        expect(crypto.createHash('sha256').update(data).digest('hex')).to.equal(empty.hash)

        // internal state
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        done()
      })
    })

    it('stream alonzo with less claimed size should fail with EOVERSIZE, babc0f4f', done => {
      let rs = fs.createReadStream(alonzo.path)
      let hs = HS.createStream(rs, tmpfile, alonzo.size - 1, alonzo.hash)
      hs.on('finish', err => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('EOVERSIZE')
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        done()
      })
    }) 

    it('stream alonzo with more claimed size should fail with EUNDERSIZE, cb084ed4', done => {
      let rs = fs.createReadStream(alonzo.path)
      let hs = HS.createStream(rs, tmpfile, alonzo.size + 1, alonzo.hash)
      hs.on('finish', err => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('EUNDERSIZE')
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        done()
      })
    }) 

    it('stream alonzo with bad sha256 should fail with ESHA256MISMATCH, dc73c2bc', done => {
      let rs = fs.createReadStream(alonzo.path)
      let hs = HS.createStream(rs, tmpfile, alonzo.size, vpai001.hash)
      hs.on('finish', err => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('ESHA256MISMATCH')
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        done()
      })
    })

  })

  describe('test createPostFile', () => {
    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmptest)
    })

    it('create alonzo post file', done => {
      createPostFile(alonzo.path, alonzo.hash)
      let data = fs.readFileSync(postfile)
      expect(data.length).to.equal(alonzo.size + 32)
      let data1 = data.slice(0, alonzo.size)
      let data2 = data.slice(alonzo.size)
      let hash1 = crypto.createHash('sha256').update(data1).digest('hex')
      let hash2 = data2.toString('hex')
      expect(hash1).to.equal(hash2)
      done()
    })
  })

  describe('test ipost stream', () => {
    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmptest)
    })

    it('stream alonzo should succeed, baa65ba6', done => {
      createPostFile(alonzo.path, alonzo.hash)
      let rs = fs.createReadStream(postfile)
      let hs = HS.createStream(rs, tmpfile, alonzo.size)
      expect(hs instanceof HS.IPost).to.be.true
      hs.on('finish', err => {
        if (err) return done(err)
        let data = fs.readFileSync(tmpfile)
        expect(data.length).to.equal(alonzo.size)
        expect(crypto.createHash('sha256').update(data).digest('hex')).to.equal(alonzo.hash)

        // internal
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        done()
      })
    })

    it('stream empty should succeed, de8ec10e', done => {
      createPostFile(empty.path, empty.hash)
      let rs = fs.createReadStream(postfile)
      let hs = HS.createStream(rs, tmpfile, empty.size)
      expect(hs instanceof HS.IPost).to.be.true
      hs.on('finish', err => {
        if (err) return done(err)
        let data = fs.readFileSync(tmpfile)
        expect(data.length).to.equal(empty.size)
        expect(crypto.createHash('sha256').update(data).digest('hex')).to.equal(empty.hash)
        
        // internal
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        done()
      })
    }) 

    it('stream alonzo with less claimed size should fail with EOVERSIZE, c50151af', done => {
      createPostFile(alonzo.path, alonzo.hash)
      let rs = fs.createReadStream(postfile)
      let hs = HS.createStream(rs, tmpfile, alonzo.size - 1)
      expect(hs instanceof HS.IPost).to.be.true
      hs.on('finish', err => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('EOVERSIZE')
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        done()
      })
    }) 

    it('stream alonzo with more claimed size should fail with EUNDERSIZE, 8eacd43b', done => {
      createPostFile(alonzo.path, alonzo.hash)
      let rs = fs.createReadStream(postfile)
      let hs = HS.createStream(rs, tmpfile, alonzo.size + 1)
      hs.on('finish', err => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('EUNDERSIZE')
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        done()
      })
    }) 

    it('stream alonzo with bad sha256 should fail with ESHA256MISMATCH, d42bcd8c', done => {
      createPostFile(alonzo.path, vpai001.hash)
      let rs = fs.createReadStream(postfile)
      let hs = HS.createStream(rs, tmpfile, alonzo.size)
      hs.on('finish', err => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('ESHA256MISMATCH')
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        done()
      })
    })
  })

  describe('test cpre stream', () => {
    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmptest)
    })

    it('stream alonzo should succeed, eb5b52de', done => {
      let rs = fs.createReadStream(alonzo.path)
      let hs = new HS.CPre(rs, tmpfile, alonzo.size, alonzo.hash)
      hs.on('finish', err => {
        if (err) return done(err)
        let data = fs.readFileSync(tmpfile)
        expect(data.length).to.equal(alonzo.size)
        expect(crypto.createHash('sha256').update(data).digest('hex')).to.equal(alonzo.hash)

        // internal state
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        expect(hs.hash).to.be.null
        done()
      })
    })   

    it('stream empty should success, c55fe839', done => {
      let rs = fs.createReadStream(empty.path)
      let hs = new HS.CPre(rs, tmpfile, empty.size, empty.hash)
      hs.on('finish', err => {
        if (err) return done(err)
        let data = fs.readFileSync(tmpfile)
        expect(data.length).to.equal(empty.size)
        expect(crypto.createHash('sha256').update(data).digest('hex')).to.equal(empty.hash)

        // internal state
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        expect(hs.hash).to.be.null
        done()
      })
    })  

    it('stream alonzo with less claimed size should fail with EOVERSIZE, 20ac8b71', done => {
      let rs = fs.createReadStream(alonzo.path)
      let hs = new HS.CPre(rs, tmpfile, alonzo.size - 1, alonzo.hash)
      hs.on('finish', err => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('EOVERSIZE')
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        done()
      })
    }) 

    it('stream alonzo with more claimed size should fail with EUNDERSIZE, 99ce3217', done => {
      let rs = fs.createReadStream(alonzo.path)
      let hs = new HS.CPre(rs, tmpfile, alonzo.size + 1, alonzo.hash)
      hs.on('finish', err => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('EUNDERSIZE')
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        done()
      })
    }) 

    it('stream alonzo with bad sha256 should fail with ESHA256MISMATCH, dc73c2bc', done => {
      let rs = fs.createReadStream(alonzo.path)
      let hs = new HS.CPre(rs, tmpfile, alonzo.size, vpai001.hash)
      hs.on('finish', err => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('ESHA256MISMATCH')
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        done()
      })
    })

  })

  describe('test cpost stream', () => {
    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmptest)
    })

    it('stream alonzo should succeed, 963c4be7', done => {
      createPostFile(alonzo.path, alonzo.hash)
      let rs = fs.createReadStream(postfile)
      let hs = new HS.CPost(rs, tmpfile, alonzo.size)
      hs.on('finish', err => {
        if (err) return done(err)
        let data = fs.readFileSync(tmpfile)
        expect(data.length).to.equal(alonzo.size)
        expect(crypto.createHash('sha256').update(data).digest('hex')).to.equal(alonzo.hash)

        // internal
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        expect(hs.hash).to.be.null
        done()
      })
    })

    it('stream empty should succeed, a3cd4a8c', done => {
      createPostFile(empty.path, empty.hash)
      let rs = fs.createReadStream(postfile)
      let hs = new HS.CPost(rs, tmpfile, empty.size)
      hs.on('finish', err => {
        if (err) return done(err)
        let data = fs.readFileSync(tmpfile)
        expect(data.length).to.equal(empty.size)
        expect(crypto.createHash('sha256').update(data).digest('hex')).to.equal(empty.hash)
        
        // internal
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        expect(hs.hash).to.be.null
        done()
      })
    }) 

    it('stream alonzo with less claimed size should fail with EOVERSIZE, c50151af', done => {
      createPostFile(alonzo.path, alonzo.hash)
      let rs = fs.createReadStream(postfile)
      let hs = new HS.CPost(rs, tmpfile, alonzo.size - 1)
      hs.on('finish', err => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('EOVERSIZE')
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        expect(hs.hash).to.be.null
        done()
      })
    }) 

    it('stream alonzo with more claimed size should fail with EUNDERSIZE, 8eacd43b', done => {
      createPostFile(alonzo.path, alonzo.hash)
      let rs = fs.createReadStream(postfile)
      let hs = new HS.CPost(rs, tmpfile, alonzo.size + 1)
      hs.on('finish', err => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('EUNDERSIZE')
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        expect(hs.hash).to.be.null
        done()
      })
    }) 

    it('stream alonzo with bad sha256 should fail with ESHA256MISMATCH, d42bcd8c', done => {
      createPostFile(alonzo.path, vpai001.hash)
      let rs = fs.createReadStream(postfile)
      let hs = new HS.CPost(rs, tmpfile, alonzo.size)
      hs.on('finish', err => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('ESHA256MISMATCH')
        expect(hs.rs).to.be.null
        expect(hs.ws).to.be.null
        expect(hs.hash).to.be.null
        done()
      })
    })
  })
})



