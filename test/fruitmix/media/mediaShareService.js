import path from 'path'
import { expect } from 'chai'
import sinon from 'sinon'

import { rimrafAsync, mkdirpAsync } from '../../../src/fruitmix/util/async'
import { createDocumentStore } from '../../../src/fruitmix/lib/documentStore'
import { createMediaShareStore } from '../../../src/fruitmix/lib/shareStore'
import { createMediaShareData } from '../../../src/fruitmix/media/mediaShareData'
import { createMediaShareService } from '../../../src/fruitmix/media/mediaShareService'
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

const createDocumentStoreAsync = Promise.promisify(createDocumentStore)
const createMediaShareStoreAsync = Promise.promisify(createMediaShareStore)


describe(path.basename(__filename), function() {
  let mss, msd, msSer

  beforeEach(async () => {
    await rimrafAsync('tmptest')
    await mkdirpAsync('tmptest')

    let docstore = await createDocumentStoreAsync(froot)
    mss = await createMediaShareStoreAsync(froot, docstore)
    msd = createMediaShareData(model, mss)
    msSer = createMediaShareService(mediaData, msd)
  })

  afterEach(async () => await rimrafAsync('tmptest'))

  describe('create a mediaShareService', function() {
    it('should create a mediaShareService', done => {
      expect(msSer.msd).to.deep.equal(msd)
      expect(msSer.md).to.deep.equal(mediaData)
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
        await msSer.createMediaShare('abcd', post)
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
        await msSer.createMediaShare(userUUID, post)
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
        await msSer.createMediaShare(userUUID, post)
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
        await msSer.createMediaShare(userUUID, post)
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
        await msSer.createMediaShare(userUUID, post)
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
        await msSer.createMediaShare(userUUID, post)
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
        await msSer.createMediaShare(userUUID, post)
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
        await msSer.createMediaShare(userUUID, post)
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
        await msSer.createMediaShare(userUUID, post)
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
      let share = await msSer.createMediaShare(userUUID, post)
      shareUUID = share.doc.uuid
    })

    it('should return error if share is not found', async () => {
      let err
      let uuid = '6790cdcb-8bce-4c67-9768-202a90aad8bf'
      let patch = [{path: 'maintainers',
                    operation: 'add',
                    value: [charlieUUID]}]
      try {
        await msSer.updateMediaShare(userUUID, uuid, patch)
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
        await msSer.updateMediaShare(charlieUUID, shareUUID, patch)
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
        await msSer.updateMediaShare(userUUID, shareUUID, patch)
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
        await msSer.updateMediaShare(userUUID, shareUUID, patch)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EINVAL)
    })
  })

  describe('deleteMediaShare', function() {
    let shareUUID
    let post = {maintainers: [aliceUUID],
                  viewers: [bobUUID],
                  album: {title: 'testAlbum', text: 'this is a test album'},
                  contents: [img001Hash]}
    beforeEach(async() => {
      let share = await msSer.createMediaShare(userUUID, post)
      shareUUID = share.doc.uuid
    })

    it('should return error if share is not found', async () => {
      let err
      let uuid = '6790cdcb-8bce-4c67-9768-202a90aad8bf'
      try {
        await msSer.deleteMediaShare(userUUID, uuid)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.ENOENT)
    })

    it('should return error if user is not author', async () => {
      let err
      try {
        await msSer.updateMediaShare(charlieUUID, shareUUID)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })
  })
})




