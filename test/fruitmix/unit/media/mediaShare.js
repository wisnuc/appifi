import path from 'path'
import deepFreeze from 'deep-freeze'

import { createDocumentStore } from 'src/fruitmix/lib/documentStore'
import { createMediaShareStore } from 'src/fruitmix/lib/mediaShareStore'
import MediaShareCollection from 'src/fruitmix/media/mediaShare'

const userUUID = '916bcacf-e610-4f55-ad39-106e306d982e'
const aliceUUID = '20e62448-7df5-4670-bf2b-9f2f97f17136'
const bobUUID = '8d7abab0-016a-4aaa-9a20-a43c2af80818'
const charlieUUID = '3008aeca-0970-4900-9e23-aad83d9378d6'

const sha256 = '0db2410a5511ed90a1fe0160e1a63176221e2cbd552fde3a47d6151010cef317'
const img001Hash = '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be'
const img002Hash = '21cb9c64331d69f6134ed25820f46def3791f4439d2536b270b2f57f726718c7'

const shareStore = {
  store(doc) {
    return sha256
  }

}

describe(path.basename(__filename), function(){

  describe('createMediaShare', function(){
    let post = {maintainers: [aliceUUID],
                viewers: [bobUUID],
                album: {title:'testalbum', text: 'this is a test album'},
                sticky: false,
                contents: [img001Hash]
               }
    beforeEach(() => {
      let msc = new MediaShareCollection(shareStore)
    })

    it('should return a new share with fixed property sequence', done => {
      let share = msc.createMediaShare(userUUID, post)
      const props = [ 'digest',
                      'doc',
                      'viewSet'
                    ]
      expect(Object.getOwnPropertyNames(share)).to.deep.equal(props)
      done()
    })
  })
})