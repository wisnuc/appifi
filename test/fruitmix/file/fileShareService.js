import path from 'path'
import { expect } from 'chai'
import sinon from 'sinon'

import { rimrafAsync, mkdirpAsync } from '../../../src/fruitmix/util/async'
import { createDocumentStore } from '../../../src/fruitmix/lib/documentStore'
import { createFileShareStore } from '../../../src/fruitmix/lib/shareStore'
import { createFileShareData } from '../../../src/fruitmix/file/fileShareData'
import { createFileShareService } from '../../../src/fruitmix/file/fileShareService'
import E from '../../../src/fruitmix/lib/error'

const userUUID = 'c9f1d82e-5d88-46d7-ad43-24d51b1b6628'
const aliceUUID = 'b9aa7c34-8b86-4306-9042-396cf8fa1a9c'
const bobUUID = 'f97f9e1f-848b-4ed4-bd47-1ddfa82b2777'
const charlieUUID = 'e5f23cb9-1852-475d-937d-162d2554e22c'

const uuid1 = '1ec6533f-fab8-4fad-8e76-adc76f80aa2f'
const uuid2 = '278a60cf-2ba3-4eab-8641-e9a837c12950'
const uuid3 = '3772dd7e-7a4c-461a-9a7e-79310678613a'
const uuid4 = '4ba43b18-326a-4011-90ce-ec78afca9c43'
const uuid5 = '5da92303-33a1-4f79-8d8f-a7b6becde6c3'
const uuid6 = '6e702f92-6073-4c11-a406-0a4776212d14'
const uuid7 = '75b5dac2-591a-4c63-8e5e-a955ce51b576'
const uuid8 = '8359f954-ade1-43e1-918e-8ca9d2dc81a0'
const uuid9 = '97e352f8-5535-473d-9dac-8706ffb79abb'

class Model {
  constructor() {}

  getUsers() {
    return [ {uuid: 'c9f1d82e-5d88-46d7-ad43-24d51b1b6628', type: 'local'},
             {uuid: 'b9aa7c34-8b86-4306-9042-396cf8fa1a9c', type: 'local'},
             {uuid: 'f97f9e1f-848b-4ed4-bd47-1ddfa82b2777', type: 'local'},
             {uuid: 'e5f23cb9-1852-475d-937d-162d2554e22c', type: 'local'},
             {uuid: 'b8ff0e08-0acb-4013-8129-a4d913e79339', type: 'remote'},
           ]
  }
}

class Node {
  constructor(uuid) {
    this.uuid = uuid
    this.parent = null
    this.children = []
  }

   root() {
    let node = this   
    while (node.parent !== null) node = node.parent
    return node
  }

  upFind(func) {
    let node = this
    while (node !== null) {
      if (func(node)) return node
      node = node.parent
    }
  }
}

class FileData {
  constructor() {
    this.uuidMap = new Map()
  }
}

const model = new Model()
const fileData = new FileData()

const n1 = new Node(uuid1)
const n2 = new Node(uuid2)
n2.parent = n1
n1.children.push(n2)
const n3 = new Node(uuid3)
n3.parent = n2
n2.children.push(n3)
const n4 = new Node(uuid4)
n4.parent = n3
n3.children.push(n4)
const n5 = new Node(uuid5)
n5.parent = n1
n1.children.push(n5)
const n6 = new Node(uuid6)
n6.parent = n1
n1.children.push(n6)
const n7 = new Node(uuid7)
n7.parent = n6
n6.children.push(n7)
const n8 = new Node(uuid8)
n8.parent = n7
n7.children.push(n8)
const n9 = new Node(uuid9)
n9.parent = n1

fileData.uuidMap.set(n1.uuid, n1)
fileData.uuidMap.set(n2.uuid, n2)
fileData.uuidMap.set(n3.uuid, n3)
fileData.uuidMap.set(n4.uuid, n4)
fileData.uuidMap.set(n5.uuid, n5)
fileData.uuidMap.set(n6.uuid, n6)
fileData.uuidMap.set(n7.uuid, n7)
fileData.uuidMap.set(n8.uuid, n8)
fileData.uuidMap.set(n9.uuid, n9)

const cwd = process.cwd()
const froot = path.join(cwd, 'tmptest')

