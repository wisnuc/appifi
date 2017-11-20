const path = require('path')
const fs = require('fs')

const xattr = require('fs-xattr')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

const { expect } = require('chai')

const Magic = require('src/lib/magic')
const { readXstat } = require('src/lib/xstat')
const { mkdir, mkfile } = require('src/vfs/underlying')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')


describe(path.basename(__filename) + ' mkfile, vanilla, w/o hash', () => {

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(tmptest)
    fs.copyFileSync('testdata/alonzo_church.jpg', 'tmptest/tmp')
  })

  it('ENOENT if parent does not exist', done => {
    mkfile('tmptest/a/b', 'tmptest/tmp', null, null, (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent is file', done => {
    fs.copyFileSync('tmptest/tmp', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, null, (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  // This is a dangerous case
  it('ENOENT if parent is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, null, (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('OK if target does not exist', done => {
    fs.mkdirSync('tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, null, (err, xstat) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix')) 
      let stat = fs.lstatSync('tmptest/a/b')
      
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: 'JPEG'
      })
      done()
    })
  })

  it('EEXIST + EISDIR, if target is dir', done => {
    mkdirp.sync('tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, null, (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISDIR')
      done()
    })
  })

  it('EEXIST + EISFILE, if target is file', done => {
    mkdirp.sync('tmptest/a')  
    fs.copyFileSync('testdata/foo', 'tmptest/a/b') 
    mkfile('tmptest/a/b', 'tmptest/tmp', null, null, (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISFILE')
      done()
    })
  })

  // interesting this works
  it('EEXIST if target is (broken) symlink', done => {
    mkdirp.sync('tmptest/a')
    fs.symlinkSync('hello', 'tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, null, (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISSYMLINK')
      done()
    })
  })

})

describe(path.basename(__filename) + ' mkfile, vanilla, w/ hash', () => {

  const hash = '0b7cb85e818d0a592891abe47d7771636e454cedd841bad1cbe1da3b744498f5' 

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(tmptest)
    fs.copyFileSync('testdata/alonzo_church.jpg', 'tmptest/tmp')
  })

  it('ENOENT if parent does not exist', done => {
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, null, (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent is file', done => {
    fs.copyFileSync('tmptest/tmp', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, null, (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  // This is a dangerous case
  it('ENOENT if parent is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, null, (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('OK if target does not exist', done => {
    fs.mkdirSync('tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, null, (err, xstat) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix')) 
      let stat = fs.lstatSync('tmptest/a/b')
      expect(attr).to.deep.equal({
        uuid: attr.uuid,
        hash,
        time: stat.mtime.getTime(),
        magic: 'JPEG', 
      })
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: 'JPEG',
        hash
      })
      done()
    })
  })

  it('EEXIST + EISDIR, if target is dir', done => {
    mkdirp.sync('tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, null, (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISDIR')
      done()
    })
  })

  it('EEXIST + EISFILE, if target is file', done => {
    mkdirp.sync('tmptest/a')  
    fs.copyFileSync('testdata/foo', 'tmptest/a/b') 
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, null, (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISFILE')
      done()
    })
  })

  // interesting this works
  it('EEXIST if target is (broken) symlink', done => {
    mkdirp.sync('tmptest/a')
    fs.symlinkSync('hello', 'tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, null, (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISSYMLINK')
      done()
    })
  })

})

