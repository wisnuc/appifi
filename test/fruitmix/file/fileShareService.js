import path from 'path'
import { expect } from 'chai'
import sinon from 'sinon'
import EventEmitter from 'events'

import { rimrafAsync, mkdirpAsync } from '../../../src/fruitmix/util/async'
import { createDocumentStoreAsync } from '../../../src/fruitmix/lib/documentStore'
import { createFileShareStoreAsync } from '../../../src/fruitmix/lib/shareStore'
import { createFileShareData } from '../../../src/fruitmix/file/fileShareData'
import { createFileShareService } from '../../../src/fruitmix/file/fileShareService'
import E from '../../../src/fruitmix/lib/error'
import FileData from '../../../src/fruitmix/file/fileData'
const tree = require('./testTrees')

const cwd = process.cwd()
const tmpdir = path.join(cwd, 'tmptest')
const froot = path.join(tmpdir, 'tmptest')

describe(path.basename(__filename), () => {

  let model, fileData

  let uuid1 = tree.uuids.uuid1
  let uuid2 = tree.uuids.uuid2
  let uuid4 = tree.uuids.uuid4
  let uuid6 = tree.uuids.uuid6
  let uuid9 = tree.uuids.uuid9
  let uuid10 = tree.uuids.uuid10
  let uuid11 = tree.uuids.uuid11
  let userUUID = tree.uuids.userUUID
  let aliceUUID = tree.uuids.aliceUUID
  let bobUUID = tree.uuids.bobUUID
  let charlieUUID = tree.uuids.charlieUUID


  before(async () => {
    await rimrafAsync('tmptest') 
    await mkdirpAsync('tmptest')

    model = tree.model
    fileData = new FileData(tmpdir, model)
    await tree.createTestTrees(model, fileData)
  })

  after(async () => await rimrafAsync('tmptest'))

  let fileShareStore, fileShareData, fileShareService

  beforeEach(async () => {
    await rimrafAsync(froot)
    await mkdirpAsync(froot)

    let docstore = await createDocumentStoreAsync(froot)
    fileShareStore = await createFileShareStoreAsync(froot, docstore)
    fileShareData = createFileShareData(model, fileShareStore)
    fileShareService = createFileShareService(fileData, fileShareData)
  })

  afterEach(async () => await rimrafAsync(froot))

  describe('create a fileShareService', function() {
    it('should create a fileShareService successfully', done => {
      expect(fileShareService.fileData).to.deep.equal(fileData)
      expect(fileShareService.fileShareData).to.deep.equal(fileShareData)
      done()
    })
  })

  describe('createFileShare', function() {

    it('should return error if user is a invalid uuid', async () => {
      let err
      let post = { writelist: [aliceUUID],
                   readlist: [bobUUID],
                   collection: [uuid2, uuid4, uuid6]
                 }
      try { 
        await fileShareService.createFileShare('abcd', post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.EINVAL)
    })

    it('should return error if post is not a non-null object', async () => {
      let err
      let post = null
      try {
        await fileShareService.createFileShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.EINVAL)
    })

    it('should return error if post not contain mandatory props', async () => {
      let err
      let post = {writelist: [aliceUUID],
                  readlist: [bobUUID]
                 }
      try {
        await fileShareService.createFileShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an('error')
      expect(err.message).to.equal('some mandatory props not defined in object')
    })

    it('should return error if collection is not an array', async () => {
      let err
      let post = { writelist: [aliceUUID],
                   readlist: [bobUUID],
                   collection: uuid1
                 }
      try {
        await fileShareService.createFileShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.EINVAL)
    })

    it('should return error if collection is an empty array', async () => {
      let err
      let post = {writelist: [aliceUUID],
                  readlist: [bobUUID],
                  collection: []}
      try {
        await fileShareService.createFileShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.EINVAL)
    })

    it('should return error if user is not the drive owner of shared node', async () => {
      let err
      let post = {writelist: [aliceUUID],
                  readlist: [bobUUID],
                  collection: [uuid9]}
      try {
        await fileShareService.createFileShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })

    it('should return error if node is in public drive and not allowed to share', async () => {
      let err
      let post = {writelist: [aliceUUID],
                  readlist: [bobUUID],
                  collection: [uuid10]}
      try {
        await fileShareService.createFileShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })

    it('should return error if node is in public drive and user not in readerSet', async () => {
      let err
      let post = {writelist: [aliceUUID],
                  readlist: [bobUUID],
                  collection: [uuid11]}
      try {
        await fileShareService.createFileShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })
  })

  describe('updateFileShare', function() {
    let shareUUID
    let post = { writelist: [aliceUUID],
                 readlist: [bobUUID],
                 collection: [uuid2, uuid4, uuid6]
               }

    beforeEach(async() => {
      let fileShare = await fileShareService.createFileShare(userUUID, post)  
      shareUUID = fileShare.doc.uuid
    })

    it('should return error if share is not found', async () => {
      let err
      let uuid = '6790cdcb-8bce-4c67-9768-202a90aad8bf'
      let patch = [{path: 'writelist',
                    operation: 'add',
                    value: [charlieUUID]
                  }]
      try {
        await fileShareService.updateFileShare(userUUID, uuid, patch)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.ENOENT)
    })

    it('should return error if user is not the author', async () => {
      let err
      let patch = [{path: 'writelist',
                    operation: 'add',
                    value: [charlieUUID]
                  }]
      try {
        await fileShareService.updateFileShare(aliceUUID, shareUUID, patch)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })

    it('should return error if mandatory props not defined in patch', async () => {
      let err
      let patch = [{path: 'writelist',
                    value: [charlieUUID]
                  }]
      try {
        await fileShareService.updateFileShare(userUUID, shareUUID, patch)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an('error')
      expect(err.message).to.equal('some mandatory props not defined in object')
    })

    it('should return error if op.path is not in the given values', async () => {
      let err
      let patch = [{path: 'members',
                    operation: 'add',
                    value: [charlieUUID]
                  }]
      try {
        await fileShareService.updateFileShare(userUUID, shareUUID, patch)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EINVAL)
    })

    it('should return error if op.operation is not add or delete(for writelist,readlist, collection)', async () => {
      let err
      let patch = [{path: 'writelist',
                    operation: 'update',
                    value: [charlieUUID]
                  }]
      try {
        await fileShareService.updateFileShare(userUUID, shareUUID, patch)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EINVAL)
    })

    it('should return error if user is not the owner of uuid drive node', async () => {
      let err
      let patch = [{path: 'collection',
                    operation: 'add',
                    value: [uuid9]
                  }]
      try {
        await fileShareService.updateFileShare(userUUID, shareUUID, patch)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })

    it('should return error if the node is in public drive and not allowed to share', async () => {
      let err
      let patch = [{path: 'collection',
                    operation: 'add',
                    value: [uuid10]
                  }]
      try {
        await fileShareService.updateFileShare(userUUID, shareUUID, patch)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })

    it('should return error if node is in public drive but user is not in readerSet', async () => {
      let err
      let patch = [{path: 'collection',
                    operation: 'add',
                    value: [uuid11]
                  }]
      try {
        await fileShareService.updateFileShare(userUUID, shareUUID, patch)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })
  })

  describe('deleteFileShare', function() {
    let shareUUID
    let post = { writelist: [aliceUUID],
                 readlist: [bobUUID],
                 collection: [uuid2, uuid4, uuid6]
               }

    beforeEach(async() => {
      let fileShare = await fileShareService.createFileShare(userUUID, post)
      shareUUID = fileShare.doc.uuid
    })

    it('should renturn error if share is not found', async () => {
      let err
      let uuid = '6790cdcb-8bce-4c67-9768-202a90aad8bf'
      try {
        await fileShareService.deleteFileShare(userUUID, uuid)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.ENOENT)
    })

    it('should return error if user is not author', async () => {
      let err
      try {
        await fileShareService.deleteFileShare(charlieUUID, shareUUID)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })
  })

  describe('getUserFileShares', function() {
    // let share1, share2
    let post1 = { writelist: [aliceUUID],
                  readlist: [bobUUID],
                  collection: [uuid2, uuid4, uuid6] 
                }
    let post2 = { writelist: [charlieUUID],
                 readlist: [bobUUID],
                 collection: [uuid9] 
               }
    beforeEach(async () => {
      await fileShareService.createFileShare(userUUID, post1)
      await fileShareService.createFileShare(aliceUUID, post2)
    })

    it('should return shares user is author or in readerSet', async () => {
      let shares = await fileShareService.getUserFileShares(aliceUUID)
      let map1 = new Map([
        [uuid2, {uuid: uuid2, props:{shareable: false, readable: true, writeable: true}}],
        [uuid6, {uuid: uuid6, props:{shareable: false, readable: true, writeable: true}}]
      ])
      let map2 = new Map([
        [uuid9, {uuid: uuid9, props:{shareable: true, readable: true, writeable: true}}]
      ])
      expect(shares[0].doc.collection.get(uuid2)).to.deep.equal(map1.get(uuid2))
      expect(shares[0].doc.collection.get(uuid6)).to.deep.equal(map1.get(uuid6))
      expect(shares[1].doc.collection.get(uuid9)).to.deep.equal(map2.get(uuid9))
    })
  })
})





