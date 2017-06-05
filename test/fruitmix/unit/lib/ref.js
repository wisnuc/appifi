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
  let repoDir = path.join(tmptest, DIR.REPO)
  let tmpDir = path.join(tmptest, DIR.TMP)
  let docDir = path.join(tmptest, DIR.DOC)
  let ref

  beforeEach(async () => {
    await rimrafAsync(tmptest) 
    await mkdirpAsync(tmptest)
    await fs.writeFileAsync(filepath, 'hello')
    ref = new Ref(repoDir, tmpDir, docDir)
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

    it('stored file should be read only', async () => {
      let hash = await ref.storeFileAsync(filepath)
      try {
        await fs.writeFileAsync(path.join(ref.repoDir, hash), 'world')   
      } catch(e) {
        expect(e.code).to.equal('EACCES')
      }
    })

    it('should not store again if file is already exist', async () => {
      await ref.storeFileAsync(filepath)
      await ref.storeFileAsync(filepath)
      let entries = await fs.readdirAsync(ref.repoDir)
      expect(entries.length).to.equal(1)
    })
  })

  describe('retrieveFilePath', function() {

    it('should throw error if hash is not invalid', async () => {
      await ref.storeFileAsync(filepath)
      try {
        ref.retrieveFilePath('123')
      } catch(e) {
        expect(e).to.be.an.instanceof(E.EINVAL)
      }
    })

    it('should return a valid path', async () => {
      let hash = await ref.storeFileAsync(filepath)
      let fpath = ref.retrieveFilePath(hash)
      expect(fpath).to.equal(path.join(ref.repoDir, sha256))
    })
  })

  describe('storeDirAsync', function() {

    let testFolder = path.join(tmptest, 'testFolder')
    let fpath1 = path.join(testFolder, 'a.js' )
    let fpath2 = path.join(testFolder, 'b.js')
    let folder = path.join(testFolder, 'test')
    let fpath3 = path.join(folder, 'c.js')
    let fpath4 = path.join(folder, 'D.js')

    beforeEach(async () => { 
      await mkdirpAsync(testFolder)
      await fs.writeFileAsync(fpath1, 'this is a')
      await fs.writeFileAsync(fpath2, 'this is b')
      await mkdirpAsync(folder)
      await fs.writeFileAsync(fpath3, 'this is c')
      await fs.writeFileAsync(fpath4, 'this is D')
    })

    it('should throw error if path is not a directory', async () => {
      try {
        await ref.storeDirAsync(filepath)
      } catch(e) {
        expect(e).to.be.an.instanceof(E.ENOTDIR)
      }
    })

    it('should return a hash', async () => {
      let hash = await ref.storeDirAsync(testFolder)
      console.log(hash)
    })
  })

  // describe('retrieveObjectAsync', function() {

  // })
})






