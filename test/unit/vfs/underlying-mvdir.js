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
const { mkdir, mvdir } = require('src/vfs/underlying')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

const mkdirAsync = Promise.promisify(mkdir)

describe(path.basename(__filename) + ' mvdir, []', () => {
  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
    fs.mkdirSync('tmptest/a')
    await mkdirAsync('tmptest/a/b', [])
  })

  it('ENOENT if parent of newPath does not exist', done => {
    mvdir('tmptest/a/b', 'tmptest/c/d', [], (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is file', done => {
    fs.copyFileSync('testdata/foo', 'tmptest/c')
    mvdir('tmptest/a/b', 'tmptest/c/d', [], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/c')
    mvdir('tmptest/a/b', 'tmptest/c/d', [], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('success if newPath does not exist', done => {
    fs.mkdirSync('tmptest/c')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', [], (err, xstat, resolved) => {
      if (err) return done(err)
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([false, false])
      done()
    })
  })

  // EISDIR indicates newPath is a dir
  it('EEXIST + EISDIR, if newPath is dir', done => {
    mkdirp.sync('tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', [], (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISDIR')
      done()
    })
  })

  // EISFILE indicates newPath is a file
  it('EEXIST + EISFILE, if newPath is file', done => {
    mkdirp.sync('tmptest/c')
    fs.copyFileSync('testdata/foo', 'tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', [], (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISFILE')
      done()
    })
  })

  // EISSYMLINK indicates newPath is a symlink
  it('EEXIST + EISSYMLINK, if newPath is (broken) symlink', done => {
    mkdirp.sync('tmptest/c')
    fs.symlinkSync('hello', 'tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', [], (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISSYMLINK')
      done()
    })
  })
})

describe(path.basename(__filename) + ' mvdir, [skip]', () => {
  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
    fs.mkdirSync('tmptest/a')
    await mkdirAsync('tmptest/a/b', [])
  })

  it('ENOENT if parent of newPath does not exist', done => {
    mvdir('tmptest/a/b', 'tmptest/c/d', ['skip'], (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is file', done => {
    fs.copyFileSync('testdata/foo', 'tmptest/c')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['skip'], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/c')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['skip'], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('success if newPath does not exist', done => {
    fs.mkdirSync('tmptest/c')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['skip'], (err, xstat, resolved) => {
      if (err) return done(err)
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([false, false])
      done()
    })
  })

  // EISFILE indicates newPath is a file
  it('EEXIST + EISFILE, if newPath is FILE', done => {
    mkdirp.sync('tmptest/c')
    fs.copyFileSync('testdata/foo', 'tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['skip'], (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISFILE')
      done()
    })
  })

  // EISSYMLINK indicates newPath is a symlink
  it('EEXIST + EISSYMLINK, if newPath is (broken) symlink', done => {
    mkdirp.sync('tmptest/c')
    fs.symlinkSync('hello', 'tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['skip'], (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISSYMLINK')
      done()
    })
  })

  it('success if newPath is dir', done => {
    mkdirp.sync('tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['skip'], (err, xstat, resolved) => {
      if (err) return done(err)
      let attr = JSON.parse(xattr.getSync('tmptest/c/d', 'user.fruitmix'))
      let stat = fs.lstatSync('tmptest/c/d')
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([true, false])
      done()
    })
  })
})

describe(path.basename(__filename) + ' mvdir, [,skip]', () => {
  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
    fs.mkdirSync('tmptest/a')
    await mkdirAsync('tmptest/a/b', [])
  })

  it('ENOENT if parent of newPath does not exist', done => {
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'skip'], (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is file', done => {
    fs.copyFileSync('testdata/foo', 'tmptest/c')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'skip'], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/c')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'skip'], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('success if newPath does not exist', done => {
    fs.mkdirSync('tmptest/c')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'skip'], (err, xstat, resolved) => {
      if (err) return done(err)
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([false, false])
      done()
    })
  })

  it('EEXIST + EISDIR if newPath is dir', done => {
    mkdirp.sync('tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'skip'], (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.be.equal('EISDIR')
      done()
    })
  })

  it('success if newPath is (broken) symlink', done => {
    mkdirp.sync('tmptest/c')
    fs.symlinkSync('hello', 'tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'skip'], (err, xstat, resolved) => {
      expect(xstat).to.be.null
      expect(resolved).to.deep.equal([false, true])
      done()
    })
  })

  it('success if newPath is file', done => {
    mkdirp.sync('tmptest/c')
    fs.copyFileSync('testdata/foo', 'tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'skip'], (err, xstat, resolved) => {
      expect(xstat).to.be.null
      expect(resolved).to.deep.equal([false, true])
      done()
    })
  })
})

