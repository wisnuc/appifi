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
const { mkdir, mkfile, mvfile } = require('src/vfs/underlying')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

const mkfileAsync = Promise.promisify(mkfile)

describe(path.basename(__filename) + ' mvfile, []', () => {
  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
    fs.copyFileSync('testdata/alonzo_church.jpg', 'tmptest/tmp')
    fs.mkdirSync('tmptest/a')
    let result = await mkfileAsync('tmptest/a/b', 'tmptest/tmp', null, [])
    // console.log(result)
  })

  it('ENOENT if parent of newPath does not exist', done => {
    mvfile('tmptest/a/b', 'tmptest/c/d', [], (err, xstat) => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is file', done => {
    fs.copyFileSync('tmptest/tmp', 'tmptest/c')
    mvfile('tmptest/a/b', 'tmptest/c/d', [], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('ENOTDIR if parent of newPath is (broken) symlink', done => {
    fs.symlinkSync('hello', 'tmptest/c')
    mvfile('tmptest/a/b', 'tmptest/c/d', [], (err, xstat) => {
      expect(err.code).to.equal('ENOTDIR')
      done()
    })
  })

  it('success if newPath does not exist', done => {
    fs.mkdirSync('tmptest/c')
    let attr = JSON.parse(xattr.getSync('tmptest/a/b', 'user.fruitmix'))
    let stat = fs.lstatSync('tmptest/a/b')
    mvfile('tmptest/a/b', 'tmptest/c/d', [], (err, xstat, resolved) => {
      if (err) done(err)
      expect(xstat).to.deep.equal({
        uuid: attr.uuid,
        type: 'file',
        name: 'd',
        mtime: stat.mtime.getTime(),
        size: stat.size,
        magic: 'JPEG'
      })
      expect(resolved).to.deep.equal([false, false])
      done()
    })
  })
})

describe(path.basename(__filename) + ' mvfile, [skip]', () => {

})

describe(path.basename(__filename) + ' mvfile, [,skip]', () => {
  
})

describe(path.basename(__filename) + ' mvfile, [rename]', () => {
  
})

describe(path.basename(__filename) + ' mvfile, [,rename]', () => {
  
})

describe(path.basename(__filename) + ' mvfile, [replace]', () => {
  
})

describe(path.basename(__filename) + ' mvfile, [,replace]', () => {
  
})

describe(path.basename(__filename) + ' mvfile, [rename]', () => {
  
})

describe(path.basename(__filename) + ' mvfile, [,rename]', () => {
  
})
