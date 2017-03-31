import path from 'path'
import { expect } from 'chai'
import EventEmitter from 'events'

import { rimrafAsync, mkdirpAsync } from '../../../src/fruitmix/util/async'
import { createDocumentStore } from '../../../src/fruitmix/lib/documentStore'
import { createFileShareStore } from '../../../src/fruitmix/lib/shareStore'
import { createFileShareDoc, updateFileShareDoc } from '../../../src/fruitmix/file/fileShareDoc'
import { createFileShareData } from '../../../src/fruitmix/file/fileShareData'
import E from '../../../src/fruitmix/lib/error'
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
const froot = path.join(tmpdir, 'tmptest')

describe(path.basename(__filename), () => {

  let model, fileData

  before(async () => {
    await rimrafAsync('tmptest') 
    await mkdirpAsync('tmptest')

    model = new Model()
    fileData = new FileData(tmpdir, model)

    model.emit('drivesCreated', [{uuid: uuid1, type: 'private',owner: userUUID}, 
                                {uuid: uuid9, type: 'private', owner: aliceUUID}
                               ])
    await Promise.delay(200)

    // two drive-roots
    let n1 = fileData.root.children[0]
    let n9 = fileData.root.children[1]

    fileData.createNode(n1, {type: 'directory', uuid: uuid2, name: 'n2'})
    await Promise.delay(100)
    let n2 = fileData.uuidMap.get(uuid2)
    // console.log(n2.parent.name)
    fileData.createNode(n2, {type: 'directory', uuid: uuid3, name: 'n3'})
    await Promise.delay(100)
    let n3 = fileData.uuidMap.get(uuid3)
    // console.log(n3.parent.name)
    fileData.createNode(n3, {type: 'directory', uuid: uuid4, name: 'n4'})
    await Promise.delay(100)
    let n4 = fileData.uuidMap.get(uuid4)
    // console.log(n4.parent.name)
    fileData.createNode(n1, {type: 'directory', uuid: uuid5, name: 'n5'})
    await Promise.delay(100)
    let n5 = fileData.uuidMap.get(uuid5)
    // console.log(n5.parent.name)
    fileData.createNode(n1, {type: 'directory', uuid: uuid6, name: 'n6'})
    await Promise.delay(100)
    let n6 = fileData.uuidMap.get(uuid6)
    // console.log(n6.parent.name)
    fileData.createNode(n6, {type: 'directory', uuid: uuid7, name: 'n7'})
    await Promise.delay(100)
    let n7 = fileData.uuidMap.get(uuid7)
    // console.log(n7.parent.name)
    fileData.createNode(n7, {type: 'directory', uuid: uuid8, name: 'n8'})
    await Promise.delay(100)
    let n8 = fileData.uuidMap.get(uuid8)
    // console.log(n8.parent.name)
  })

  const createDocumentStoreAsync = Promise.promisify(createDocumentStore)
  const createFileShareStoreAsync = Promise.promisify(createFileShareStore)

  let fileShareStore, fileShareData

  beforeEach(async () => {
    await rimrafAsync(froot)
    await mkdirpAsync(froot)

    let docstore = await createDocumentStoreAsync(froot)
    fileShareStore = await createFileShareStoreAsync(froot, docstore)
    fileShareData = await createFileShareData(model, fileShareStore)
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
                 collection: [uuid2, uuid4, uuid6, uuid9] 
               }

    beforeEach(() => doc = createFileShareDoc(fileData, userUUID, post))

    it('new fileshare should be set into fileShareMap', async () => {
      await fileShareData.createFileShare(doc)
      expect(fileShareData.fileShareMap.get(doc.uuid).doc).to.deep.equal(doc)
    })

    it('new fileshare should be a frozen object', async () => {
      await fileShareData.createFileShare(doc)
      expect(Object.isFrozen(fileShareData.fileShareMap.get(doc.uuid))).to.be.true
    })
  })
})



// describe(path.basename(__filename), function() {
//   let fileShareStore, fileShareData

//   beforeEach(async () => {
    // await rimrafAsync('tmptest')
  //   await mkdirpAsync('tmptest')

  //   let docstore = await createDocumentStoreAsync(froot)
  //   fileShareStore = await createFileShareStoreAsync(froot, docstore)
  //   fileShareData = await createFileShareData(model, fileShareStore)
  // })

  // afterEach(async () => await rimrafAsync('tmptest'))
  
  // describe('create a fileShareData', function() {

  //   it('should create a fileShareData', done => {
  //     expect(fileShareData.model).to.deep.equal(model)
  //     expect(fileShareData.fileShareStore).to.deep.equal(fileShareStore)
  //     expect(fileShareData.fileShareMap).to.deep.equal(new Map())
  //     done()
  //   })
  // })

  // describe('createFileShare', function() {
  //   let doc
  //   let post = { writelist: [aliceUUID],
  //                readlist: [bobUUID],
  //                collection: [uuid2, uuid4, uuid6, uuid9] 
  //              }

  //   beforeEach(() => doc = createFileShareDoc(fileData, userUUID, post))

  //   it('new fileshare should be set into fileShareMap', async () => {
  //     await fileShareData.createFileShare(doc)
  //     expect(fileShareData.fileShareMap.get(doc.uuid).doc).to.deep.equal(doc)
  //   })

  //   it('new fileshare should be a frozen object', async () => {
  //     await fileShareData.createFileShare(doc)
  //     expect(Object.isFrozen(fileShareData.fileShareMap.get(doc.uuid))).to.be.true
  //   })
  // })

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