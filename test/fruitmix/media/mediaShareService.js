import path from 'path'
import { expect } from 'chai'
import sinon from 'sinon'

import { rimrafAsync, mkdirpAsync } from '../../../src/fruitmix/util/async'
import { createDocumentStoreAsync } from '../../../src/fruitmix/lib/documentStore'
import { createMediaShareStoreAsync } from '../../../src/fruitmix/lib/shareStore'
import { createMediaShareData } from '../../../src/fruitmix/media/mediaShareData'
import { createMediaShareService } from '../../../src/fruitmix/media/mediaShareService'
import E from '../../../src/fruitmix/lib/error'

class Model {
  constructor() {
    this.users = [{uuid: '5da92303-33a1-4f79-8d8f-a7b6becde6c3'},
            {uuid: 'b9aa7c34-8b86-4306-9042-396cf8fa1a9c'},
            {uuid: 'f97f9e1f-848b-4ed4-bd47-1ddfa82b2777'},
            {uuid: 'e5f23cb9-1852-475d-937d-162d2554e22c'},
            {uuid: 'ed1d9638-8130-4077-9ed8-05be641a9ab4'},
            {uuid: 'c18aa308-ab32-4e2d-bc34-0c6385711b55'},
            {uuid: '916bcacf-e610-4f55-ad39-106e306d982e'},
            {uuid: '20e62448-7df5-4670-bf2b-9f2f97f17136'}]
  }
}

class MediaData {
  constructor() {}
  mediaShareAllowed(userUUID, digest) {
    return true
  }
}

const model = new Model()
const mediaData = new MediaData()

const userUUID = '5da92303-33a1-4f79-8d8f-a7b6becde6c3'
const aliceUUID = 'b9aa7c34-8b86-4306-9042-396cf8fa1a9c'
const bobUUID = 'f97f9e1f-848b-4ed4-bd47-1ddfa82b2777'
const charlieUUID = 'e5f23cb9-1852-475d-937d-162d2554e22c'

const img001Hash = '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be'
const img002Hash = '21cb9c64331d69f6134ed25820f46def3791f4439d2536b270b2f57f726718c7'

const cwd = process.cwd()
const froot = path.join(cwd, 'tmptest')

