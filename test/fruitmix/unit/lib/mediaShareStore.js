import path from 'path'
import crypto from 'crypto'

import { expect } from 'chai'
import { rimrafAsync, mkdirpAsync, fs } from 'src/fruitmix/util/async'
import paths from 'src/fruitmix/lib/paths'

import { createDocumentStore } from 'src/fruitmix/lib/documentStore'
import { createMediaShareStore } from 'src/fruitmix/lib/mediaShareStore'

describe(path.basename(__filename), function() {

  const cwd = process.cwd()
  let docroot = path.join(cwd, 'tmptest', 'documents')
  let arcroot = path.join(cwd, 'tmptest', 'mediashareArchive')
  let msroot = path.join(cwd, 'tmptest', 'mediashare')
  let tmpdir = path.join(cwd, 'tmptest', 'tmp')

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
  
  beforeEach(() => (async () => {

    let root = path.join(cwd, 'tmptest')
    await rimrafAsync(root)
    await paths.setRootAsync(root)
    docstore = await createDocumentStoreAsync()

  })())

  it('should create a mediashare store (nonsense example)', function() {

    let mstore = createMediaShareStore(docstore)
    expect(mstore.rootdir).to.equal(msroot) 
    expect(mstore.arcdir).to.equal(arcroot)
    expect(mstore.tmpdir).to.equal(tmpdir)
    expect(mstore.docstore).to.equal(docstore)
  })

  it('should store share001 with correct ref file', function(done) {
    let mstore = createMediaShareStore(docstore)
    mstore.store(share001, err => {
      if (err) return done(err)
      let refpath = path.join(msroot, share001.uuid)
      fs.readFile(refpath, (err, data) => {
        if (err) return done(err)
        expect(data.toString()).to.equal(share001Hash)
        done()
      })
    })
  })

  it('should store share001 in docstore', function(done) {
    let mstore = createMediaShareStore(docstore)
    mstore.store(share001, err => {
      if (err) return done(err)
      docstore.retrieve(share001Hash, (err, object) => {
        if (err) return done(err)
        expect(object).to.deep.equal(share001)
        done()
      })
    })
  })

  it('should store share001 and return share (object)', function(done) {
    let mstore = createMediaShareStore(docstore)
    mstore.store(share001, (err, share) => {
      if (err) return done(err)
      expect(share.digest).to.equal(share001Hash)
      expect(share.doc).to.equal(share001)
      done()
    })
  })

  it('archive should remove share001 ref out of root folder', function(done) {
    let mstore = createMediaShareStore(docstore)
    mstore.store(share001, (err, share) => {
      if (err) return done(err)
      mstore.archive(share001.uuid, err => {
        if (err) return done(err)
        let srcpath = path.join(msroot, share001.uuid)
        fs.stat(srcpath, err => {
          expect(err).to.be.an('error')
          expect(err.code).to.equal('ENOENT')
          done()
        })
      })
    })
  })

  it('archive should move share001 ref to archive folder', function(done) {
    let mstore = createMediaShareStore(docstore)
    mstore.store(share001, (err, share) => {
      if (err) return done(err)
      mstore.archive(share001.uuid, err => {
        if (err) return done(err)
        let dstpath = path.join(arcroot, share001.uuid)
        fs.readFile(dstpath, (err, data) => {
          if (err) return done(err)
          expect(data.toString()).to.equal(share001Hash)
          done()
        })
      })
    })
  })

  it('should retrieve share001 back with uuid', function(done) {
    let mstore = createMediaShareStore(docstore)
    mstore.store(share001, err => {
      if (err) return done(err)
      mstore.retrieve(share001.uuid, (err, object) => {
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
    let mstore = createMediaShareStore(docstore) 
    mstore.store(share001, err => {
      if (err) return done(err)
      mstore.store(share002, err => {
        if (err) return done(err)
        mstore.retrieveAll((err, array) => {
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


