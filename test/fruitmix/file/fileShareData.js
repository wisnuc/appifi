import path from 'path'
import { expect } from 'chai'
import EventEmitter from 'events'

import { rimrafAsync, mkdirpAsync } from '../../../src/fruitmix/util/async'
import { createDocumentStoreAsync } from '../../../src/fruitmix/lib/documentStore'
import { createFileShareStoreAsync } from '../../../src/fruitmix/lib/shareStore'
import { createFileShareDoc, updateFileShareDoc } from '../../../src/fruitmix/file/fileShareDoc'
import { createFileShareData } from '../../../src/fruitmix/file/fileShareData'
import E from '../../../src/fruitmix/lib/error'
import FileData from '../../../src/fruitmix/file/fileData'
const tree = require('./testTrees')

const cwd = process.cwd()
const tmpdir = path.join(cwd, 'tmptest')
const froot = path.join(tmpdir, 'tmptest')

describe(path.basename(__filename), () => {

  let model, fileData

  let uuid2 = tree.UUIDMap.get('uuid2')
  let uuid3 = tree.UUIDMap.get('uuid3')
  let uuid4 = tree.UUIDMap.get('uuid4')
  let uuid5 = tree.UUIDMap.get('uuid5')
  let uuid6 = tree.UUIDMap.get('uuid6')
  let uuid9 = tree.UUIDMap.get('uuid9')
  let userUUID = tree.UUIDMap.get('userUUID')
  let aliceUUID = tree.UUIDMap.get('aliceUUID')
  let bobUUID = tree.UUIDMap.get('bobUUID')
  let charlieUUID = tree.UUIDMap.get('charlieUUID')


  before(async () => {
    await rimrafAsync('tmptest') 
    await mkdirpAsync('tmptest')

    model = tree.model
    fileData = new FileData(tmpdir, model)
    await tree.createTestTrees(model, fileData)
  })

  after(async() => await rimrafAsync('tmptest'))

  let fileShareStore, fileShareData

  beforeEach(async () => {
    await rimrafAsync(froot)
    await mkdirpAsync(froot)

    let docstore = await createDocumentStoreAsync(froot)
    fileShareStore = await createFileShareStoreAsync(froot, docstore)
    fileShareData = createFileShareData(model, fileShareStore, fileData)
  })

  afterEach(async () => await rimrafAsync(froot))

  describe('create a fileShareData', function() {

    it('should create a fileShareData', done => {
      expect(fileShareData.model).to.deep.equal(model)
      expect(fileShareData.fileShareStore).to.deep.equal(fileShareStore)
      expect(fileShareData.fileShareMap).to.deep.equal(new Map())
      done()
    })
  })

  describe('createFileShare', function() {
    let doc
    let post = { writelist: [aliceUUID],
                 readlist: [bobUUID],
                 collection: [uuid2, uuid4, uuid6] 
               }

    beforeEach(() => doc = createFileShareDoc(fileData, userUUID, post))

    it('new fileshare should be set into fileShareMap', async () => {
      await fileShareData.createFileShare(doc)
      expect(fileShareData.findShareByUUID(doc.uuid).doc).to.deep.equal(doc)
    })

    it('new fileshare should be a frozen object', async () => {
      await fileShareData.createFileShare(doc)
      expect(Object.isFrozen(fileShareData.findShareByUUID(doc.uuid))).to.be.true
    })
  })

  describe('updateFileShare', function() {
    let doc
    let post = { writelist: [aliceUUID],
                 readlist: [bobUUID],
                 collection: [uuid2, uuid4, uuid6] 
               }
    beforeEach(async () => {
      doc = createFileShareDoc(fileData, userUUID, post)
      await fileShareData.createFileShare(doc)
    })

    it('updated fileshare should be put into fileShareMap', async () => {
      let patch = [{path: 'writelist',
                    operation: 'add',
                    value: [charlieUUID]
                  }]
      let newDoc = updateFileShareDoc(fileData, doc, patch)
      await fileShareData.updateFileShare(newDoc)
      expect(fileShareData.findShareByUUID(doc.uuid).doc).to.deep.equal(newDoc)
    })

    it('updated fileshare should be a frozen object', async () => {
      let patch = [{path: 'writelist',
                    operation: 'add',
                    value: [charlieUUID]
                  }]
      let newDoc = updateFileShareDoc(fileData, doc, patch)
      await fileShareData.updateFileShare(newDoc)
      expect(Object.isFrozen(fileShareData.findShareByUUID(doc.uuid))).to.be.true
    })

    it('should throw error if target uuid is not found', async () => {
      let err
      let patch = [{path: 'writelist',
                    operation: 'add',
                    value: [charlieUUID]
                  }]
      let newDoc = updateFileShareDoc(fileData, doc, patch)
      fileShareData.fileShareMap.delete(doc.uuid)

      try {
        await fileShareData.updateFileShare(newDoc)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.ENOENT)
    })
  })

  describe('deleteFileShare', function() {
    let doc
    let post = { writelist: [aliceUUID],
                 readlist: [bobUUID],
                 collection: [uuid2, uuid4, uuid6] 
               }
    beforeEach(async () => {
      doc = createFileShareDoc(fileData, userUUID, post)
      await fileShareData.createFileShare(doc)
    })

    it('should throw error if uuid is not exist in fileShareMap', async () => {
      let err
      fileShareData.fileShareMap.delete(doc.uuid)
      try {
        await fileShareData.deleteFileShare(doc.uuid)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.ENOENT)
    })

    it('should remove fileshare from fileShareMap successfully', async () => {
      await fileShareData.deleteFileShare(doc.uuid)
      expect(fileShareData.findShareByUUID(doc.uuid)).to.be.undefined
    })
  })

  describe('userAuthorizedToRead', function() {
    let doc
    let post = { writelist: [aliceUUID],
                 readlist: [bobUUID],
                 collection: [uuid2, uuid4, uuid6] 
               }
    beforeEach(async () => {
      doc = createFileShareDoc(fileData, userUUID, post)
      await fileShareData.createFileShare(doc)
    })

    it('should return true if user is in readerSet', done => {
      let n3 = fileData.findNodeByUUID(uuid3)
      let result = fileShareData.userAuthorizedToRead(bobUUID, n3)
      expect(result).to.be.true
      done()
    })

    it('should return false if user is not in readerSet', done => {
      let n3 = fileData.findNodeByUUID(uuid3)
      let result = fileShareData.userAuthorizedToRead(charlieUUID, n3)
      expect(result).to.be.false
      done()
    })
  })

  describe('userAuthorizedToWrite', function() {
    let doc
    let post = { writelist: [aliceUUID],
                 readlist: [bobUUID],
                 collection: [uuid2, uuid4, uuid6] 
               }
    beforeEach(async () => {
      doc = createFileShareDoc(fileData, userUUID, post)
      await fileShareData.createFileShare(doc)
    })

    it('should return true if user is in writelist', done => {
      let n3 = fileData.findNodeByUUID(uuid3)
      let result = fileShareData.userAuthorizedToWrite(aliceUUID, n3)
      expect(result).to.be.true
      done()
    })

    it('should return false if user is not in writelist', done => {
      let n3 = fileData.findNodeByUUID(uuid3)
      let result = fileShareData.userAuthorizedToWrite(bobUUID, n3)
      expect(result).to.be.false
      done()
    })
  })

  describe('load', function() {
    let doc1, doc2
    let post1 = { writelist: [aliceUUID],
                  readlist: [bobUUID],
                  collection: [uuid2, uuid4, uuid6] 
                }
    let post2 = { writelist: [charlieUUID],
                 readlist: [bobUUID],
                 collection: [uuid9] 
               }
    beforeEach(async () => {
      doc1 = createFileShareDoc(fileData, userUUID, post1)
      doc2 = createFileShareDoc(fileData, aliceUUID, post2)
      await fileShareStore.storeAsync(doc1)
      await fileShareStore.storeAsync(doc2)
    })

    it('should load fileshare that is already exist', async () => {
      await fileShareData.load()
      expect(fileShareData.findShareByUUID(doc1.uuid).doc).to.deep.equal(doc1)
      expect(fileShareData.findShareByUUID(doc2.uuid).doc).to.deep.equal(doc2)
    })
  })

  describe('findSharePath', function() {
    let doc
    let post = { writelist: [aliceUUID],
                 readlist: [bobUUID],
                 collection: [uuid2, uuid4, uuid6] 
               }
    beforeEach(async () => {
      doc = createFileShareDoc(fileData, userUUID, post)
      await fileShareData.createFileShare(doc)
    })

    it('should return the path from ancestor to given node', done => {
      let sharePath = fileShareData.findSharePath(doc.uuid, uuid4)
      expect(sharePath).to.deep.equal('n2/n3/n4')
      done()
    })

    it('should return error if share is not found', done => {
      let sharePath = fileShareData.findSharePath(uuid2, uuid4)
      expect(sharePath).to.be.an.instanceof(E.ENOENT)
      done()
    })

    it('should return error if node is not in given share', done => {
      let sharePath = fileShareData.findSharePath(doc.uuid, uuid5)
      expect(sharePath).to.be.an.instanceof(E.ENODENOTFOUND)
      done()
    })
  })

  describe('getUserFlieShares', function() {
    let share1, share2
    let post1 = { writelist: [aliceUUID],
                  readlist: [bobUUID],
                  collection: [uuid2, uuid4, uuid6] 
                }
    let post2 = { writelist: [charlieUUID],
                 readlist: [bobUUID],
                 collection: [uuid9] 
               }
    beforeEach(async () => {
      let doc1 = createFileShareDoc(fileData, userUUID, post1)
      let doc2 = createFileShareDoc(fileData, aliceUUID, post2)
      share1 = await fileShareData.createFileShare(doc1)
      share2 = await fileShareData.createFileShare(doc2)
    })

    it('should return shares user is author or in readerSet', async () => {
      let shares = await fileShareData.getUserFileShares(aliceUUID)
      expect(shares[0]).to.deep.equal(share1)
      expect(shares[1]).to.deep.equal(share2)
    })

  })
})

