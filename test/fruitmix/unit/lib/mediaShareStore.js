import path from 'path'
import crypto from 'crypto'

import { expect } from 'chai'
import { rimrafAsync, mkdirpAsync, fs } from 'src/fruitmix/util/async'
import { DIR } from 'src/fruitmix/lib/const'

import { createDocumentStore } from 'src/fruitmix/lib/documentStore'
import { createMediaShareStore } from 'src/fruitmix/lib/mediaShareStore'

const tmptest = path.join(process.cwd(), 'tmptest')

describe(path.basename(__filename), function() {

  const createDocumentStoreAsync = Promise.promisify(createDocumentStore)

  let docstore

  const share001 = {
    uuid: 'f889ec47-6092-4a6d-9647-3d6ef5fe2cab',
    x: 1,
    y: 2
  }
  const share001Hash = '0515fce20cc8b5a8785d4a9d8e51dd14e9ca5e3bab09e1bc0bd5195235e259ca'

  const share002 = {
    uuid: 'e3721bbe-edda-4ccc-bc4d-2ccd90dd0834',
    m: 'hello',
    n: 'world'
  }

// hash changed after documentStore using canonical-json
//  const share002Hash = '143bc7717d46e797418c7ebc9aff5fbe038028b727d4bae7315ad5f85504d9e3'
  const share002Hash = '018ceb737f51bf1b8fc9626ab36f9a92907a52d05a7e5574e35c3fd5240908ba'
  
  describe('create mediashare store', function() {

    beforeEach(() => (async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmptest)
      docstore = await createDocumentStoreAsync(tmptest)
    })())

    afterEach(() => (async () => {
      await rimrafAsync('tmptest')
    })())

    it('should create a mediashare store (nonsense example)', function(done) {
      createMediaShareStore(tmptest, docstore, (err, msstore) => {
        expect(msstore.rootdir).to.equal(path.join(tmptest, DIR.MSHARE)) 
        expect(msstore.arcdir).to.equal(path.join(tmptest, DIR.MSHAREARC))
        expect(msstore.tmpdir).to.equal(path.join(tmptest, DIR.TMP))
        expect(msstore.docstore).to.equal(docstore)
        done()
      })
    })
  })
  
  describe('store sharedocument ref', function() {

    let msstore
    const createMediaShareStoreAsync = Promise.promisify(createMediaShareStore)

    beforeEach(() => (async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmptest)
      docstore = await createDocumentStoreAsync(tmptest)
      msstore = await createMediaShareStoreAsync(tmptest, docstore)
    })())

    afterEach(() => (async () => {
      await rimrafAsync('tmptest')
    })())

    it('should store share001 with correct ref file', function(done) {
      msstore.store(share001, err => {
        if (err) return done(err)
        let refpath = path.join(msstore.rootdir, share001.uuid)
        fs.readFile(refpath, (err, data) => {
          if (err) return done(err)
          expect(data.toString()).to.equal(share001Hash)
          done()
        })
      })
    })

    it('should store share001 in docstore', function(done) {
      msstore.store(share001, err => {
        if (err) return done(err)
        docstore.retrieve(share001Hash, (err, object) => {
          if (err) return done(err)
          expect(object).to.deep.equal(share001)
          done()
        })
      })
    })

    it('should store share001 and return digest', function(done) {
      msstore.store(share001, (err, digest) => {
        if (err) return done(err)
        expect(digest).to.equal(share001Hash)
        done()
      })
    })
  })

  describe('archive sharedocument ref', function() {

    let msstore
    const createMediaShareStoreAsync = Promise.promisify(createMediaShareStore)

    beforeEach(() => (async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmptest)
      docstore = await createDocumentStoreAsync(tmptest)
      msstore = await createMediaShareStoreAsync(tmptest, docstore)
    })())

    afterEach(() => (async () => {
      await rimrafAsync('tmptest')
    })())

    it('archive should remove share001 ref out of root folder', function(done) {
      msstore.store(share001, (err, digest) => {
        if (err) return done(err)
        msstore.archive(share001.uuid, err => {
          if (err) return done(err)
          let srcpath = path.join(msstore.rootdir, share001.uuid)
          fs.stat(srcpath, err => {
            expect(err).to.be.an('error')
            expect(err.code).to.equal('ENOENT')
            done()
          })
        })
      })
    })

    it('archive should move share001 ref to archive folder', function(done) {
      msstore.store(share001, (err, share) => {
        if (err) return done(err)
        msstore.archive(share001.uuid, err => {
          if (err) return done(err)
          let dstpath = path.join(msstore.arcdir, share001.uuid)
          fs.readFile(dstpath, (err, data) => {
            if (err) return done(err)
            expect(data.toString()).to.equal(share001Hash)
            done()
          })
        })
      })
    })
  })

  describe('retrieve sharedocument ref', function() {

    let msstore
    const createMediaShareStoreAsync = Promise.promisify(createMediaShareStore)

    beforeEach(() => (async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmptest)
      docstore = await createDocumentStoreAsync(tmptest)
      msstore = await createMediaShareStoreAsync(tmptest, docstore)
    })())

    afterEach(() => (async () => {
      await rimrafAsync('tmptest')
    })())

    it('should retrieve share001 back with uuid', function(done) {
      msstore.store(share001, err => {
        if (err) return done(err)
        msstore.retrieve(share001.uuid, (err, object) => {
          if (err) return done(err)
          expect(object).to.deep.equal({ 
            digest: share001Hash,
            doc: share001
          })
          done()
        })
      })
    })

    it('should retrieve share001 and share002 by retrieve all', function(done) {
      msstore.store(share001, err => {
        if (err) return done(err)
        msstore.store(share002, err => {
          if (err) return done(err)
          msstore.retrieveAll((err, array) => {
            if (err) return done(err)
            let x = [
              { digest: share001Hash, doc: share001 },
              { digest: share002Hash, doc: share002 }
            ]

            expect(array.sort((a, b) => a.digest.localeCompare(b.digest))).to.deep
              .equal(x.sort((a, b) => a.digest.localeCompare(b.digest)))
            done()
          })
        })
      })
    })
  })
  
})


