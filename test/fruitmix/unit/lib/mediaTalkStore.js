import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

import chai from 'chai'
const expect = chai.expect

import { rimrafAsync } from 'src/fruitmix/util/async'
import Stringify from 'canonical-json'

import paths from 'src/fruitmix/lib/paths'

import { createDocumentStore } from 'src/fruitmix/lib/documentStore'
import { createMediaTalkStore } from 'src/fruitmix/lib/mediaTalkStore'

const tmptest = path.join(process.cwd(), 'tmptest')

const user001 = '07a64a9f-369f-45ff-b3c7-38d863cd542d'
const user002 = 'e20de3cd-c8ec-4da4-92d5-56a96d9e4a29'

const digest001 = '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be'
const digest002 = '21cb9c64331d69f6134ed25820f46def3791f4439d2536b270b2f57f726718c7'

const talkdoc001 = {
  owner: user001,  
  digest: digest001,
  comments: [
    {
      author: user002,
      time: 1476281895596, 
      text: 'wow! fantastic!'
    }
  ]
}

const talkdoc002 = {
  owner: user002,
  digest: digest002,
  comments: [
    {
      author: user001,
      time: 1476281895596,
      text: 'what the heck is this?'
    }
  ]
}

const canonHash = (object) => {
  let text = Stringify(object)
  let hash = crypto.createHash('sha256')
  hash.update(text)
  return hash.digest('hex')
}

const talkdoc001Hash = canonHash(talkdoc001)
const talkdoc002Hash = canonHash(talkdoc002)

describe(path.basename(__filename), function() {

  let docstore

  beforeEach(() => (async () => {

    await rimrafAsync(tmptest) 
    await paths.setRootAsync(tmptest)
    docstore = await Promise.promisify(createDocumentStore)()
    
  })())

  it('created mediatalk store should have rootdir, tmpdir, and docstore', function(done) {

    let tstore = createMediaTalkStore(docstore)
    expect(tstore.rootdir).to.equal(paths.get('mediatalk'))
    expect(tstore.tmpdir).to.equal(paths.get('tmp'))
    expect(tstore.docstore).to.equal(docstore)
    done()
  })

  it('should store talkdoc001 with correct ref file', function(done) {
  
    let tstore = createMediaTalkStore(docstore)
    tstore.store(talkdoc001, err => {
      if (err) return done(err)
      let tsroot = paths.get('mediatalk')
      let refpath = path.join(tsroot, user001 + '.' + digest001)

      fs.readFile(refpath, (err, data) => {
        if (err) return done(err) 
        expect(data.toString()).to.equal(talkdoc001Hash)
        done()
      })
    })
  })

  it('should store talkdoc001 in docstore', function(done) {

    let tstore = createMediaTalkStore(docstore) 
    tstore.store(talkdoc001, err => {
      if (err) return done(err)
      docstore.retrieve(talkdoc001Hash, (err, object) => {
        if (err) return done(err)
        expect(object).to.deep.equal(talkdoc001)
        done()
      })
    })
  })

  it('should store talkdoc001 and return { digest, doc }', function(done) {
  
    let tstore = createMediaTalkStore(docstore)
    tstore.store(talkdoc001, (err, talk) => {
      if (err) return done(err)
      expect(talk.digest).to.equal(talkdoc001Hash)
      expect(talk.doc).to.equal(talkdoc001)
      done()
    })
  }) 

  it('should retrieve talkdoc001 back', function(done) {

    let tstore = createMediaTalkStore(docstore)
    tstore.store(talkdoc001, (err, talk) => {
      if (err) return done(err)
      tstore.retrieve(user001, digest001, (err, talk) => {
        if (err) return done(err)
        expect(talk).to.deep.equal({
          digest: talkdoc001Hash,
          doc: talkdoc001,
        })
        done()
      })
    })
  })

  it('should retrieve talkdoc001 and talkdoc002 by retrieve all', function(done) {
    let tstore = createMediaTalkStore(docstore)
    tstore.store(talkdoc001, err => {
      if (err) return done(err)
      tstore.store(talkdoc002, err => {
        if (err) return done(err)
        tstore.retrieveAll((err, array) => {
          if (err) return done(err)
          let x = [
            { digest: talkdoc001Hash, doc: talkdoc001 },
            { digest: talkdoc002Hash, doc: talkdoc002 },
          ]

          expect(array.sort((a, b) => a.digest.localeCompare(b.digest))).to.deep
            .equal(x.sort((a, b) => a.digest.localeCompare(b.digest))) 
          done()
        })
      })
    }) 
  })
})

