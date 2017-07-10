const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const crypto = require('crypto')
const request = require('supertest')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const UUID = require('uuid')

const chai = require('chai').use(require('chai-as-promised'))
const sinon = require('sinon')
const expect = chai.expect
const should = chai.should()

const app = require('src/fruitmix/sidekick/app')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const testdata = path.join(cwd, 'testdata')

const alonzo = {
  path: path.join(testdata, 'alonzo_church.jpg'),
  size: 39499,
  sha256: '8e28737e8cdf679e65714fe2bdbe461c80b2158746f4346b06af75b42f212408' 
}

const fileHashSync = (fpath) => {

  let buf = fs.readFileSync(fpath)
  let hash = crypto.createHash('sha256')
  hash.update(buf)
  return hash.digest('hex')
}

// const sidekick = require('src/fruitmix/lib/sidekick-client')

describe(path.basename(__filename), () => {

  describe("upload a file", () => {

    it("should upload a file (alonzo) w/ sha256", done => {

      let target = path.join(tmptest, UUID.v4())
      fs.createReadStream(alonzo.path)
        .pipe(request(app)
          .put('/upload')
          .query({ path: target }) 
          .query({ size: alonzo.size })
          .query({ sha256: alonzo.sha256 })
          .expect(200)
          .expect(res => {
            expect(res.body).to.deep.equal(Object.assign({}, alonzo, { path: target }))
            done()
          }))
    })

    it("should fail file upload w/ sha256, if size mismatch (409)", done => {
      let target = path.join(tmptest, UUID.v4())
      fs.createReadStream(alonzo.path)
        .pipe(request(app)
          .put('/upload')
          .query({ path: target }) 
          .query({ size: alonzo.size - 1 })
          .query({ sha256: alonzo.sha256 })
          .expect(409)
          .expect(() => done()))
    })

    it("should fail file upload w/ sha256, if sha256 mismatch (409)", done => {

      let target = path.join(tmptest, UUID.v4())
      fs.createReadStream(alonzo.path)
        .pipe(request(app)
          .put('/upload')
          .query({ path: target }) 
          .query({ size: alonzo.size })
          .query({ sha256: 'a' + alonzo.sha256.slice(1) })
          .expect(409)
          .expect(() => done()))
    })

    it("should upload a file (alonzo) w/o sha256", done => {

      let target = path.join(tmptest, UUID.v4())
      fs.createReadStream(alonzo.path)
        .pipe(request(app)
          .put('/upload')
          .query({ path: target }) 
          .query({ size: alonzo.size })
          .expect(res => {
            expect(res.body).to.deep.equal(Object.assign({}, alonzo, { path: target }))
            done()
          }))
    })

    it("should fail file upload w/o sha256, if size mismatch (409)", done => {

      let target = path.join(tmptest, UUID.v4())
      fs.createReadStream(alonzo.path)
        .pipe(request(app)
          .put('/upload')
          .query({ path: target }) 
          .query({ size: alonzo.size - 1 })
          .expect(409)
          .expect(() => done()))
    })

    it("should return 400 if path not provided", done => {

      let target = path.join(tmptest, UUID.v4())

      fs.createReadStream(alonzo.path)
        .pipe(request(app)
          .put('/upload')
          .query({ size: alonzo.size })
          .query({ sha256: alonzo.sha256 })
          .expect(400)
          .expect(() => done()))
          
    })
  })

  describe("upload a file chunk", () => {

/**
    it("should upload a file chunk", done => {

      let target = path.join(tmptest, UUID.v4())

      fs.createReadStream(alonzo.path)
        .pipe(request(app)
          .put('/upload')
          .query({ path: target }) 
          .query({ size: alonzo.size })
          .query({ sha256: alonzo.sha256 })
          .expect(200)
          .expect(() => {
            if (fileHashSync(target) !== alonzo.sha256)
              throw new Error('hash mismatch')
            done()
          }))
    })
**/
  })
})

