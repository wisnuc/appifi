import path from 'path'
import { expect } from 'chai'

import { rimrafAsync, mkdirpAsync } from 'src/fruitmix/util/async'
import { createDocumentStore } from 'src/fruitmix/lib/documentStore'
import { createMediaShareStore } from 'src/fruitmix/lib/mediaShareStore'
import MediaShareCollection from 'src/fruitmix/media/mediaShare'

describe(path.basename(__filename), function(){

  const userUUID = '916bcacf-e610-4f55-ad39-106e306d982e'
  const aliceUUID = '20e62448-7df5-4670-bf2b-9f2f97f17136'
  const bobUUID = '8d7abab0-016a-4aaa-9a20-a43c2af80818'
  const charlieUUID = '3008aeca-0970-4900-9e23-aad83d9378d6'

  const sha256 = '0db2410a5511ed90a1fe0160e1a63176221e2cbd552fde3a47d6151010cef317'
  const img001Hash = '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be'
  const img002Hash = '21cb9c64331d69f6134ed25820f46def3791f4439d2536b270b2f57f726718c7'

  const cwd = process.cwd()

  const createDocumentStoreAsync = Promise.promisify(createDocumentStore)
  const createMediaShareStoreAsync = Promise.promisify(createMediaShareStore)


  describe('create a mediaShare collection', function(){
    let msc, msstore

    beforeEach(() => (async() => {
      await rimrafAsync('tmptest')
      let froot = path.join(cwd, 'tmptest')
      await mkdirpAsync(froot)

      let docstore = await createDocumentStoreAsync(froot)
      msstore = await createMediaShareStoreAsync(froot, docstore)
      msc = new MediaShareCollection(msstore)
    })())

    afterEach(() => (async () => {
      await rimrafAsync('tmptest')
    })())

    it('should create a mediashare collection', done => {
      expect(msc.shareStore).to.equal(msstore)
      expect(msc.shareMap).to.deep.equal(new Map())
      done()
    })
  })

  describe('createMediaShare', function() {
    let msc
    let post = {maintainers: [aliceUUID],
                viewers: [bobUUID],
                album: {title:'testalbum', text: 'this is a test album'},
                sticky: false,
                contents: [img001Hash]
               }

    beforeEach(() => (async() => {
      await rimrafAsync('tmptest')
      let froot = path.join(cwd, 'tmptest')
      await mkdirpAsync(froot)

      let docstore = await createDocumentStoreAsync(froot)
      let msstore = await createMediaShareStoreAsync(froot, docstore)
      msc = new MediaShareCollection(msstore) 
    })())

    afterEach(() => (async () => {
      await rimrafAsync('tmptest')
    })())

    it('should return a new share with fixed property sequence', async done => {
      let share = await msc.createMediaShare(userUUID, post)
      const props = [ 'digest',
                      'doc'
                    ]
      expect(Object.getOwnPropertyNames(share)).to.deep.equal(props)
      done()
    })

    it('new share should have a frozen doc object', async done => {
      let share = await msc.createMediaShare(userUUID, post)
      expect(Object.isFrozen(share.doc)).to.be.true
      done()
    })

    it('new share has a valid digest', async done => {
      let share = await msc.createMediaShare(userUUID, post)
      expect(/[0-9a-f]{64}/.test(share.digest)).to.be.true
      done()
    })

    it('new share should be set into shareMap', async done => {
      let share = await msc.createMediaShare(userUUID, post)
      expect(msc.shareMap.get(share.doc.uuid)).to.deep.equal(share)
      done()
    })
  })

  describe('updateMediaShare', function() {
    let msc, shareUUID
    let post = {maintainers: [aliceUUID],
                viewers: [bobUUID],
                album: {title:'testalbum', text: 'this is a test album'},
                sticky: false,
                contents: [img001Hash]
               }
    let patch = [{path: 'maintainers',
                    operation: 'add',
                    value: [charlieUUID]
                  }]

    beforeEach(() => (async() => {
      await rimrafAsync('tmptest')
      let froot = path.join(cwd, 'tmptest')
      await mkdirpAsync(froot)

      let docstore = await createDocumentStoreAsync(froot)
      let msstore = await createMediaShareStoreAsync(froot, docstore)
      msc = new MediaShareCollection(msstore)
      let share = await msc.createMediaShare(userUUID, post)
      shareUUID = share.doc.uuid
    })())

    afterEach(() => (async () => {
      await rimrafAsync('tmptest')
    })())

    it('should throw err if share is locked', async done => {
      let err
      let share = msc.shareMap.get(shareUUID)
      share.lock = true

      try {
        await msc.updateMediaShare(userUUID, shareUUID, patch)
      }
      catch(e) {
        err = e
      }
      expect(err).to.be.an('error')
      expect(err.code).to.equal('ELOCK')
      expect(err.message).to.equal('be busy')
      done()     
    })

    it('updated share should has a frozen doc', async done => {
      let err, updatedShare

      try{
        updatedShare = await msc.updateMediaShare(userUUID, shareUUID, patch)
      }
      catch(e) {
        err = e
      }
      expect(Object.isFrozen(updatedShare.doc)).to.be.true
      done()
    })

    it('updated share should be set into shareMap', async done => {
      let err, updatedShare

      try{
        updatedShare = await msc.updateMediaShare(userUUID, shareUUID, patch)
      }
      catch(e) {
        err = e
      }

      expect(msc.shareMap.get(shareUUID)).to.deep.equal(updatedShare)
      done()
    })

    it('should return old digest and doc if nothing changed', async done => {
      let err, updatedShare
      let share = msc.shareMap.get(shareUUID)
      let patch01 = []
      try{
        updatedShare = await msc.updateMediaShare(userUUID, shareUUID, patch01)
      }
      catch(e) {
        err = e
      }

      expect(updatedShare.digest).to.deep.equal(share.digest)
      expect(updatedShare.doc).to.deep.equal(share.doc)
      done()
    })

    it('lock should be set to false if nothing changed', async done => {
      let err, updatedShare
      let patch01 = []
      try{
        updatedShare = await msc.updateMediaShare(userUUID, shareUUID, patch01)
      }
      catch(e) {
        err = e
      }

      let share = msc.shareMap.get(shareUUID)
      expect(share.lock).to.be.false
      done()
    })
  })

  describe('deleteMediaShare', function() {
    let msc, shareUUID
    let post = {maintainers: [aliceUUID],
                viewers: [bobUUID],
                album: {title:'testalbum', text: 'this is a test album'},
                sticky: false,
                contents: [img001Hash]
               }

    beforeEach(() => (async() => {
      await rimrafAsync('tmptest')
      let froot = path.join(cwd, 'tmptest')
      await mkdirpAsync(froot)

      let docstore = await createDocumentStoreAsync(froot)
      let msstore = await createMediaShareStoreAsync(froot, docstore)
      msc = new MediaShareCollection(msstore) 
      let share = await msc.createMediaShare(userUUID, post)
      shareUUID = share.doc.uuid
    })())

    afterEach(() => (async () => {
      await rimrafAsync('tmptest')
    })())

    it('should return error if the share is locked', async done => {
      let err
      let share = msc.shareMap.get(shareUUID)
      share.lock = true

      try {
        await msc.deleteMediaShare(shareUUID)
      }
      catch(e) {
        err = e
      }

      expect(err).to.be.an('error')
      expect(err.code).to.equal('ELOCK')
      expect(err.message).to.equal('be busy')
      done()     
    })

    it('deleted share should be removed from shareMap', async done => {
      let err

      try {
        await msc.deleteMediaShare(shareUUID)
      }
      catch(e) {
        err = e
      }

      expect(msc.shareMap.get(shareUUID)).to.be.undefined
      done()  

    })
  })

})