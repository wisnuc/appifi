import path from 'path'
import { expect } from 'chai'

import { rimrafAsync, mkdirpAsync } from '../../../src/fruitmix/util/async'
import { createDocumentStoreAsync } from '../../../src/fruitmix/lib/documentStore'
import { createMediaShareStoreAsync } from '../../../src/fruitmix/lib/shareStore'
import { createMediaShareDoc, updateMediaShareDoc } from '../../../src/fruitmix/media/mediaShareDoc'
import { createMediaShareData } from '../../../src/fruitmix/media/mediaShareData'
import E from '../../../src/fruitmix/lib/error'

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

describe(path.basename(__filename), function() {
  let mediaShareStore, mediaShareData

  beforeEach(async () => {
    await rimrafAsync('tmptest')
    await mkdirpAsync('tmptest')

    let docstore = await createDocumentStoreAsync(froot)
    mediaShareStore = await createMediaShareStoreAsync(froot, docstore)
    mediaShareData = createMediaShareData(model, mediaShareStore)
  })

  afterEach(async () => await rimrafAsync('tmptest'))

  describe('create a mediaShareData', function() {

    it('should create a mediaShareData', done => {
      expect(mediaShareData.model).to.deep.equal(model)
      expect(mediaShareData.mediaShareStore).to.deep.equal(mediaShareStore)
      expect(mediaShareData.mediaShareMap).to.be.an.instanceof(Map)
      expect(mediaShareData.lockSet).to.be.an.instanceof(Set)
      done()
    })    
  })

  describe('createMediaShare', function() {
    it('new share should be set into mediaShareMap', async () => {
      let post = { maintainers: [aliceUUID],
                   viewers: [bobUUID],
                   album: {title: 'testAlbum', text: 'this is a test album'},
                   contents: [img001Hash]      
                 }
      let doc = createMediaShareDoc(userUUID, post)
      await mediaShareData.createMediaShare(doc)
      expect(mediaShareData.findShareByUUID(doc.uuid).doc).to.deep.equal(doc)
    })

    it('new share should be a frozen object', async () => {
      let post = { maintainers: [aliceUUID],
                   viewers: [bobUUID],
                   album: {title: 'testAlbum', text: 'this is a test album'},
                   contents: [img001Hash]      
                 }
      let doc = createMediaShareDoc(userUUID, post)
      await mediaShareData.createMediaShare(doc)
      expect(Object.isFrozen(mediaShareData.findShareByUUID(doc.uuid))).to.be.true
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
      await mediaShareData.createMediaShare(doc)
    })

    it('updated doc should be put into mediaShareMap', async () => {
      let patch = [{path: 'maintainers',
                    operation: 'add',
                    value: [charlieUUID]
                  }]
      let newDoc = updateMediaShareDoc(userUUID, doc, patch)
      await mediaShareData.updateMediaShare(newDoc)
      expect(mediaShareData.findShareByUUID(doc.uuid).doc).to.deep.equal(newDoc)
    })

    it('updated share should be a frozen object', async () => {
      let patch = [{path: 'maintainers',
                    operation: 'add',
                    value: [charlieUUID]
                  }]
      let newDoc = updateMediaShareDoc(userUUID, doc, patch)
      await mediaShareData.updateMediaShare(newDoc)
      expect(Object.isFrozen(mediaShareData.findShareByUUID(doc.uuid))).to.be.true
    })

    it('should throw error if target uuid is not found', async () => {
      let err
      let patch = [{path: 'maintainers',
                    operation: 'add',
                    value: [charlieUUID]
                  }]
      let newDoc = updateMediaShareDoc(userUUID, doc, patch)
      mediaShareData.mediaShareMap.delete(doc.uuid)

      try {
        await mediaShareData.updateMediaShare(newDoc)
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
      await mediaShareData.createMediaShare(doc)
    })

    it('should throw error if uuid is not exist in mediaShareMap', async () => {
      let err
      mediaShareData.mediaShareMap.delete(doc.uuid)
      try {
        await mediaShareData.deleteMediaShare(doc.uuid)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.ENOENT)
    })

    it('should remove share from mediaShareMap successfully', async () => {
      await mediaShareData.deleteMediaShare(doc.uuid)
      expect(mediaShareData.findShareByUUID(doc.uuid)).to.be.undefined
    })
  })

  describe('load', function() {
    let doc1, doc2
    let post1 = { maintainers: [aliceUUID],
                  viewers: [bobUUID],
                  album: {title: 'testAlbum', text: 'this is a test album'},
                  contents: [img001Hash]      
                }
    let post2 = { maintainers: [charlieUUID],
                  viewers: [bobUUID],
                  album: {title: 'test'},
                  contents: [img002Hash]      
                }
    beforeEach(async () => {
      doc1 = createMediaShareDoc(userUUID, post1)
      doc2 = createMediaShareDoc(aliceUUID, post2)
      await mediaShareStore.storeAsync(doc1)
      await mediaShareStore.storeAsync(doc2)
    })

    it('should load mediaShare that is already exist into mediaShareMap', async () => {
      await mediaShareData.load()
      expect(mediaShareData.findShareByUUID(doc1.uuid).doc).to.deep.equal(doc1)
      expect(mediaShareData.findShareByUUID(doc2.uuid).doc).to.deep.equal(doc2)
    })
  })

  describe('getUserMediaShares', function() {
    let share1, share2
    let post1 = { maintainers: [aliceUUID],
                  viewers: [bobUUID],
                  album: {title: 'testAlbum', text: 'this is a test album'},
                  contents: [img001Hash]      
                }
    let post2 = { maintainers: [charlieUUID],
                  viewers: [bobUUID],
                  album: {title: 'test'},
                  contents: [img002Hash]      
                }
    beforeEach(async () => {
      let doc1 = createMediaShareDoc(userUUID, post1)
      let doc2 = createMediaShareDoc(aliceUUID, post2)
      share1 = await mediaShareData.createMediaShare(doc1)
      share2 = await mediaShareData.createMediaShare(doc2)
    })

    it('shoud return shares user is the author or in viewerSet', async () => {
      let shares = await mediaShareData.getUserMediaShares(bobUUID)
      let share_1 = Object.assign({}, share1, {authorizedToRead: true, authorizedToWrite: false})
      let share_2 = Object.assign({}, share2, {authorizedToRead: true, authorizedToWrite: false})
      expect(shares[0]).to.deep.equal(share_1)
      expect(shares[1]).to.deep.equal(share_2)
    })
  })
})
