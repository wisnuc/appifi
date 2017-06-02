const path = require('path')
const { expect } = require('chai')
const fs = require('fs')
const xattr = require('fs-xattr')

const { DIR } = require('../../../../src/fruitmix/lib/const')
const { Ref, filehashAsync } = require('../../../../src/fruitmix/lib/ref')
const { rimrafAsync, mkdirpAsync } = require('../../../../src/fruitmix/util/async')
const E = require('../../../../src/fruitmix/lib/error')

const tmptest = path.join(process.cwd(), 'tmptest')

describe(path.basename(__filename), function() {
  let filepath = path.join(tmptest, 'test.js')
  let sha256 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'

  beforeEach(async () => {
    await rimrafAsync(tmptest) 
    await mkdirpAsync(tmptest)
    await fs.writeFileAsync(filepath, 'hello')
  })

  afterEach(async () => {
    await rimrafAsync(tmptest)
  })

  describe('filehashAsync', function() {

    it('should throw error if filepath is not absolute path', async () => {
      let fpath = '../../../../tmptest/test'
      try {
        await filehashAsync(fpath)
      } catch(e) {
        expect(e).to.be.an.instanceof(E.EINVAL)
      }
    })

    it('should throw error if path is not a file', async () => {
      try {
        await filehashAsync(tmptest)
      } catch(e) {
        expect(e).to.be.an.instanceof(E.EINVAL)
      }
    })

    it('should return a valid hash', async () => {
      let hash = await filehashAsync(filepath)
      expect(hash).to.equal(sha256)
    })
  })

  describe('storeFlieAsync', function() {
    let repoDir = path.join(tmptest, DIR.REPO)
    let tmpDir = path.join(tmptest, DIR.TMP)
    let docDir = path.join(tmptest, DIR.DOC)
    let ref

    before(() => {
      ref = new Ref(repoDir, tmpDir, docDir)
    })

    it('should throw error if filepath is not absolute', async () => {
      let fpath = '../../../../tmptest/test'
      try {
        await ref.storeFileAsync(fpath)
      } catch(e) {
        expect(e).to.be.an.instanceof(E.EINVAL)
      }
    })

    it('should throw error if path is not file', async () => {
      try {
        await ref.storeFileAsync(tmptest)
      } catch(e) {
        expect(e).to.be.an.instanceof(E.EINVAL)
      }
    })

    it('should calculate hash if file has no xattr', async () => {
      try {
        await xattr.getAsync(filepath, 'user.fruitmix')
      } catch(e) {
        expect(e.code).to.be.equal('ENODATA')
      }
      
      let hash = await ref.storeFileAsync(filepath)
      expect(hash).to.equal(sha256)
    })

    it('should calculate hash if htime is outdated', async () => {
      let attr = {
        hash: '0515fce20cc8b5a8785d4a9d8e51dd14e9ca5e3bab09e1bc0bd5195235e259ca',
        htime: 1
      }

      await xattr.setAsync(filepath, 'user.fruitmix', JSON.stringify(attr))

      let hash = await ref.storeFileAsync(filepath)
      expect(hash).to.equal(sha256)
    })

    it('should return hash if hash is valid', async () => {
      let stats = await fs.lstatAsync(filepath)
      let attr = {
        hash: sha256,
        htime: stats.mtime.getTime()
      }
      await xattr.setAsync(filepath, 'user.fruitmix', JSON.stringify(attr))

      let hash = await ref.storeFileAsync(filepath)
      expect(hash).to.equal(sha256)
    })
  })

  // describe('retrieveFilePath', function() {

  // })

  // describe('storeDirAsync', function() {

  // })

  // describe('retrieveObjectAsync', function() {

  // })
})






