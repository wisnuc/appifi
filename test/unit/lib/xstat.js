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

const { alonzo, pngHDrgba, foo, oneGigaMinus1, oneGiga, oneGigaPlusX } = require('test/lib/files')

const {
  readXstat, readXstatAsync, updateFileHash, updateFileHashAsync, forceXstat, forceXstatAsync
} = require('src/lib/xstat')

const fileMeta = require('src/lib/file-meta')

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

  it('read unsupported file type (/dev/null), a8bc36cc', done => {
    readXstat('/dev/null', (err, xstat) => {
      expect(err).to.be.an('error')
      expect(err.code).to.equal('EISCHARDEV')
      expect(err.xcode).to.equal('EUNSUPPORTED')
      done()
    })
  })

  it('read unsupported file type (symlink), 5159f4d8', done => {
    readXstat(lpath, (err, xstat) => {
      expect(err).to.be.an('error')
      expect(err.code).to.equal('EISSYMLINK')
      expect(err.xcode).to.equal('EUNSUPPORTED')
      done()
    })
  })

  it('return { uuid } for clean dir, e8f33fa5', done => {
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

  it('return { uuid } for dir whose xattr is invalid json (string), 5a627fa7', done => {
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

  it('return { uuid } for dir whose xattr is null, a0318e9c', done => {
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

  it('return { uuid } for dir whose xattr is string, feb69ece', done => {
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

  it('return { uuid } for dir whose xattr is array, af201a03', done => {
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

  it('return { uuid } for dir without uuid, 9314a589', done => {
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

  it('return { uuid } for dir with bad uuid, 52276781', done => {
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
  it.skip('return { uuid } for dir with owner, readlist, writelist', done => {
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

  it('return { uuid, nullType } for clean foo, d67f5b59', done => {
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data

      // no metadata reported
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        mtime: stat.mtime.getTime(),
        size: stat.size
      })

      expect(attr).to.deep.equal({
        uuid,
        metadata: fileMeta.nullType
      })
      done()
    })
  })

  it('return { uuid, metadata: JPEG } for clean jpg, 209314fe', done => {
    xas(jpgpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: alonzo.name,
        mtime: stat.mtime.getTime(),
        size: stat.size,
        metadata: { type: 'JPEG', w: 235, h: 314 }
      })
      expect(attr).to.deep.equal({
        uuid,
        metadata: {
          type: 'JPEG',
          ver: fileMeta.typeMap.get('JPEG').ver,
          w: 235,
          h: 314
        }
      })
      done()
    })
  })

  it('return { uuid, metadata: PNG } for clean png, 79cc02f2', done => {
    xas(pngpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: pngHDrgba.name,
        size: stat.size,
        mtime: stat.mtime.getTime(),
        metadata: { type: 'PNG', w: 1920, h: 1080 }
      })
      expect(attr).to.deep.equal({
        uuid,
        metadata: {
          type: 'PNG',
          ver: fileMeta.typeMap.get('PNG').ver,
          w: 1920,
          h: 1080
        }
      })
      done()
    })
  })

  it('return { uuid } for foo when xattr is invalid json (string), 9f81f7d1', done => {
    xattr.setSync(foopath, 'user.fruitmix', 'hello world')
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({
        uuid,
        metadata: fileMeta.nullType
      })
      done()
    })
  })

  it('return { uuid } for foo when xattr is null, 7a854a9c', done => {
    setAttr(foopath, null)
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({
        uuid,
        metadata: fileMeta.nullType
      })
      done()
    })
  })

  it('return { uuid } for foo when xattr is string, 4bd52006', done => {
    setAttr(foopath, 'hello')
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({
        uuid,
        metadata: fileMeta.nullType
      })
      done()
    })
  })

  it('return { uuid } for foo when xattr is array, c12c5bc2', done => {
    setAttr(foopath, [])
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({
        uuid,
        metadata: fileMeta.nullType
      })
      done()
    })
  })

  it('return { uuid } for foo without uuid, f6598d2e', done => {
    setAttr(foopath, { hello: 'world' })
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({
        uuid,
        metadata: fileMeta.nullType
      })
      done()
    })
  })

  it('return { uuid } for foo with bad uuid, 9acf4f73', done => {
    setAttr(foopath, { uuid: 'world' })
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({
        uuid,
        metadata: fileMeta.nullType
      })
      done()
    })
  })

  // drop old properties
  it.skip('return { uuid, magic: VER } for foo with owner, readlist, writelist', done => {
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

  it('return xstat for foo with uuid and up-to-date version', done => {
    setAttr(foopath, { uuid, metadata: fileMeta.nullType })
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({
        uuid,
        metadata: fileMeta.nullType
      })
      done()
    })
  })

  it('return xstat for foo with uuid and outdated version', done => {
    setAttr(foopath, { uuid, metadata: { type: '_', ver: 1 } })
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({
        uuid,
        metadata: fileMeta.nullType
      })
      done()
    })
  })

  it('return xstat with hash for foo with uuid, magic, hash and up-to-date time', done => {
    setAttr(foopath, {
      uuid,
      hash: foo.hash,
      time: fs.statSync(foopath).mtime.getTime(),
      metadata: fileMeta.nullType
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
        hash: foo.hash
      })
      expect(attr).to.deep.equal({
        uuid,
        hash: foo.hash,
        time: stat.mtime.getTime(),
        metadata: fileMeta.nullType
      })
      done()
    })
  })

  // drop hash
  it('return xstat without hash for foo with uuid, hash and outdated time, null metadata', done => {
    setAttr(foopath, {
      uuid,
      hash: foo.hash,
      time: fs.statSync(foopath).mtime.getTime() - 1,
      metadata: fileMeta.nullType
    })
    xas(foopath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: foo.name,
        size: foo.size,
        mtime: stat.mtime.getTime()
      })
      expect(attr).to.deep.equal({
        uuid,
        metadata: fileMeta.nullType
      })
      done()
    })
  })

  // keep hash, convert time from htime
  it.skip('return xstat with hash for foo with uuid, hash and up-to-date htime', done => {
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
  it.skip('return xstat with hash for foo with uuid, magic, hash and up-to-date htime', function (done) {
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
  it.skip('return xstat without hash for oneGigaPlusX with uuid, magic, hash and up-to-date htime',
    function (done) {
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
          magic: Magic.ver
        })
        expect(attr).to.deep.equal({
          uuid,
          magic: Magic.ver
        })
        done()
      })
    })

  // drop hash
  it.skip('return xstat without hash for foo with uuid, magic, hash and outdated htime', done => {
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
        magic: Magic.ver
      })
      expect(attr).to.deep.equal({
        uuid,
        magic: Magic.ver
      })
      done()
    })
  })

  // TODO ver undefined, outdated, same, or newer
  it('return { uuid, metadata: JPEG } for jpg file with uuid and metadata, f1d6f224', done => {
    setAttr(jpgpath, { uuid, metadata: { type: 'JPEG', w: 235, h: 314 } })
    xas(jpgpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: alonzo.name,
        size: alonzo.size,
        mtime: stat.mtime.getTime(),
        metadata: {
          type: 'JPEG',
          w: 235,
          h: 314
        }
      })
      expect(attr).to.deep.equal({
        uuid,
        metadata: { type: 'JPEG', ver: fileMeta.typeMap.get('JPEG').ver, w: 235, h: 314 }
      })
      done()
    })
  })

  // TODO ver undefined, outdated, same, or newer
  it('return { uuid, metadata: PNG } for png file with uuid and metadata', done => {
    setAttr(pngpath, { uuid, metadata: 'PNG', w: 1920, h: 1080 })
    xas(pngpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: pngHDrgba.name,
        size: pngHDrgba.size,
        mtime: stat.mtime.getTime(),
        metadata: { type: 'PNG', w: 1920, h: 1080 }
      })
      expect(attr).to.deep.equal({
        uuid,
        metadata: {
          type: 'PNG',
          ver: fileMeta.typeMap.get('PNG').ver,
          w: 1920,
          h: 1080
        }
      })
      done()
    })
  })

  // bump magic ver for PNG
  it('return { uuid, metadata: PNG } for png file with uuid and old null type', done => {
    setAttr(pngpath, { uuid, metadata: { type: '_', ver: 1 } })
    xas(pngpath, (err, data) => {
      if (err) return done(err)
      let { xstat, attr, stat } = data
      expect(xstat).to.deep.equal({
        uuid,
        type: 'file',
        name: pngHDrgba.name,
        size: pngHDrgba.size,
        mtime: stat.mtime.getTime(),
        metadata: {
          type: 'PNG',
          w: 1920,
          h: 1080
        }
      })
      expect(attr).to.deep.equal({
        uuid,
        metadata: {
          type: 'PNG',
          ver: fileMeta.typeMap.get('PNG').ver,
          w: 1920,
          h: 1080
        }
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
    xstat = await forceXstatAsync(tmpdir, { uuid: uuidArr[2] })
    expect(xstat).to.deep.equal(pre)
  })
})

describe(path.basename(__filename) + ' forceXstat2', () => {
  const mockUUID = '7da84e6a-82cc-4687-99bf-0336168e6db2'
  const testUUID = 'd3bd9713-1c14-4be4-9411-eb970f399375'
  const hash = '064a2742c29593781497cc9e8223f3bcb012fa7eba99c94b2935661aecc75204'
  let dirPath = path.join(tmptest, 'dir')
  let filePath = path.join(tmptest, 'file')

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(tmptest)
    sinon.stub(UUID, 'v4').returns(mockUUID)
  })

  afterEach(() => UUID.v4.restore())

  it('clean directory, undefined', done => {
    mkdirp.sync(dirPath)
    forceXstat(dirPath, undefined, (err, xstat) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync(dirPath, 'user.fruitmix'))
      expect(attr).to.deep.equal({ uuid: mockUUID })
      done()
    })
  })

  it('clean directory, null', done => {
    mkdirp.sync(dirPath)
    forceXstat(dirPath, null, (err, xstat) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync(dirPath, 'user.fruitmix'))
      expect(attr).to.deep.equal({ uuid: mockUUID })
      done()
    })
  })

  it('clean directory, empty object', done => {
    mkdirp.sync(dirPath)
    forceXstat(dirPath, {}, (err, xstat) => {
      if (err) return done(err)
      let stat = fs.lstatSync(dirPath)
      let attr = JSON.parse(xattr.getSync(dirPath, 'user.fruitmix'))
      expect(attr).to.deep.equal({ uuid: mockUUID })
      expect(xstat).to.deep.equal({
        uuid: mockUUID,
        type: 'directory',
        name: 'dir',
        mtime: stat.mtime.getTime()
      })
      done()
    })
  })

  it('clean directory, { uuid }', done => {
    mkdirp.sync(dirPath)
    forceXstat(dirPath, { uuid: testUUID }, (err, xstat) => {
      if (err) return done(err)
      let stat = fs.lstatSync(dirPath)
      let attr = JSON.parse(xattr.getSync(dirPath, 'user.fruitmix'))
      expect(attr).to.deep.equal({ uuid: testUUID })
      expect(xstat).to.deep.equal({
        uuid: testUUID,
        type: 'directory',
        name: 'dir',
        mtime: stat.mtime.getTime()
      })
      done()
    })
  })

  it('clean directory, { uuid, hash }, hash dropped silently', done => {
    mkdirp.sync(dirPath)
    forceXstat(dirPath, { uuid: testUUID, hash }, (err, xstat) => {
      if (err) return done(err)
      let stat = fs.lstatSync(dirPath)
      let attr = JSON.parse(xattr.getSync(dirPath, 'user.fruitmix'))
      expect(attr).to.deep.equal({ uuid: testUUID })
      expect(xstat).to.deep.equal({
        uuid: testUUID,
        type: 'directory',
        name: 'dir',
        mtime: stat.mtime.getTime()
      })
      done()
    })
  })

  it('clean directory, { hash }, hash dropped silently', done => {
    mkdirp.sync(dirPath)
    forceXstat(dirPath, { hash }, (err, xstat) => {
      if (err) return done(err)
      let stat = fs.lstatSync(dirPath)
      let attr = JSON.parse(xattr.getSync(dirPath, 'user.fruitmix'))
      expect(attr).to.deep.equal({ uuid: mockUUID })
      expect(xstat).to.deep.equal({
        uuid: mockUUID,
        type: 'directory',
        name: 'dir',
        mtime: stat.mtime.getTime()
      })
      done()
    })
  })
})