const createDocumentStoreAsync = Promise.promisify(createDocumentStore)
const createFileShareStoreAsync = Promise.promisify(createFileShareStore)

describe(path.basename(__filename), function() {
  let fileShareStore, fileShareData, fileShareService

  beforeEach(async () => {
    await rimrafAsync('tmptest')
    await mkdirpAsync('tmptest')

    let docstore = await createDocumentStoreAsync(froot)
    fileShareStore = await createFileShareStoreAsync(froot, docstore)
    fileShareData = await createFileShareData(model, fileShareStore)
    fileShareService = createFileShareService(fileData, fileShareData)
  })

  afterEach(async () => await rimrafAsync('tmptest'))

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
                   collection: [uuid2, uuid4, uuid6, uuid9]
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

    it('should return error if user is not the root owner', async () => {
      let uuid_1 = 'd20e9aa2-7e66-41d1-8521-0c7e0b3f25d5'
      let uuid_2 = 'a8eec3c8-70e5-411b-90fd-ee3e181254b9'
      let node01 = new Node(uuid_1)
      node01.type = 'private'
      node01.owner = uuid_2
      fileData.uuidMap.set(uuid_1, node01)

      let err
      let post = {writelist: [aliceUUID],
                  readlist: [bobUUID],
                  collection: [uuid_1]}
      try {
        await fileShareService.createFileShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })

    it('should return error if file is not allowed to share', async () => {
      let uuid_1 = 'd20e9aa2-7e66-41d1-8521-0c7e0b3f25d5'
      let node01 = new Node(uuid_1)
      node01.type = 'public'
      node01.shareAllowed = false
      fileData.uuidMap.set(uuid_1, node01)
      let err
      let post = {writelist: [aliceUUID],
                  readlist: [bobUUID],
                  collection: [uuid_1]}
      try {
        await fileShareService.createFileShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })

    it('should return error if user not in readSet', async () => {
      let uuid_1 = 'd20e9aa2-7e66-41d1-8521-0c7e0b3f25d5'
      let node01 = new Node(uuid_1)
      node01.type = 'public'
      node01.shareAllowed = true
      node01.writelist = [aliceUUID]
      node01.readlist = [bobUUID]
      fileData.uuidMap.set(uuid_1, node01)

      let err
      let post = {writelist: [aliceUUID],
                  readlist: [bobUUID],
                  collection: [uuid_1]}
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
                 collection: [uuid2, uuid4, uuid6, uuid9]
               }
    // root node is different from general dirctory/file node
    // root is a node, but with some special properties
    n1.type = 'private'
    n1.owner = userUUID
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

    it('should return error if op.operation is not add or delete', async () => {
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

    it('should return error if user is not the owner of root node', async () => {
      let uuid_1 = 'd20e9aa2-7e66-41d1-8521-0c7e0b3f25d5'
      let uuid_2 = 'a8eec3c8-70e5-411b-90fd-ee3e181254b9'
      let node01 = new Node(uuid_1)
      node01.type = 'private'
      node01.owner = uuid_2
      fileData.uuidMap.set(uuid_1, node01)

      let err
      let patch = [{path: 'collection',
                    operation: 'add',
                    value: [uuid_1]
                  }]
      try {
        await fileShareService.updateFileShare(userUUID, shareUUID, patch)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })

    it('should return error if the node is in public drive but user not in readSet', async () => {
      let uuid_1 = 'd20e9aa2-7e66-41d1-8521-0c7e0b3f25d5'
      let node01 = new Node(uuid_1)
      node01.type = 'public'
      node01.shareAllowed = true
      node01.writelist = [aliceUUID]
      node01.readlist = [bobUUID]
      fileData.uuidMap.set(uuid_1, node01)

      let err
      let patch = [{path: 'collection',
                    operation: 'add',
                    value: [uuid_1]
                  }]
      try {
        await fileShareService.updateFileShare(userUUID, shareUUID, patch)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })
  })

  describe('deleteFileShare', function() {
    let shareUUID
    let post = { writelist: [aliceUUID],
                 readlist: [bobUUID],
                 collection: [uuid2, uuid4, uuid6, uuid9]
               }
    // root node is different from general dirctory/file node
    // root is a node, but with some special properties
    n1.type = 'private'
    n1.owner = userUUID
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
        await fileShareService.updateFileShare(charlieUUID, shareUUID)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })
  })
})