describe(path.basename(__filename) + ' mkfile, keep, w/o hash', () => {

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(tmptest)
    fs.copyFileSync('testdata/alonzo_church.jpg', 'tmptest/tmp')
  })

  it('ENOENT if parent does not exist', done => {
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'keep', (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent is file', done => {
    fs.copyFileSync('tmptest/tmp', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'keep', (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  // This is a dangerous case
  it('ENOENT if parent is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'keep', (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('OK if target does not exist', done => {
    fs.mkdirSync('tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'keep', (err, xstat, resolved) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix')) 
      let stat = fs.lstatSync('tmptest/a/b')
      expect(attr).to.deep.equal({
        uuid: attr.uuid,
        magic: 'JPEG'
      })
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: 'JPEG'
      })
      expect(resolved).to.be.false
      done()
    })
  })

  it('EEXIST + EISDIR, if target is dir', done => {
    mkdirp.sync('tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'keep', (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISDIR')
      done()
    })
  })

  it('OK, if target is file', done => {
    mkdirp.sync('tmptest/a')  
    fs.copyFileSync('testdata/foo', 'tmptest/a/b') 
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'keep', (err, xstat, resolved) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
      let stat = fs.lstatSync('tmptest/a/b')
      expect(attr).to.deep.equal({
        uuid: attr.uuid,
        magic: Magic.ver
      })
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: Magic.ver        // foo is not a JPEG
      })
      expect(resolved).to.be.true
      done()
    })
  })

  // interesting this works
  it('EEXIST if target is (broken) symlink', done => {
    mkdirp.sync('tmptest/a')
    fs.symlinkSync('hello', 'tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'keep', (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISSYMLINK')
      done()
    })
  })

})

describe(path.basename(__filename) + ' mkfile, keep, w/ hash', () => {
  // alonzo hash
  const hash = '8e28737e8cdf679e65714fe2bdbe461c80b2158746f4346b06af75b42f212408'

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(tmptest)
    fs.copyFileSync('testdata/alonzo_church.jpg', 'tmptest/tmp')
  })

  it('ENOENT if parent does not exist', done => {
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'keep', (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent is file', done => {
    fs.copyFileSync('tmptest/tmp', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'keep', (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  // This is a dangerous case
  it('ENOENT if parent is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'keep', (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('OK if target does not exist', done => {
    fs.mkdirSync('tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'keep', (err, xstat, resolved) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix')) 
      let stat = fs.lstatSync('tmptest/a/b')
      expect(attr).to.deep.equal({
        uuid: attr.uuid,
        hash,
        time: stat.mtime.getTime(),
        magic: 'JPEG'
      })
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: 'JPEG',
        hash
      })
      expect(resolved).to.be.false
      done()
    })
  })

  it('EEXIST + EISDIR, if target is dir', done => {
    mkdirp.sync('tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'keep', (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISDIR')
      done()
    })
  })

  it('OK, if target is file', done => {
    mkdirp.sync('tmptest/a')  
    fs.copyFileSync('testdata/foo', 'tmptest/a/b') 
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'keep', (err, xstat, resolved) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
      let stat = fs.lstatSync('tmptest/a/b')
      expect(attr).to.deep.equal({
        uuid: attr.uuid,
        magic: Magic.ver
      })
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: Magic.ver        // foo is not a JPEG
      })
      expect(resolved).to.be.true
      done()
    })
  })

  // interesting this works
  it('EEXIST if target is (broken) symlink', done => {
    mkdirp.sync('tmptest/a')
    fs.symlinkSync('hello', 'tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'keep', (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISSYMLINK')
      done()
    })
  })

})


describe(path.basename(__filename) + ' mkfile, rename, w/o hash', () => {

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(tmptest)
    fs.copyFileSync('testdata/alonzo_church.jpg', 'tmptest/tmp')
  })

  it('ENOENT if parent does not exist', done => {
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'rename', (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent is file', done => {
    fs.copyFileSync('tmptest/tmp', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'rename', (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  // This is a dangerous case
  it('ENOENT if parent is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'rename', (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('OK if target does not exist', done => {
    fs.mkdirSync('tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'rename', (err, xstat, resolved) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix')) 
      let stat = fs.lstatSync('tmptest/a/b')
      
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: 'JPEG'
      })
      expect(resolved).to.be.false
      done()
    })
  })

  it('OK, if target is dir', done => {
    mkdirp.sync('tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'rename', (err, xstat, resolved) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b (2)', 'user.fruitmix')) 
      let stat = fs.lstatSync('tmptest/a/b (2)')
      expect(attr).to.deep.equal({
        uuid: attr.uuid,
        magic: 'JPEG'
      })
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b (2)',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: 'JPEG'
      })
      expect(resolved).to.be.true
      done()
    })
  })

  it('OK, if target is file', done => {
    mkdirp.sync('tmptest/a')  
    fs.copyFileSync('testdata/foo', 'tmptest/a/b') 
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'rename', (err, xstat, resolved) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b (2)', 'user.fruitmix'))
      let stat = fs.lstatSync('tmptest/a/b (2)')
      expect(attr).to.deep.equal({
        uuid: attr.uuid,
        magic: 'JPEG'
      })
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b (2)',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: 'JPEG'
      })
      expect(resolved).to.be.true
      done()
    })
  })

  // interesting this works
  it('EEXIST if target is (broken) symlink', done => {
    mkdirp.sync('tmptest/a')
    fs.symlinkSync('hello', 'tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'rename', (err, xstat, resolved) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b (2)', 'user.fruitmix'))
      let stat = fs.lstatSync('tmptest/a/b (2)')
      expect(attr).to.deep.equal({
        uuid: attr.uuid,
        magic: 'JPEG'
      })
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b (2)',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: 'JPEG'
      })
      expect(resolved).to.be.true
      done()
    })
  })

})