describe(path.basename(__filename) + ' mvdir, [rename]', () => {
  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
    fs.mkdirSync('tmptest/a')
    await mkdirAsync('tmptest/a/b', [])
  })

  it('ENOENT if parent of newPath does not exist', done => {
    mvdir('tmptest/a/b', 'tmptest/c/d', ['rename'], (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is file', done => {
    fs.copyFileSync('testdata/foo', 'tmptest/c')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['rename'], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/c')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['rename'], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('success if newPath does not exist', done => {
    fs.mkdirSync('tmptest/c')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['rename'], (err, xstat, resolved) => {
      if (err) return done(err)
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([false, false])
      done()
    })
  })

  it('success if newPath is dir', done => {
    mkdirp.sync('tmptest/c/d')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['rename'], (err, xstat, resolved) => {
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd (2)',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([true, false])
      done()
    })
  })

  // EISSYMLINK indicates newPath is a symlink
  it('EEXIST + EISSYMLINK, if newPath is (broken) symlink', done => {
    mkdirp.sync('tmptest/c')
    fs.symlinkSync('hello', 'tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['rename'], (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISSYMLINK')
      done()
    })
  })

  it('EEXIST + EISFILE if newPath is file', done => {
    mkdirp.sync('tmptest/c')
    fs.copyFileSync('testdata/foo', 'tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['rename'], (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISFILE')
      done()
    })
  })
})

describe(path.basename(__filename) + ' mvfile, [,rename]', () => {
  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
    fs.mkdirSync('tmptest/a')
    await mkdirAsync('tmptest/a/b', [])
  })

  it('ENOENT if parent of newPath does not exist', done => {
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'rename'], (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is file', done => {
    fs.copyFileSync('testdata/foo', 'tmptest/c')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'rename'], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/c')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'rename'], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('success if newPath does not exist', done => {
    fs.mkdirSync('tmptest/c')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'rename'], (err, xstat, resolved) => {
      if (err) return done(err)
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([false, false])
      done()
    })
  })

  it('EEXIST + EISDIR, if newPath is dir', done => {
    mkdirp.sync('tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'rename'], (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISDIR')
      done()
    })
  })

  it('success if newPath is (broken) symlink', done => {
    mkdirp.sync('tmptest/c')
    fs.symlinkSync('hello', 'tmptest/c/d')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'rename'], (err, xstat, resolved) => {
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd (2)',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([false, true])
      done()
    })
  })

  it('success if newPath is file', done => {
    mkdirp.sync('tmptest/c')
    fs.copyFileSync('testdata/foo', 'tmptest/c/d')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'rename'], (err, xstat, resolved) => {
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd (2)',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([false, true])
      done()
    })
  })
})

describe(path.basename(__filename) + ' mvfile, [replace]', () => {
  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
    fs.mkdirSync('tmptest/a')
    await mkdirAsync('tmptest/a/b', [])
  })

  it('ENOENT if parent of newPath does not exist', done => {
    mvdir('tmptest/a/b', 'tmptest/c/d', ['replace'], (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is file', done => {
    fs.copyFileSync('testdata/foo', 'tmptest/c')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['replace'], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/c')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['replace'], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('success if newPath does not exist', done => {
    fs.mkdirSync('tmptest/c')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['replace'], (err, xstat, resolved) => {
      if (err) return done(err)
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([false, false])
      done()
    })
  })

  it('success if newPath is dir', done => {
    mkdirp.sync('tmptest/c/d')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['replace'], (err, xstat, resolved) => {
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([true, false])
      done()
    })
  })

  // EISSYMLINK indicates newPath is a dir
  it('EEXIST + EISSYMLINK, if newPath is (broken) symlink', done => {
    mkdirp.sync('tmptest/c')
    fs.symlinkSync('hello', 'tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['replace'], (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISSYMLINK')
      done()
    })
  })

  it('EEXIST + EISFILE, if newPath is file', done => {
    mkdirp.sync('tmptest/c')
    fs.copyFileSync('testdata/foo', 'tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['replace'], (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISFILE')
      done()
    })
  })
})

