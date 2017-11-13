const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs-extra'))
const UUID = require('uuid')
const xattr = Promise.promisifyAll(require('fs-xattr'))
const validator = require('validator')

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

const sinon = require('sinon')

const E = require('src/lib/error')
const Magic = require('src/lib/magic')
const S = require('test/assets/samples') // TODO

const { alonzo, pngHDrgba, foo, oneGigaMinus1, oneGiga, oneGigaPlusX  } = require('test/lib/files')

const { 
  readXstat, readXstatAsync, updateFileHash, updateFileHashAsync, forceXstat, forceXstatAsync
} = require('src/lib/xstat')

const uuidArr = [
	'c3256d90-f789-47c6-8228-9878f2b106f6',
	'6c15ff0f-b816-4b2e-8a2e-2f7c4902d13c',
	'b6d7a826-0635-465f-9034-1f5a69181f68',
	'e4197ec7-c588-492c-95c4-be6172318932',
	'494e2130-56c6-477c-ba4f-b87226eb7ebd',
	'52285890-5556-47fb-90f3-45e14e741ccd',
	'6648fe47-bcf0-43cb-9f64-996620595bd7',
	'238e1fa5-8847-43e6-860e-cf812d1f5e65',
	'146e05a5-d31b-4601-bc56-a46e66bb14eb'
]

const cwd = process.cwd()
const tmptest = 'tmptest'
const tmpdir = path.join(cwd, tmptest)

// const MAGICVER = 1

