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

// const userUUID = 'c9f1d82e-5d88-46d7-ad43-24d51b1b6628'
// const aliceUUID = 'b9aa7c34-8b86-4306-9042-396cf8fa1a9c'
// const bobUUID = 'f97f9e1f-848b-4ed4-bd47-1ddfa82b2777'
// const charlieUUID = 'e5f23cb9-1852-475d-937d-162d2554e22c'

// const uuid1 = '1ec6533f-fab8-4fad-8e76-adc76f80aa2f'
// const uuid2 = '278a60cf-2ba3-4eab-8641-e9a837c12950'
// const uuid3 = '3772dd7e-7a4c-461a-9a7e-79310678613a'
// const uuid4 = '4ba43b18-326a-4011-90ce-ec78afca9c43'
// const uuid5 = '5da92303-33a1-4f79-8d8f-a7b6becde6c3'
// const uuid6 = '6e702f92-6073-4c11-a406-0a4776212d14'
// const uuid7 = '75b5dac2-591a-4c63-8e5e-a955ce51b576'
// const uuid8 = '8359f954-ade1-43e1-918e-8ca9d2dc81a0'
// const uuid9 = '97e352f8-5535-473d-9dac-8706ffb79abb'
// const uuid10 = '016ca193-af05-467e-bbfa-844859bd7f9e'
// const uuid11 = 'a8eec3c8-70e5-411b-90fd-ee3e181254b9'

// class Model extends EventEmitter {
//   constructor() {
//     super()
//   }

//   getUsers() {
//     return [ {uuid: 'c9f1d82e-5d88-46d7-ad43-24d51b1b6628', type: 'local'},
//              {uuid: 'b9aa7c34-8b86-4306-9042-396cf8fa1a9c', type: 'local'},
//              {uuid: 'f97f9e1f-848b-4ed4-bd47-1ddfa82b2777', type: 'local'},
//              {uuid: 'e5f23cb9-1852-475d-937d-162d2554e22c', type: 'local'},
//              {uuid: 'b8ff0e08-0acb-4013-8129-a4d913e79339', type: 'remote'},
//            ]
//   }
// }

const cwd = process.cwd()
const tmpdir = path.join(cwd, 'tmptest')
const froot = path.join(tmpdir, 'tmptest')

describe(path.basename(__filename), () => {

  let model, fileData

  let uuid1 = tree.UUIDMap.get('uuid1')
  let uuid2 = tree.UUIDMap.get('uuid2')
  let uuid4 = tree.UUIDMap.get('uuid4')
  let uuid6 = tree.UUIDMap.get('uuid6')
  let uuid9 = tree.UUIDMap.get('uuid9')
  let uuid10 = tree.UUIDMap.get('uuid10')
  let uuid11 = tree.UUIDMap.get('uuid11')
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
      share1 = await fileShareService.createFileShare(userUUID, post1)
      share2 = await fileShareService.createFileShare(aliceUUID, post2)
    })

    it('should return shares user is author or in readerSet', async () => {
      let shares = await fileShareService.getUserFileShares(aliceUUID)
      expect(shares[0]).to.deep.equal(share1)
      expect(shares[1]).to.deep.equal(share2)
    })
  })
})





