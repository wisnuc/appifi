import path from 'path'
import { expect } from 'chai'

import { rimrafAsync, mkdirpAsync } from '../../../../src/fruitmix/util/async'
import { createDocumentStore } from '../../../../src/fruitmix/lib/documentStore'
import { createMediaShareStore } from '../../../../src/fruitmix/lib/mediaShareStore'
import { createMediaShareDoc, updateMediaShareDoc } from '../../../../src/fruitmix/media/mediaShareDoc'
import { createMediaShareData } from '../../../../src/fruitmix/media/mediaShareData'

import E from '../../../../src/fruitmix/lib/error'

class Model {

  constructor() {}

  getUsers() {
    return [{uuid: '5da92303-33a1-4f79-8d8f-a7b6becde6c3'},
            {uuid: 'b9aa7c34-8b86-4306-9042-396cf8fa1a9c'},
            {uuid: 'f97f9e1f-848b-4ed4-bd47-1ddfa82b2777'},
            {uuid: 'e5f23cb9-1852-475d-937d-162d2554e22c'},
            {uuid: 'ed1d9638-8130-4077-9ed8-05be641a9ab4'},
            {uuid: 'c18aa308-ab32-4e2d-bc34-0c6385711b55'},
            {uuid: '916bcacf-e610-4f55-ad39-106e306d982e'},
            {uuid: '20e62448-7df5-4670-bf2b-9f2f97f17136'}]
  }
}

const model = new Model()

const userUUID = '5da92303-33a1-4f79-8d8f-a7b6becde6c3'
const aliceUUID = 'b9aa7c34-8b86-4306-9042-396cf8fa1a9c'
const bobUUID = 'f97f9e1f-848b-4ed4-bd47-1ddfa82b2777'
const charlieUUID = 'e5f23cb9-1852-475d-937d-162d2554e22c'

const img001Hash = '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be'
const img002Hash = '21cb9c64331d69f6134ed25820f46def3791f4439d2536b270b2f57f726718c7'

const cwd = process.cwd()
const froot = path.join(cwd, 'tmptest')

const createDocumentStoreAsync = Promise.promisify(createDocumentStore)
const createMediaShareStoreAsync = Promise.promisify(createMediaShareStore)

describe(path.basename(__filename), function() {
  let mss, msd

  beforeEach(async () => {
    await rimrafAsync('tmptest')
    await mkdirpAsync('tmptest')

    let docstore = await createDocumentStoreAsync(froot)
    mss = await createMediaShareStoreAsync(froot, docstore)
    msd = createMediaShareData(model, mss)
  })

  afterEach(async () => await rimrafAsync('tmptest'))

  describe('create a mediaShareData', function() {

    it('should create a mediaShareData', done => {
      expect(msd.model).to.deep.equal(model)
      expect(msd.shareStore).to.deep.equal(mss)
      expect(msd.shareMap).to.deep.equal(new Map())
      expect(msd.lockSet).to.deep.equal(new Set())
      done()
    })    
  })

  describe('createMediaShare', function() {
    it('new share should be set into shareMap', async () => {
      let post = { maintainers: [aliceUUID],
                   viewers: [bobUUID],
                   album: {title: 'testAlbum', text: 'this is a test album'},
                   contents: [img001Hash]      
                 }
      let doc = createMediaShareDoc(userUUID, post)
      await msd.createMediaShare(doc)
      expect(msd.shareMap.get(doc.uuid).doc).to.deep.equal(doc)
    })

    it('new share should be a frozen object', async () => {
      let post = { maintainers: [aliceUUID],
                   viewers: [bobUUID],
                   album: {title: 'testAlbum', text: 'this is a test album'},
                   contents: [img001Hash]      
                 }
      let doc = createMediaShareDoc(userUUID, post)
      await msd.createMediaShare(doc)
      expect(Object.isFrozen(msd.shareMap.get(doc.uuid))).to.be.true
    })
  })

  describe('updateMediaShare', function() {
    let doc
    beforeEach(async () => {
      let post = { maintainers: [aliceUUID],
                   viewers: [bobUUID],
                   album: {title: 'testAlbum', text: 'this is a test album'},
                   contents: [img001Hash]      
                 }
      doc = createMediaShareDoc(userUUID, post)
      await msd.createMediaShare(doc)
    })

    it('updated doc should be put into shareMap', async () => {
      let patch = [{path: 'maintainers',
                    operation: 'add',
                    value: [charlieUUID]
                  }]
      let newDoc = updateMediaShareDoc(userUUID, doc, patch)
      await msd.updateMediaShare(newDoc)
      expect(msd.shareMap.get(doc.uuid).doc).to.deep.equal(newDoc)
    })

    it('updated share should be a frozen object', async () => {
      let patch = [{path: 'maintainers',
                    operation: 'add',
                    value: [charlieUUID]
                  }]
      let newDoc = updateMediaShareDoc(userUUID, doc, patch)
      await msd.updateMediaShare(newDoc)
      expect(Object.isFrozen(msd.shareMap.get(doc.uuid))).to.be.true
    })

    it('should throw error if target uuid is not found', async () => {
      let err
      let patch = [{path: 'maintainers',
                    operation: 'add',
                    value: [charlieUUID]
                  }]
      let newDoc = updateMediaShareDoc(userUUID, doc, patch)
      msd.shareMap.delete(doc.uuid)

      try {
        await msd.updateMediaShare(newDoc)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.ENOENT)
    })
  })

  describe('deleteMediaShare', function() {
    let doc
    beforeEach(async () => {
      let post = { maintainers: [aliceUUID],
                   viewers: [bobUUID],
                   album: {title: 'testAlbum', text: 'this is a test album'},
                   contents: [img001Hash]      
                 }
      doc = createMediaShareDoc(userUUID, post)
      await msd.createMediaShare(doc)
    })

    it('should throw error if uuid is not exist in shareMap', async () => {
      let err
      msd.shareMap.delete(doc.uuid)
      try {
        await msd.deleteMediaShare(doc.uuid)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.ENOENT)
    })

    it('should remove share from shareMap successfully', async () => {
      await msd.deleteMediaShare(doc.uuid)
      expect(msd.shareMap.get(doc.uuid)).to.be.undefined
    })
  })
})