describe(path.basename(__filename) + ' readXstat new', () => {

  let footime, jpgtime, pngtime
  let foopath = path.join(tmptest, foo.name)
  let jpgpath = path.join(tmptest, alonzo.name)
  let pngpath = path.join(tmptest, pngHDrgba.name)
  let dpath = path.join(tmptest, 'dir')
  let lpath = path.join(tmptest, 'link')

  let uuid = 'a6fb4e15-4735-461f-8f1d-f9b702f69b61' 
  const getAttr = path => JSON.parse(xattr.getSync(path, 'user.fruitmix'))
  const setAttr = (path, obj) => xattr.setSync(path, 'user.fruitmix', JSON.stringify(obj))

  const xas = (path, callback) => 
    readXstat(path, (err, xstat) => {
      if (err) return callback(err)
      callback(null, {
        xstat,
        attr: getAttr(path),
        stat: fs.statSync(path)
      })
    })

  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(dpath)
    await fs.copyFileAsync(foo.path, foopath)
    await fs.copyFileAsync(alonzo.path, jpgpath)
    await fs.copyFileAsync(pngHDrgba.path, pngpath)
    await fs.symlinkAsync('./file', lpath)
    sinon.stub(UUID, 'v4').returns(uuid)
  })

  afterEach(() => {
    UUID.v4.restore()
  })

  it('read unsupported file type (/dev/null)', done => {
    readXstat('/dev/null', (err, xstat) => {
      expect(err).to.be.an('error')
      expect(err.code).to.equal('EUNSUPPORTEDFILETYPE')
      done()
    })
  })

  it('read unsupported file type (symlink)', done => {
    readXstat(lpath, (err, xstat) => {
      expect(err).to.be.an('error')
      expect(err.code).to.equal('EUNSUPPORTEDFILETYPE')
      done()
    })
  })

  it('return { uuid } for clean dir', done => {
    xas(dpath, (err, { xstat, attr, stat }) => {
      if (err) return done(err)
      expect(xstat).to.deep.equal({
        uuid,
        type: 'directory',
        name: 'dir',
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({ uuid })
      done()
    })
  })

  it('return { uuid } for dir whose xattr is invalid json (string)', done => {
    xattr.setSync(dpath, 'user.fruitmix', 'hello world')
    xas(dpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'directory',
        name: 'dir',
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({ uuid })
      done()
    })
  })

  it('return { uuid } for dir whose xattr is null', done => {
    setAttr(dpath, null)
    xas(dpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'directory',
        name: 'dir',
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({ uuid })
      done()
    })
  })

  it('return { uuid } for dir whose xattr is string', done => {
    setAttr(dpath, 'hello')
    xas(dpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'directory',
        name: 'dir',
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({ uuid })
      done()
    })
  })

  it('return { uuid } for dir whose xattr is array', done => {
    setAttr(dpath, [])
    xas(dpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'directory',
        name: 'dir',
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({ uuid })
      done()
    })
  })

  it('return { uuid } for dir without uuid', done => {
    setAttr(dpath, { hello: 'world' })
    xas(dpath, (err, { xstat, attr, stat }) => {
      expect(xstat).to.deep.equal({
        uuid,
        type: 'directory',
        name: 'dir',
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({ uuid })
      done()
    })
  })

  it('return { uuid } for dir with bad uuid', done => {
    setAttr(dpath, { uuid: 'hello' })
    xas(dpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'directory',
        name: 'dir',
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({ uuid })
      done()
    })
  })

  // drop old properties
  it('return { uuid } for dir with owner, readlist, writelist', done => {
    setAttr(dpath, { uuid, owner: uuidArr[0], readlist: [], writelist: [] })
    xas(dpath, (err, { xstat, attr, stat }) => {
      if (err) return done(err)
      expect(xstat).to.deep.equal({
        uuid,
        type: 'directory',
        name: 'dir',
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({ uuid })
      done()
    })
  })

  it('return { uuid, magic: VER } for clean foo', done => {
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver,
        size: stat.size
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver
      })
      done()
    })
  })

  it('return { uuid, magic: JPEG } for clean jpg', done => {
    xas(jpgpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: alonzo.name,
        mtime: stat.mtime.getTime(),
        magic: 'JPEG',
        size: stat.size
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: 'JPEG'
      })
      done()
    })
  }) 

  it('return { uuid, magic: PNG } for clean png', done => {
    xas(pngpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: pngHDrgba.name,
        size: stat.size,
        mtime: stat.mtime.getTime(),
        magic: 'PNG'
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: 'PNG'
      })
      done()
    })
  }) 

  it('return { uuid, magic: VER } for foo when xattr is invalid json (string)', done => {
    xattr.setSync(foopath, 'user.fruitmix', 'hello world')
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver
      })
      done()
    })
  })

  it('return { uuid, magic: VER } for foo when xattr is null', done => {
    setAttr(foopath, null)
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver
      })
      done()
    })
  })

  it('return { uuid, magic: VER } for foo when xattr is string', done => {
    setAttr(foopath, 'hello')
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver
      })
      done()
    })
  })

  it('return { uuid, magic: VER } for foo when xattr is array', done => {
    setAttr(foopath, [])
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver
      })
      done()
    })
  })

  it('return { uuid, magic: VER } for foo without uuid', done => {
    setAttr(foopath, { hello: 'world' })
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver
      })
      done()
    })
  })

  it('return { uuid, magic: VER } for foo with bad uuid', done => {
    setAttr(foopath, { uuid: 'world' })
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver
      })
      done()
    })
  })

  // drop old properties
  it('return { uuid, magic: VER } for foo with owner, readlist, writelist', done => {
    setAttr(foopath, { 
      uuid, 
      magic: 0,
      owner: uuid,
      writelist: [],
      readlist: []
    })

    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver
      })
      done()
    })
  })

  it('return xstat for foo with uuid and up-to-date magic', done => {
    setAttr(foopath, { uuid, magic: Magic.ver })
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver
      })
      done()
    })
  })

  it('return xstat for foo with uuid and outdated magic', done => {
    setAttr(foopath, { uuid, magic: 0 })
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver
      })
      done()
    })
  })

  it('return xstat with hash for foo with uuid, magic, hash and up-to-date time', done => {
    setAttr(foopath, { 
      uuid, 
      magic: Magic.ver,
      hash: foo.hash,
      time: fs.statSync(foopath).mtime.getTime()
    })
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver,
        hash: foo.hash
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver,
        hash: foo.hash,
        time: stat.mtime.getTime()
      })
      done()
    })
  })

  // drop hash
  it('return xstat without hash for foo with uuid, magic, hash and outdated time', done => {
    setAttr(foopath, { 
      uuid, 
      magic: Magic.ver,
      hash: foo.hash,
      time: fs.statSync(foopath).mtime.getTime() - 1
    })
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver,
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver
      })
      done()
    })
  })

  // keep hash, convert time from htime
  it('return xstat with hash for foo with uuid, magic, hash and up-to-date htime', done => {
    setAttr(foopath, { 
      uuid, 
      magic: Magic.ver,
      hash: foo.hash,
      htime: fs.statSync(foopath).mtime.getTime()
    })
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver,
        hash: foo.hash
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver,
        hash: foo.hash,
        time: stat.mtime.getTime()
      })
      done()
    })
  })

  // keep hash for oneGiga
  it('return xstat with hash for foo with uuid, magic, hash and up-to-date htime', function (done) {
    this.timeout(0)

    let fpath = path.join(tmptest, oneGiga.name)
    fs.copyFileSync(oneGiga.path, fpath) 

    setAttr(fpath, { 
      uuid, 
      magic: Magic.ver,
      hash: oneGiga.hash,
      htime: fs.statSync(fpath).mtime.getTime()
    })

    xas(fpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: oneGiga.name,
        size: oneGiga.size,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver,
        hash: oneGiga.hash
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver,
        hash: oneGiga.hash,
        time: stat.mtime.getTime()
      })
      done()
    })
  })

  // drop hash for oneGigaPlusX
  it('return xstat without hash for oneGigaPlusX with uuid, magic, hash and up-to-date htime', function (done) {
    this.timeout(0)

    let fpath = path.join(tmptest, oneGigaPlusX.name)
    fs.copyFileSync(oneGigaPlusX.path, fpath) 

    setAttr(fpath, { 
      uuid, 
      magic: Magic.ver,
      hash: oneGigaPlusX.hash,
      htime: fs.statSync(fpath).mtime.getTime()
    })

    xas(fpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: oneGigaPlusX.name,
        size: oneGigaPlusX.size,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver,
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver,
      })
      done()
    })
  })

  // drop hash
  it('return xstat without hash for foo with uuid, magic, hash and outdated htime', done => {
    setAttr(foopath, { 
      uuid, 
      magic: Magic.ver,
      hash: foo.hash,
      htime: fs.statSync(foopath).mtime.getTime() - 1
    })
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime(),
        magic: Magic.ver,
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: Magic.ver
      })
      done()
    })
  })

  it('return { uuid, magic: JPEG } for jpg file with uuid and magic', done => {
    setAttr(jpgpath, { uuid, magic: 'JPEG' })
    xas(jpgpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: alonzo.name,
        size: alonzo.size,
        mtime: stat.mtime.getTime(),
        magic: 'JPEG'
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: 'JPEG'
      })
      done()
    })
  })

  it('return { uuid, magic: PNG } for png file with uuid and magic', done => {
    setAttr(pngpath, { uuid, magic: 'PNG' })
    xas(pngpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: pngHDrgba.name,
        size: pngHDrgba.size,
        mtime: stat.mtime.getTime(),
        magic: 'PNG'
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: 'PNG'
      })
      done()
    })
  })

  // bump magic ver for PNG
  it('return { uuid, magic: PNG } for png file with uuid and old magic', done => {
    setAttr(pngpath, { 
      uuid, 
      magic: 0
    })

    xas(pngpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: pngHDrgba.name,
        size: pngHDrgba.size,
        mtime: stat.mtime.getTime(),
        magic: 'PNG'
      })
      expect(attr).to.deep.equal({ 
        uuid,
        magic: 'PNG'
      })
      done()
    })
  })

 
})



describe(path.basename(__filename) + ' forceXstat', () => {

  let pre

  beforeEach(async () => {
    await rimrafAsync(tmptest) 
    await mkdirpAsync(tmptest)
    let stats = await fs.statAsync(tmpdir)
    pre = {
      uuid: uuidArr[2],
      type: 'directory',
      name: 'tmptest',
      mtime: stats.mtime.getTime() 
    }
    sinon.stub(UUID, 'v4').returns(uuidArr[1])
  })

  afterEach(() => UUID.v4.restore())

  it('should force xstat of clean dirctory', async () => {
    let xstat = await forceXstatAsync(tmpdir, { uuid: uuidArr[2] })
    expect(xstat).to.deep.equal(pre)
  })

  it('should force xstat of directory with existing (different) uuid', async () => {

    let xstat

    await xattr.setAsync(tmpdir, 'user.fruitmix', JSON.stringify({ uuid: uuidArr[0] }))

    // xstat = await readXstatAsync(tmpdir)
    // expect(xstat.uuid).to.equal(uuidArr[0])

    xstat = await forceXstatAsync(tmpdir, { uuid: uuidArr[2] })
    expect(xstat).to.deep.equal(pre)
  })
})

