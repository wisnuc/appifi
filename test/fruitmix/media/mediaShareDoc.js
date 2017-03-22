import path from 'path'
import { expect } from 'chai'
import validator from 'validator'

import { createMediaShareDoc, updateMediaShareDoc } from '../../../src/fruitmix/media/mediaShareDoc'

const userUUID = '5da92303-33a1-4f79-8d8f-a7b6becde6c3'
const aliceUUID = 'b9aa7c34-8b86-4306-9042-396cf8fa1a9c'
const bobUUID = 'f97f9e1f-848b-4ed4-bd47-1ddfa82b2777'
const charlieUUID = 'e5f23cb9-1852-475d-937d-162d2554e22c'

const img001Hash = '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be'
const img002Hash = '21cb9c64331d69f6134ed25820f46def3791f4439d2536b270b2f57f726718c7'

describe(path.basename(__filename), function() {

  let doc
  let obj = {maintainers: [aliceUUID],
             viewers: [bobUUID],
             album: {title: 'testAlbum', text: 'this is a test album'},
             contents: [img001Hash]
            }

  beforeEach(() => {
    doc = createMediaShareDoc(userUUID, obj)
  })

  describe('createMediaShareDoc', function() {

    it('should return a doc with fixed property sequence', done => {
      const props = [ 'doctype',
                        'docversion',
                        'uuid',
                        'author',
                        'maintainers',
                        'viewers',
                        'album',
                        'sticky',
                        'ctime',
                        'mtime',
                        'contents' ]
      expect(Object.getOwnPropertyNames(doc)).to.deep.equal(props)
      done()
    })

    it('doc should set doctype to mediashare', done => {
      expect(doc.doctype).to.equal('mediashare')
      done()
    })

    it('doc should set docversion to 1.0', done => {
      expect(doc.docversion).to.equal('1.0')
      done()
    })

    it('doc share should have uuid', done => {
      expect(validator.isUUID(doc.uuid)).to.be.true
      done()
    })

    it('doc should set author to given user', done => {
      expect(doc.author).to.equal(userUUID)
      done()
    })

    it('doc should set maintainers to given maintainers', done => {
      expect(doc.maintainers).to.deep.equal(obj.maintainers)
      done()
    })

    it('doc should set viewers to given viewers', done => {
      expect(doc.viewers).to.deep.equal(obj.viewers)
      done()
    })

    it('doc should set album to given album', done => {
      expect(doc.album).to.deep.equal(obj.album)
      done()
    })

    it('doc should set sticky to false', done => {
      expect(doc.sticky).to.equal(false)
      done()
    })

    it('doc should have ctime and mtime', done => {
      expect(Number.isInteger(doc.ctime)).to.be.true
      expect(Number.isInteger(doc.mtime)).to.be.true
      done()
    })

    it('doc should have given contents', done => {
      expect(doc.contents.length).to.equal(obj.contents.length)
      expect(doc.contents[0].digest).to.equal(obj.contents[0])
      done()
    })
  })

  describe('updateMediaShareDoc', function() {

    it('should add maintainers successfully', done => {
      let ops = [{path: 'maintainers',
                  operation: 'add',
                  value: [charlieUUID]
                }]
      let newDoc = updateMediaShareDoc(userUUID, doc, ops)
      expect(newDoc.maintainers).to.deep.equal([aliceUUID, charlieUUID])
      done()
    })

    it('should remove viewer who is added into maintainers', done => {
      let ops = [{path: 'maintainers',
                  operation: 'add',
                  value: [bobUUID]
                }]
      let newDoc = updateMediaShareDoc(userUUID, doc, ops)
      expect(newDoc.maintainers).to.deep.equal([aliceUUID, bobUUID])
      expect(newDoc.viewers).to.deep.equal([])
      done()
    })

    it('should delete maintainers successfully', done => {
      let ops = [{path: 'maintainers',
                  operation: 'delete',
                  value: [aliceUUID]
                }]
      let newDoc = updateMediaShareDoc(userUUID, doc, ops)
      expect(newDoc.maintainers).to.deep.equal([])   
      done()
    })

    it('delete a maintainer and delete the contents he created meanwhile', done => {
      let ops = [{path: 'contents',
                operation: 'add',
                value: [img002Hash]
              }]
      let newDoc = updateMediaShareDoc(aliceUUID, doc, ops)
      expect(newDoc.contents[1].digest).to.equal(img002Hash)
      expect(newDoc.contents[1].creator).to.equal(aliceUUID)

      ops = [{path: 'maintainers',
              operation: 'delete',
              value: [aliceUUID]
            }]
      newDoc = updateMediaShareDoc(userUUID, newDoc, ops)
      expect(newDoc.maintainers).to.deep.equal([])
      expect(newDoc.contents.length).to.equal(1)
      expect(newDoc.contents[0].digest).to.equal(img001Hash)
      expect(newDoc.contents[0].creator).to.equal(userUUID)
      done()
    })

    it('should add viewers successfully', done => {
      let ops = [{path: 'viewers',
                  operation: 'add',
                  value: [charlieUUID]
                }]
      let newDoc = updateMediaShareDoc(userUUID, doc, ops)
      expect(newDoc.viewers).to.deep.equal([bobUUID, charlieUUID])
      done()
    })

    it('viewers should unchanged if the added viewers exist in maintainers', done => {
      let ops = [{path: 'viewers',
                  operation: 'add',
                  value: [aliceUUID]
                }]
      let newDoc = updateMediaShareDoc(userUUID, doc, ops)
      expect(newDoc.viewers).to.deep.equal([bobUUID])
      done()
    })

    it('shoule delete viewers successfully', done => {
      let ops = [{path: 'viewers',
                  operation: 'delete',
                  value: [bobUUID]
                }]
      let newDoc = updateMediaShareDoc(userUUID, doc, ops)
      expect(newDoc.viewers).to.deep.equal([])
      done()
    })

    it('should update album', done => {
      let ops = [{path: 'album',
                  operation: 'update',
                  value: {title: 'updated album'}
                }]
      let newDoc = updateMediaShareDoc(userUUID, doc, ops)
      expect(newDoc.album.title).to.equal('updated album')
      expect(newDoc.album.text).to.be.undefined
      done()
    })

    it('should add contents successfully', done => {
      let ops = [{path: 'contents',
                  operation: 'add',
                  value: [img002Hash]
                }]
      let newDoc = updateMediaShareDoc(userUUID, doc, ops)
      expect(newDoc.contents.length).to.equal(2)
      expect(newDoc.contents[1].digest).to.equal(img002Hash)
      expect(newDoc.contents[1].creator).to.equal(userUUID)
      done()
    })
  })
})