describe(path.basename(__filename), function() {
  let mediaShareStore, mediaShareData, mediaShareService

  beforeEach(async () => {
    await rimrafAsync('tmptest')
    await mkdirpAsync('tmptest')

    let docstore = await createDocumentStoreAsync(froot)
    mediaShareStore = await createMediaShareStoreAsync(froot, docstore)
    mediaShareData = createMediaShareData(model, mediaShareStore)
    mediaShareService = createMediaShareService(mediaData, mediaShareData)
  })

  afterEach(async () => await rimrafAsync('tmptest'))

  describe('create a mediaShareService', function() {
    it('should create a mediaShareService', done => {
      expect(mediaShareService.mediaShareData).to.deep.equal(mediaShareData)
      expect(mediaShareService.mediaData).to.deep.equal(mediaData)
      done()
    })
  })

  describe('createMediaShare',function() {
    it('should return error if user is a invalid uuid', async () => {
      let err
      let post = {maintainers: [aliceUUID],
                  viewers: [bobUUID],
                  album: {title: 'testAlbum', text: 'this is a test album'},
                  contents: [img001Hash]}
      try {
        await mediaShareService.createMediaShare('abcd', post)
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
        await mediaShareService.createMediaShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.EINVAL)
    })

    it('should return error if post not contain mandatory props', async () => {
      let err
      let post = {maintainers: [aliceUUID],
                  viewers: [bobUUID],
                  contents: [img001Hash]}
      try {
        await mediaShareService.createMediaShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an('error')
      expect(err.message).to.equal('some mandatory props not defined in object')
    })

    it('should return error if contents is not an array', async () => {
      let err
      let post = {maintainers: [aliceUUID],
                  viewers: [bobUUID],
                  album: {title: 'testAlbum', text: 'this is a test album'},
                  contents: img001Hash}
      try {
        await mediaShareService.createMediaShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.EINVAL)
    })

    it('should return error if contents is an empty array', async () => {
      let err
      let post = {maintainers: [aliceUUID],
                  viewers: [bobUUID],
                  album: {title: 'testAlbum', text: 'this is a test album'},
                  contents: []}
      try {
        await mediaShareService.createMediaShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.EINVAL)
    })

    it('should return error if contents is not allowed to be shared', async () => {
      let err
      let post = {maintainers: [aliceUUID],
                  viewers: [bobUUID],
                  album: {title: 'testAlbum', text: 'this is a test album'},
                  contents: [img001Hash]}
      let stub = sinon.stub(mediaData, 'mediaShareAllowed')
      stub.returns(false)
      try {
        await mediaShareService.createMediaShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      stub.restore()
      expect(err).to.be.an.instanceof(E.EACCESS)
    })

    it('should return error if album not contain mandatory props', async () => {
      let err
      let post = {maintainers: [aliceUUID],
                  viewers: [bobUUID],
                  album: {text: 'this is a test album'},
                  contents: [img001Hash]}
      try {
        await mediaShareService.createMediaShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an('error')
      expect(err.message).to.equal('some mandatory props not defined in object')
    })

    it('should return error if album has props that are neither mandatory nor optional', async () => {
      let err
      let post = {maintainers: [aliceUUID],
                  viewers: [bobUUID],
                  album: {title: 'testAlbum', text: 'this is a test album', name: 'alice'},
                  contents: [img001Hash]}
      try {
        await mediaShareService.createMediaShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an('error')
      expect(err.message).to.equal('object has props that are neither mandatory nor optional')
    })

    it('should return error if album has text prop and text is not a string', async () => {
      let err
      let post = {maintainers: [aliceUUID],
                  viewers: [bobUUID],
                  album: {title: 'testAlbum', text: ['this is a test album']},
                  contents: [img001Hash]}
      try {
        await mediaShareService.createMediaShare(userUUID, post)
      }
      catch(e){
        err = e
      }
      expect(err).to.be.an.instanceof(E.EINVAL)
    })
  })

  describe('updateMediaShare', function() {
    let shareUUID
    let post = {maintainers: [aliceUUID],
                  viewers: [bobUUID],
                  album: {title: 'testAlbum', text: 'this is a test album'},
                  contents: [img001Hash]}
    beforeEach(async() => {
      let share = await mediaShareService.createMediaShare(userUUID, post)
      shareUUID = share.doc.uuid
    })

    it('should return error if share is not found', async () => {
      let err
      let uuid = '6790cdcb-8bce-4c67-9768-202a90aad8bf'
      let patch = [{path: 'maintainers',
                    operation: 'add',
                    value: [charlieUUID]}]
      try {
        await mediaShareService.updateMediaShare(userUUID, uuid, patch)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.ENOENT)
    })

    it('should return error if user is neither author nor maintainers', async () => {
      let err
      let patch = [{path: 'maintainers',
                    operation: 'add',
                    value: [charlieUUID]}]
      try {
        await mediaShareService.updateMediaShare(charlieUUID, shareUUID, patch)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })

    it('should return error if mandatory props not defined in patch', async () => {
      let err
      let patch = [{path: 'maintainers',
                    value: [charlieUUID]}]
      try {
        await mediaShareService.updateMediaShare(userUUID, shareUUID, patch)
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
                    value: [charlieUUID]}]
      try {
        await mediaShareService.updateMediaShare(userUUID, shareUUID, patch)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EINVAL)
    })

    it('should return error if op.operation is not the given values', async () => {
      let err
      let patch = [{path: 'maintainers',
                    operation: 'update',
                    value: [charlieUUID]
                  }]
      try {
        await mediaShareService.updateMediaShare(userUUID, shareUUID, patch)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EINVAL)
    })

    it('should return error if contents is not allowed to be shared', async () => {
      let err
      let patch = [{path: 'contents',
                    operation: 'add',
                    value: [img002Hash]
                  }]
      let stub = sinon.stub(mediaData, 'mediaShareAllowed')
      stub.returns(false)
      try {
        await mediaShareService.updateMediaShare(userUUID, shareUUID, patch)
      }
      catch(e) {
        err = e
      }
      stub.restore()
      expect(err).to.be.an.instanceof(E.EACCESS)
    })
  })

  describe('deleteMediaShare', function() {
    let shareUUID
    let post = {maintainers: [aliceUUID],
                  viewers: [bobUUID],
                  album: {title: 'testAlbum', text: 'this is a test album'},
                  contents: [img001Hash]}
    beforeEach(async() => {
      let share = await mediaShareService.createMediaShare(userUUID, post)
      shareUUID = share.doc.uuid
    })

    it('should return error if share is not found', async () => {
      let err
      let uuid = '6790cdcb-8bce-4c67-9768-202a90aad8bf'
      try {
        await mediaShareService.deleteMediaShare(userUUID, uuid)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.ENOENT)
    })

    it('should return error if user is not author', async () => {
      let err
      try {
        await mediaShareService.updateMediaShare(charlieUUID, shareUUID)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
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
      share1 = await mediaShareService.createMediaShare(userUUID, post1)
      share2 = await mediaShareService.createMediaShare(aliceUUID, post2)
    })

    it('shoud return shares user is the author or in viewerSet', async () => {
      let shares = await mediaShareService.getUserMediaShares(aliceUUID)
      let share_1 = Object.assign({}, share1, {readable: true, writeable: true})
      let share_2 = Object.assign({}, share2, {readable: true, writeable: true})
      expect(shares[0]).to.deep.equal(share_1)
      expect(shares[1]).to.deep.equal(share_2)
    })
  })
})




