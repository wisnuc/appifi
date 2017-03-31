import path from 'path'
import { expect } from 'chai'
import EventEmitter from 'events'

import { rimrafAsync, mkdirpAsync } from '../../../src/fruitmix/util/async'
import { createDocumentStore } from '../../../src/fruitmix/lib/documentStore'
import { createFileShareStore } from '../../../src/fruitmix/lib/shareStore'
import { createFileShareDoc, updateFileShareDoc } from '../../../src/fruitmix/file/fileShareDoc'
import { createFileShareData } from '../../../src/fruitmix/file/fileShareData'
import E from '../../../src/fruitmix/lib/error'
// import DirectoryNode from '../../../src/fruitmix/file/directoryNode'
import FileData from '../../../src/fruitmix/file/fileData'


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

class Model extends EventEmitter {
  constructor() {
    super()
  }

  getUsers() {
    return [ {uuid: 'c9f1d82e-5d88-46d7-ad43-24d51b1b6628', type: 'local'},
             {uuid: 'b9aa7c34-8b86-4306-9042-396cf8fa1a9c', type: 'local'},
             {uuid: 'f97f9e1f-848b-4ed4-bd47-1ddfa82b2777', type: 'local'},
             {uuid: 'e5f23cb9-1852-475d-937d-162d2554e22c', type: 'local'},
             {uuid: 'b8ff0e08-0acb-4013-8129-a4d913e79339', type: 'remote'},
           ]
  }
}

const cwd = process.cwd()
const tmpdir = path.join(cwd, 'tmptest')
const froot = path.join(tmpdir, userUUID)

describe(path.basename(__filename), () => {

  before(async () => {
    await rimrafAsync('tmptest') 
    await mkdirpAsync('tmptest')

    const model = new Model()
    const fileData = new FileData(tmpdir, model)
  })



})



model.emit('driveCreated', [{uuid: uuid1, type: 'private',owner: userUUID}, 
                            {uuid: uuid9, type: 'private', owner: aliceUUID}
                           ])

await Promise.delay(200)
console.log(fileData.root.children[0])
// fileData.createNode()

// const xstats = [{uuid: uuid1}, {uuid: uuid2}, {uuid: uuid3},
//                 {uuid: uuid4}, {uuid: uuid5}, {uuid: uuid6},
//                 {uuid: uuid7}, {uuid: uuid8}, {uuid: uuid9}]

// const ctx = {
//       attached: [],
//       detaching: [],

//       nodeAttached(x) {
//         this.attached.push(x)
//       },

//       nodeDetaching(x) {
//         this.detaching.push(x)
//       }
//     }

// const n1 = new DriveNode(ctx, xstats[0], {type: 'private', owner: userUUID})
// const n2 = new DirectoryNode(ctx, xstats[1])
// const n3 = new DirectoryNode(ctx, xstats[2])
// const n4 = new DirectoryNode(ctx, xstats[3])
// const n5 = new DirectoryNode(ctx, xstats[4])
// const n6 = new DirectoryNode(ctx, xstats[5])
// const n7 = new DirectoryNode(ctx, xstats[6])
// const n8 = new DirectoryNode(ctx, xstats[7])
// const n9 = new DriveNode(ctx, xstats[8], {type: 'private', owner: aliceUUID})
// n2.attach(n1)
// n3.attach(n2)
// n4.attach(n3)
// n5.attach(n1)
// n6.attach(n1)
// n7.attach(n6)
// n8.attach(n7)

// console.log(n2.parent)
// class Node {
//   constructor(uuid) {
//     this.uuid = uuid
//     this.parent = null
//     this.children = []
//   }

//   upFind(func) {
//     let node = this
//     while (node !== null) {
//       if (func(node)) return node
//       node = node.parent
//     }
//   }
// }

// class FileData {
//   constructor() {
//     this.uuidMap = new Map()
//   }
// }

// const n1 = new Node(uuid1)
// const n2 = new Node(uuid2)
// n2.parent = n1
// n1.children.push(n2)
// const n3 = new Node(uuid3)
// n3.parent = n2
// n2.children.push(n3)
// const n4 = new Node(uuid4)
// n4.parent = n3
// n3.children.push(n4)
// const n5 = new Node(uuid5)
// n5.parent = n1
// n1.children.push(n5)
// const n6 = new Node(uuid6)
// n6.parent = n1
// n1.children.push(n6)
// const n7 = new Node(uuid7)
// n7.parent = n6
// n6.children.push(n7)
// const n8 = new Node(uuid8)
// n8.parent = n7
// n7.children.push(n8)
// const n9 = new Node(uuid9)

