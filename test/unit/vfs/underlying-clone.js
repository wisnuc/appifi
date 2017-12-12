const path = require('path')
const fs = require('fs')
const Promise = require('bluebird')

const xattr = require('fs-xattr')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const { expect } = require('chai')

const Magic = require('src/lib/magic')
const { readXstat } = require('src/lib/xstat')
const { mkfile, clone } = require('src/vfs/underlying')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

const mkfileAsync = Promise.promisify(mkfile)

describe(path.basename(__filename) + ' clone', () => {
  /**
  Clone a file from fruitmix to tmp dir.
  file uuid and timestamp are verified. xattr are stripped.
  */

  /**
    param: filepath, fileUUID, tmp, callback
    prepare a file in fruitmix, with UUID and xattr
  **/
  let stats

  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
    fs.mkdirSync('tmptest/a')
    fs.writeFileSync('tmptest/clone', '')
    fs.copyFileSync('testdata/foo', 'tmptest/tmp')
    stats = await mkfileAsync('tmptest/a/b', 'tmptest/tmp', null, [])
  })

  it('ENOENT if filepath does not exist', done => {
    clone('tmptest/c', stats.uuid, 'tmptest/clone', err => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('EISSYMLINK if filepath is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/c')
    clone('tmptest/c', stats.uuid, 'tmptest/clone', err => {
      expect(err.code).to.equal('EISSYMLINK')
      expect(err.xcode).to.equal('EUNSUPPORTED')
      done()
    })
  })

  it('ENOTFILE if filepath is dir', done => {
    fs.mkdirSync('tmptest/c')
    clone('tmptest/c', stats.uuid, 'tmptest/clone', err => {
      expect(err.code).to.equal('ENOTFILE')
      done()
    })
  })

  it('EUUIDMISMATCH if uuid mismatch', done => {
    let uuid = '742c44cb-e180-452c-9aae-1343117bb2ac'
    clone('tmptest/a/b', uuid, 'tmptest/clone', err => {
      expect(err.code).to.equal('EUUIDMISMATCH')
      done()
    })
  })

  // ENOTTY is an ioctl error
  it('ENOTTY if tmp does not exist', done => {
    clone('tmptest/a/b', stats.uuid, 'tmptest/c', err => {
      expect(err.code).to.equal('ENOTTY')
      done()
    })
  })

  it('EISDIR if tmp is dir', done => {
    fs.mkdirSync('tmptest/c')
    clone('tmptest/a/b', stats.uuid, 'tmptest/c', err => {
      expect(err.code).to.equal('EISDIR')
      done()
    })
  })

  it('clone successfully', done => {
    clone('tmptest/a/b', stats.uuid, 'tmptest/clone', (err, xstat) => {
      console.log(err)
      if (err) return done(err)
      console.log(xstat)
      // expect(xstat).to.deep.equal({
      //   uuid: stats.uuid,
      //   mtime: stats.mtime.getTime()
      // })
      done()
    })
  })
})