describe(path.basename(__filename) + ' mkfile, rename, w/ hash', () => {

  // alonzo hash
  const hash = '8e28737e8cdf679e65714fe2bdbe461c80b2158746f4346b06af75b42f212408'

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(tmptest)
    fs.copyFileSync('testdata/alonzo_church.jpg', 'tmptest/tmp')
  })

  it('ENOENT if parent does not exist', done => {
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'rename', (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent is file', done => {
    fs.copyFileSync('tmptest/tmp', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'rename', (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  // This is a dangerous case
  it('ENOENT if parent is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'rename', (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('OK if target does not exist', done => {
    fs.mkdirSync('tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'rename', (err, xstat, resolved) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix')) 
      let stat = fs.lstatSync('tmptest/a/b')
      expect(attr).to.deep.equal({
        uuid: attr.uuid,
        hash,
        time: stat.mtime.getTime(),
        magic: 'JPEG'
      })
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: 'JPEG',
        hash
      })
      expect(resolved).to.be.false
      done()
    })
  })

  it('OK, if target is dir', done => {
    mkdirp.sync('tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'rename', (err, xstat, resolved) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b (2)', 'user.fruitmix')) 
      let stat = fs.lstatSync('tmptest/a/b (2)')
      expect(attr).to.deep.equal({
        uuid: attr.uuid,
        hash,
        time: stat.mtime.getTime(),
        magic: 'JPEG'
      })
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b (2)',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: 'JPEG',
        hash
      })
      expect(resolved).to.be.true
      done()
    })
  })

  it('OK, if target is file', done => {
    mkdirp.sync('tmptest/a')  
    fs.copyFileSync('testdata/foo', 'tmptest/a/b') 
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'rename', (err, xstat, resolved) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b (2)', 'user.fruitmix'))
      let stat = fs.lstatSync('tmptest/a/b (2)')
      expect(attr).to.deep.equal({
        uuid: attr.uuid,
        hash,
        time: stat.mtime.getTime(),
        magic: 'JPEG'
      })
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b (2)',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: 'JPEG',
        hash
      })
      expect(resolved).to.be.true
      done()
    })
  })

  // rename resolves this case
  it('OK if target is (broken) symlink', done => {
    mkdirp.sync('tmptest/a')
    fs.symlinkSync('hello', 'tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'rename', (err, xstat, resolved) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b (2)', 'user.fruitmix'))
      let stat = fs.lstatSync('tmptest/a/b (2)')
      expect(attr).to.deep.equal({
        uuid: attr.uuid,
        hash,
        time: stat.mtime.getTime(),
        magic: 'JPEG'
      })
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b (2)',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: 'JPEG',
        hash
      })
      expect(resolved).to.be.true
      done()
    })
  })

})