describe(path.basename(__filename) + ' mvfile, [,replace]', () => {
  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
    fs.mkdirSync('tmptest/a')
    await mkdirAsync('tmptest/a/b', [])
  })

  it('ENOENT if parent of newPath does not exist', done => {
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'replace'], (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is file', done => {
    fs.copyFileSync('testdata/foo', 'tmptest/c')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'replace'], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/c')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'replace'], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('success if newPath does not exist', done => {
    fs.mkdirSync('tmptest/c')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'replace'], (err, xstat, resolved) => {
      if (err) return done(err)
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([false, false])
      done()
    })
  })

  it('EEXIST + EISDIR, if newPath is dir', done => {
    mkdirp.sync('tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'replace'], (err, xstat) => {
      expect(err.code).to.equal('EEXIST')
      expect(err.xcode).to.equal('EISDIR')
      done()
    })
  })

  it('success if newPath is (broken) symlink', done => {
    mkdirp.sync('tmptest/c')
    fs.symlinkSync('hello', 'tmptest/c/d')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'replace'], (err, xstat, resolved) => {
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([false, true])
      done()
    })
  })

  it('success if newPath is file', done => {
    mkdirp.sync('tmptest/c')
    fs.copyFileSync('testdata/foo', 'tmptest/c/d')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', [,'replace'], (err, xstat, resolved) => {
      if (err) return done(err)
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([false, true])
      done()
    })
  })
})

describe(path.basename(__filename) + 'mvfile, [skip/rename/replace, skip/rename/replace]', () => {
  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
    fs.mkdirSync('tmptest/a')
    await mkdirAsync('tmptest/a/b', [])
  })

  it('[skip, skip],success if newPath is file', done => {
    mkdirp.sync('tmptest/c')
    fs.copyFileSync('testdata/foo', 'tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['skip', 'skip'], (err, xstat, resolved) => {
      expect(xstat).to.be.null
      expect(resolved).to.deep.equal([false, true])
      done()
    })
  })

  it('[skip, skip], success if newPath is (broken) symlink', done => {
    mkdirp.sync('tmptest/c')
    fs.symlinkSync('hello', 'tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['skip', 'skip'], (err, xstat, resolved) => {
      expect(xstat).to.be.null
      expect(resolved).to.deep.equal([false, true])
      done()
    })
  })

  it('[skip, skip],success if newPath is dir', done => {
    mkdirp.sync('tmptest/c/d')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['skip', 'skip'], (err, xstat, resolved) => {
      let attr = JSON.parse(xattr.getSync('tmptest/c/d', 'user.fruitmix'))
      let stat = fs.lstatSync('tmptest/c/d')
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([true, false])
      done()
    })
  })

  it('[rename, rename],success if newPath is file', done => {
    mkdirp.sync('tmptest/c')
    fs.copyFileSync('testdata/foo', 'tmptest/c/d')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['rename', 'rename'], (err, xstat, resolved) => {
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd (2)',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([false, true])
      done()
    })
  })

  it('[rename, rename],success if newPath is symlink', done => {
    mkdirp.sync('tmptest/c')
    fs.symlinkSync('hello', 'tmptest/c/d')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['rename', 'rename'], (err, xstat, resolved) => {
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd (2)',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([false, true])
      done()
    })
  })

  it('[rename, rename],success if newPath is dir', done => {
    mkdirp.sync('tmptest/c/d')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['rename', 'rename'], (err, xstat, resolved) => {
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd (2)',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([true, false])
      done()
    })
  })

  it('[replace, replace], success if newPath is file', done => {
    mkdirp.sync('tmptest/c')
    fs.copyFileSync('testdata/foo', 'tmptest/c/d')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['replace', 'replace'], (err, xstat, resolved) => {
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([false, true])
      done()
    })
  })

  it('[replace, replace], success if newPath is (broken) symlink', done => {
    mkdirp.sync('tmptest/c')
    fs.symlinkSync('hello', 'tmptest/c/d')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['replace', 'replace'], (err, xstat, resolved) => {
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([false, true])
      done()
    })
  })

   it('[replace, replace], success if newPath is dir', done => {
    mkdirp.sync('tmptest/c/d')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvdir('tmptest/a/b', 'tmptest/c/d', ['replace', 'replace'], (err, xstat, resolved) => {
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'directory',
        name: 'd',
        mtime: stat.mtime.getTime()
      })
      expect(resolved).to.deep.equal([true, false])
      done()
    })
  })
})