// fileData.uuidMap.set(n1.uuid, n1)
// fileData.uuidMap.set(n2.uuid, n2)
// fileData.uuidMap.set(n3.uuid, n3)
// fileData.uuidMap.set(n4.uuid, n4)
// fileData.uuidMap.set(n5.uuid, n5)
// fileData.uuidMap.set(n6.uuid, n6)
// fileData.uuidMap.set(n7.uuid, n7)
// fileData.uuidMap.set(n8.uuid, n8)
// fileData.uuidMap.set(n9.uuid, n9)



// const createDocumentStoreAsync = Promise.promisify(createDocumentStore)
// const createFileShareStoreAsync = Promise.promisify(createFileShareStore)

// describe(path.basename(__filename), function() {
//   let fileShareStore, fileShareData

//   beforeEach(async () => {
//     await rimrafAsync('tmptest')
//     await mkdirpAsync('tmptest')

//     let docstore = await createDocumentStoreAsync(froot)
//     fileShareStore = await createFileShareStoreAsync(froot, docstore)
//     fileShareData = await createFileShareData(model, fileShareStore)
//   })

//   afterEach(async () => await rimrafAsync('tmptest'))
  
//   describe('create a fileShareData', function() {

//     it('should create a fileShareData', done => {
//       expect(fileShareData.model).to.deep.equal(model)
//       expect(fileShareData.fileShareStore).to.deep.equal(fileShareStore)
//       expect(fileShareData.fileShareMap).to.deep.equal(new Map())
//       done()
//     })
//   })

//   describe('createFileShare', function() {
//     let doc
//     let post = { writelist: [aliceUUID],
//                  readlist: [bobUUID],
//                  collection: [uuid2, uuid4, uuid6, uuid9] 
//                }

//     beforeEach(() => doc = createFileShareDoc(fileData, userUUID, post))

//     it('new fileshare should be set into fileShareMap', async () => {
//       await fileShareData.createFileShare(doc)
//       expect(fileShareData.fileShareMap.get(doc.uuid).doc).to.deep.equal(doc)
//     })

//     it('new fileshare should be a frozen object', async () => {
//       await fileShareData.createFileShare(doc)
//       expect(Object.isFrozen(fileShareData.fileShareMap.get(doc.uuid))).to.be.true
//     })
//   })

//   describe('updateFileShare', function() {
//     let doc
//     let post = { writelist: [aliceUUID],
//                  readlist: [bobUUID],
//                  collection: [uuid2, uuid4, uuid6, uuid9] 
//                }
//     beforeEach(async () => {
//       doc = createFileShareDoc(fileData, userUUID, post)
//       await fileShareData.createFileShare(doc)
//     })

//     it('updated fileshare should be put into fileShareMap', async () => {
//       let patch = [{path: 'writelist',
//                     operation: 'add',
//                     value: [charlieUUID]
//                   }]
//       let newDoc = updateFileShareDoc(fileData, doc, patch)
//       await fileShareData.updateFileShare(newDoc)
//       expect(fileShareData.fileShareMap.get(doc.uuid).doc).to.deep.equal(newDoc)
//     })

//     it('updated fileshare should be a frozen object', async () => {
//       let patch = [{path: 'writelist',
//                     operation: 'add',
//                     value: [charlieUUID]
//                   }]
//       let newDoc = updateFileShareDoc(fileData, doc, patch)
//       await fileShareData.updateFileShare(newDoc)
//       expect(Object.isFrozen(fileShareData.fileShareMap.get(doc.uuid))).to.be.true
//     })

//     it('should throw error if target uuid is not found', async () => {
//       let err
//       let patch = [{path: 'writelist',
//                     operation: 'add',
//                     value: [charlieUUID]
//                   }]
//       let newDoc = updateFileShareDoc(fileData, doc, patch)
//       fileShareData.fileShareMap.delete(doc.uuid)

//       try {
//         await fileShareData.updateFileShare(newDoc)
//       }
//       catch(e){
//         err = e
//       }
//       expect(err).to.be.an.instanceof(E.ENOENT)
//     })
//   })

//   describe('deleteFileShare', function() {
//     let doc
//     let post = { writelist: [aliceUUID],
//                  readlist: [bobUUID],
//                  collection: [uuid2, uuid4, uuid6, uuid9] 
//                }
//     beforeEach(async () => {
//       doc = createFileShareDoc(fileData, userUUID, post)
//       await fileShareData.createFileShare(doc)
//     })

//     it('should throw error if uuid is not exist in fileShareMap', async () => {
//       let err
//       fileShareData.fileShareMap.delete(doc.uuid)
//       try {
//         await fileShareData.deleteFileShare(doc.uuid)
//       }
//       catch(e){
//         err = e
//       }
//       expect(err).to.be.an.instanceof(E.ENOENT)
//     })

//     it('should remove fileshare from fileShareMap successfully', async () => {
//       await fileShareData.deleteFileShare(doc.uuid)
//       expect(fileShareData.fileShareMap.get(doc.uuid)).to.be.undefined
//     })
//   })
// })