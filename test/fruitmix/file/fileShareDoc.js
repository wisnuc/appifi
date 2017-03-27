import path from 'path'
import { expect } from 'chai'
import validator from 'validator'

import { createFileShareDoc, updateFileShareDoc } from '../../../src/fruitmix/file/fileShareDoc'

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

let fileData = new FileData()

fileData.uuidMap.set(n1.uuid, n1)
fileData.uuidMap.set(n2.uuid, n2)
fileData.uuidMap.set(n3.uuid, n3)
fileData.uuidMap.set(n4.uuid, n4)
fileData.uuidMap.set(n5.uuid, n5)
fileData.uuidMap.set(n6.uuid, n6)
fileData.uuidMap.set(n7.uuid, n7)
fileData.uuidMap.set(n8.uuid, n8)
fileData.uuidMap.set(n9.uuid, n9)

describe(path.basename(__filename), function() {
  let doc
  let obj = { writelist: [aliceUUID],
              readlist: [bobUUID],
              collection: [uuid2, uuid4, uuid6, uuid9] 
            }

  beforeEach(() => doc = createFileShareDoc(fileData, userUUID, obj))

  describe('createFileShareDoc', function() {

    it('should return a doc with fixed property sequence', done => {
      let props = ['doctype',
                   'docversion',
                   'uuid',
                   'author',
                   'writelist',
                   'readlist',
                   'ctime',
                   'mtime',
                   'collection'
                  ]
      expect(Object.getOwnPropertyNames(doc)).to.deep.equal(props)
      done()
    })

    it('doc should set doctype to fileshare', done => {
      expect(doc.doctype).to.equal('fileshare')
      done()
    })

    it('doc should set docversion to 1.0', done => {
      expect(doc.docversion).to.equal('1.0')
      done()
    })

    it('doc should have uuid', done => {
      expect(validator.isUUID(doc.uuid)).to.be.true
      done()
    })

    it('doc should set author to given user', done => {
      expect(doc.author).to.equal(userUUID)
      done()
    })

    it('doc should set writelist to given writelist', done => {
      expect(doc.writelist).to.deep.equal(obj.writelist)
      done()
    })

    it('doc should set readlist to given readlist', done => {
      expect(doc.readlist).to.deep.equal(obj.readlist)
      done()
    })

    it('doc should have ctime and mtime', done => {
      expect(Number.isInteger(doc.ctime)).to.be.true
      expect(Number.isInteger(doc.mtime)).to.be.true
      done()
    })

    it('doc should have a collection without repeat value', done => {
      expect(doc.collection).to.deep.equal([uuid2, uuid6, uuid9])
      done()
    })
  })

  describe('updateFileShareDoc', function() {

    it('should add writer successfully', done => {
      let ops = [{path: 'writelist',
                  operation: 'add',
                  value: [charlieUUID]
                }]
      let newDoc = updateFileShareDoc(fileData, doc, ops)
      expect(newDoc.writelist).to.deep.equal([aliceUUID, charlieUUID])
      done()
    })

    it('should delete writer successfully', done => {
      let ops = [{path: 'writelist',
                  operation: 'delete',
                  value: [aliceUUID]
                }]
      let newDoc = updateFileShareDoc(fileData, doc, ops)
      expect(newDoc.writelist).to.deep.equal([])
      done()
    })

    it('should remove user from readlist if the user is move into writelist', done => {
      let ops = [{path: 'writelist',
                  operation: 'add',
                  value: [bobUUID]
                }]
      let newDoc = updateFileShareDoc(fileData, doc, ops)
      expect(newDoc.writelist).to.deep.equal([aliceUUID, bobUUID])
      expect(newDoc.readlist).to.deep.equal([])
      done()
    })

    it('should add reader successfully',done => {
      let ops = [{path: 'readlist',
                  operation: 'add',
                  value: [charlieUUID]
                }]
      let newDoc = updateFileShareDoc(fileData, doc, ops)
      expect(newDoc.readlist).to.deep.equal([bobUUID, charlieUUID])
      done()
    })

    it('should delete reader successfully',done => {
      let ops = [{path: 'readlist',
                  operation: 'delete',
                  value: [bobUUID]
                }]
      let newDoc = updateFileShareDoc(fileData, doc, ops)
      expect(newDoc.readlist).to.deep.equal([])
      done()
    })

    it('readlist should unchanged if the added reader exist in writelist', done => {
      let ops = [{path: 'readlist',
                  operation: 'add',
                  value: [aliceUUID]
                }]
      let newDoc = updateFileShareDoc(fileData, doc, ops)
      expect(newDoc.readlist).to.deep.equal([bobUUID])
      done()
    })

    it('should add node uuid to collection successfully', done => {
      let ops = [{path: 'collection',
                  operation: 'add',
                  value: [uuid5]
                }]
      let newDoc = updateFileShareDoc(fileData, doc, ops)
      expect(newDoc.collection).to.deep.equal([uuid2, uuid6, uuid9, uuid5])
      done()
    })

    it('collection should unchanged if the ancestor of the added node exist', done => {
      let ops = [{path: 'collection',
                  operation: 'add',
                  value: [uuid7]
                }]
      let newDoc = updateFileShareDoc(fileData, doc, ops)
      expect(newDoc.collection).to.deep.equal([uuid2, uuid6, uuid9])
      done()
    })

    it('should delete value of collection successfully', done => {
      let ops = [{path: 'collection',
                  operation: 'delete',
                  value: [uuid2]
                }]
      let newDoc = updateFileShareDoc(fileData, doc, ops)
      expect(newDoc.collection).to.deep.equal([uuid6, uuid9])
      done()
    })
  })



})









