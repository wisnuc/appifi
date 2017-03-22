import path from 'path'
import { expect } from 'chai'

import { rimrafAsync, mkdirpAsync } from '../../../src/fruitmix/util/async'
import { createDocumentStore } from '../../../src/fruitmix/lib/documentStore'
import { createFileShareStore } from '../../../src/fruitmix/lib/shareStore'
import { createFileShareDoc, updateFileShareDoc } from '../../../src/fruitmix/file/fileShareDoc'
import { createFileShareData } from '../../../src/fruitmix/file/fileShareData'
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
  let fss, fsd

  beforeEach(async () => {
    await rimrafAsync('tmptest')
    await mkdirpAsync('tmptest')

    let docstore = await createDocumentStoreAsync(froot)
    fss = await createFileShareStoreAsync(froot, docstore)
    fsd = createFileShareData(model, fss)
  })

  afterEach(async () => await rimrafAsync('tmptest'))
  
  describe('create a fileShareData', function() {

    it('should create a fileShareData', done => {
      expect(fsd.model).to.deep.equal(model)
      expect(fsd.fss).to.deep.equal(fss)
      expect(fsd.fsMap).to.deep.equal(new Map())
      done()
    })
  })

  describe('createFileShare', function() {
    let doc
    let post = { writelist: [aliceUUID],
                 readlist: [bobUUID],
                 collection: [uuid2, uuid4, uuid6, uuid9] 
               }

    beforeEach(() => doc = createFileShareDoc(fileData, userUUID, post))

    it('new fileshare should be set into fsMap', async () => {
      await fsd.createFileShare(doc)
      expect(fsd.fsMap.get(doc.uuid).doc).to.deep.equal(doc)
    })

    it('new fileshare should be a frozen object', async () => {
      await fsd.createFileShare(doc)
      expect(Object.isFrozen(fsd.fsMap.get(doc.uuid))).to.be.true
    })
  })

  describe('updateFileShare', function() {
    let doc
    let post = { writelist: [aliceUUID],
                 readlist: [bobUUID],
                 collection: [uuid2, uuid4, uuid6, uuid9] 
               }
    beforeEach(async () => {
      doc = createFileShareDoc(fileData, userUUID, post)
      await fsd.createFileShare(doc)
    })

    it('updated fileshare should be put into fsMap', async () => {
      let patch = [{path: 'writelist',
                    operation: 'add',
                    value: [charlieUUID]
                  }]
      let newDoc = updateFileShareDoc(fileData, doc, patch)
      await fsd.updateFileShare(newDoc)
      expect(fsd.fsMap.get(doc.uuid).doc).to.deep.equal(newDoc)
    })

    it('updated fileshare should be a frozen object', async () => {
      let patch = [{path: 'writelist',
                    operation: 'add',
                    value: [charlieUUID]
                  }]
      let newDoc = updateFileShareDoc(fileData, doc, patch)
      await fsd.updateFileShare(newDoc)
      expect(Object.isFrozen(fsd.fsMap.get(doc.uuid))).to.be.true
    })

    it('should throw error if target uuid is not found', async () => {
      let err
      let patch = [{path: 'writelist',
                    operation: 'add',
                    value: [charlieUUID]
                  }]
      let newDoc = updateFileShareDoc(fileData, doc, patch)
      fsd.fsMap.delete(doc.uuid)

      try {
        await fsd.updateFileShare(newDoc)
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
                 collection: [uuid2, uuid4, uuid6, uuid9] 
               }
    beforeEach(async () => {
      doc = createFileShareDoc(fileData, userUUID, post)
      await fsd.createFileShare(doc)
    })

    it('should throw error if uuid is not exist in fsMap', async () => {
      let err
      fsd.fsMap.delete(doc.uuid)
      try {
        await fsd.deleteFileShare(doc.uuid)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.ENOENT)
    })

    it('should remove fileshare from fsMap successfully', async () => {
      await fsd.deleteFileShare(doc.uuid)
      expect(fsd.fsMap.get(doc.uuid)).to.be.undefined
    })
  })
})