describe(path.basename(__filename) + ' mkfile, replace, w/o hash', () => {

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(tmptest)
    fs.copyFileSync('testdata/alonzo_church.jpg', 'tmptest/tmp')
  })

  it('ENOENT if parent does not exist', done => {
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'replace', (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent is file', done => {
    fs.copyFileSync('tmptest/tmp', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'replace', (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  // This is a dangerous case
  it('ENOENT if parent is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'replace', (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('OK if target does not exist', done => {
    fs.mkdirSync('tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'replace', (err, xstat, resolved) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix')) 
      let stat = fs.lstatSync('tmptest/a/b')
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: 'JPEG'
      })
      expect(resolved).to.be.false
      done()
    })
  })

  it('OK, if target is dir', done => {
    mkdirp.sync('tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'replace', (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISDIR')
      done()
    })
  })

  it('OK, if target is file', done => {
    mkdirp.sync('tmptest/a')  
    fs.copyFileSync('testdata/foo', 'tmptest/a/b') 
    readXstat('tmptest/a/b', (err, origXstat) => {
      mkfile('tmptest/a/b', 'tmptest/tmp', null, 'replace', (err, xstat, resolved) => {
        if (err) return done(err)
        let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
        let stat = fs.lstatSync('tmptest/a/b')
        expect(attr).to.deep.equal({
          uuid: origXstat.uuid,
          magic: 'JPEG'
        })
        expect(xstat).to.deep.equal({
          uuid: origXstat.uuid,
          type: 'file',
          name: 'b',
          mtime: stat.mtime.getTime(),
          size: stat.size,
          magic: 'JPEG'
        })
        expect(resolved).to.be.true
        done()
      })
    })
  })

  // interesting this works
  it('EEXIST if target is (broken) symlink', done => {
    mkdirp.sync('tmptest/a')
    fs.symlinkSync('hello', 'tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', null, 'replace', (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISSYMLINK')
      done()
    })
  })

})

describe(path.basename(__filename) + ' mkfile, replace, w/ hash', () => {

  // alonzo hash
  const hash = '8e28737e8cdf679e65714fe2bdbe461c80b2158746f4346b06af75b42f212408'

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(tmptest)
    fs.copyFileSync('testdata/alonzo_church.jpg', 'tmptest/tmp')
  })

  it('ENOENT if parent does not exist', done => {
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'replace', (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent is file', done => {
    fs.copyFileSync('tmptest/tmp', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'replace', (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  // This is a dangerous case
  it('ENOENT if parent is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'replace', (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('OK if target does not exist', done => {
    fs.mkdirSync('tmptest/a')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'replace', (err, xstat, resolved) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix')) 
      let stat = fs.lstatSync('tmptest/a/b')
      expect(attr).to.deep.equal({
        uuid: attr.uuid,
        hash,
        time: stat.mtime.getTime(),
        magic: 'JPEG'
      })
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'b',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: 'JPEG',
        hash
      })
      expect(resolved).to.be.false
      done()
    })
  })

  it('EEXIST + EISDIR, if target is dir', done => {
    mkdirp.sync('tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'replace', (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISDIR')
      done()
    })
  })

  it('OK, if target is file', done => {
    mkdirp.sync('tmptest/a')  
    fs.copyFileSync('testdata/foo', 'tmptest/a/b') 
    readXstat('tmptest/a/b', (err, origXstat) => {
      mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'replace', (err, xstat, resolved) => {
        if (err) return done(err)
        let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
        let stat = fs.lstatSync('tmptest/a/b')
        expect(attr).to.deep.equal({
          uuid: origXstat.uuid,
          hash,
          time: stat.mtime.getTime(),
          magic: 'JPEG'
        })
        expect(xstat).to.deep.equal({
          uuid: origXstat.uuid,
          type: 'file',
          name: 'b',
          mtime: stat.mtime.getTime(),
          size: stat.size,
          magic: 'JPEG',
          hash
        })
        expect(resolved).to.be.true
        done()
      })
    })
  })

  // interesting this works
  it('EEXIST if target is (broken) symlink', done => {
    mkdirp.sync('tmptest/a')
    fs.symlinkSync('hello', 'tmptest/a/b')
    mkfile('tmptest/a/b', 'tmptest/tmp', hash, 'replace', (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISSYMLINK')
      done()
    })
  })

})




