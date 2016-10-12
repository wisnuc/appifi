import path from 'path'
import { rimrafAsync, mkdirpAsync, fs } from 'src/fruitmix/util/async'
import { expect } from 'chai'
import validator from 'validator'

import paths from 'src/fruitmix/lib/paths'
import { createDocumentStore } from 'src/fruitmix/lib/documentStore'
import { createMediaShareStore } from 'src/fruitmix/lib/mediaShareStore'
import createMedia from 'src/fruitmix/lib/media' 

/**
20e62448-7df5-4670-bf2b-9f2f97f17136
8d7abab0-016a-4aaa-9a20-a43c2af80818
3008aeca-0970-4900-9e23-aad83d9378d6
027453eb-b9a7-4fea-b29c-4662fb7e0bec
e1bb25aa-6887-48d1-a231-f5400085d0be
d386c34b-36f2-4bd1-be6e-c1d0e0926710
8f4a5ba5-8064-4de9-95b2-b87fa318e14b
7dc77c69-67fe-444e-80a9-9fbfdd8a6232
92652032-a357-4bd3-9484-7f2a79246b55
d0df6ecc-7447-4d57-ae58-90bb72beace6
24ee85f8-a6c2-46d7-858b-42f660cb4d57
281a1a0e-e1da-49de-b88f-cdfec0af7d51
3ccf940c-208e-4bdb-93a0-9d098b8abd71
0ba820d9-483a-4fc6-ae38-84d8ba83200d
1fb9c2e4-af2f-42bf-b1f1-09619a9e56b3
a25b1d2d-c726-4dae-a71c-b37d95bc6ad6
88f0c490-4027-4918-9dfa-d40d80b9b4a5
4635920e-4966-4572-9f6a-14915b51a804
abd8e304-4683-46cb-965d-4fcf82b28a5b
8d827cdd-f0e6-4027-b5f9-a354c6cc801e
51f1339a-6f47-411e-9b23-020386a46ae2
b3234348-1901-43f7-a344-fce4a1ceb241
f9fa94bb-44d2-4b58-a232-7d9c6be16a4c
443d58bb-8b4b-4b1a-9eeb-32280102e3d5
f2ef1d8a-6d78-4a07-89fd-3eba398e1cc1
eb85a915-d759-49c5-a3d1-5639557b8f38
17d7b3ae-1297-46fa-95b4-ef9f8dc2d10d
19760878-9931-4d47-9f4d-5f563f50f0f3
bbdf6e48-ecfb-43c7-9c23-963fc20b5dec
c20c9de8-0b5f-48f4-88cb-6aeec86a947d
2fe874d6-2a8d-425a-96f2-23c63762289f
8cfb569d-2e51-4d02-a893-ada2676870b0
f2b62bd9-f2b8-4e91-8b68-b5c4f7c17d2b
6feef71c-a43b-40f3-966e-67b3a731889c
afd2f964-afa0-4f42-b193-079aa08c7dd9
5abffd47-5409-4aaa-9d62-64921636ed58
4f46fb48-706d-48a4-a8b2-5ce0d2ad9f41
16ac9d81-42af-407e-84a8-bae675fb11eb
cf272ffc-f9db-40f3-a4ab-cc69f2f3569f
251fe80e-83c7-4895-8d67-066bed5f716d
a9e1ab4b-01fb-4fe6-bee2-6447c20ebcbb
add7dd30-9cb7-46c3-ad18-de379e2f4a18
6b4ed45e-0897-4909-b438-c1b7f238e645
3c33a8ca-9a7e-4ef1-84b5-2dd47c737ab6
dae88d78-33b1-493e-996e-2b87b469eaf4
482658d6-0822-4b0a-b774-0d08dd93f383
f3b5bf3f-e8cb-4031-b4ce-b9ecd4f92fa5
3c242eef-7f34-4d19-9401-dd9f627ef763
fbffac4c-efe0-42e6-9a82-aaa17fcc2f9a
59670ef5-a2a8-4c92-8aea-1019612a05db
68596a28-ed2a-4f5e-9017-41ddc001948f
f2950b59-e61d-490b-8b43-a22d991e3d4a
254160d3-bef0-49ff-b470-331389e50c11
42ba806b-b932-4116-8c34-c5e854fdfe9d
e8c3aaaa-6e87-4507-9977-0674776adedc
8183faf0-1a51-432d-8a42-726cb9b7318c
59ddefb8-b055-4be9-a706-113707963811
e5c7225e-93fd-4eac-a480-f7bc1f7722a1
c89815b4-1860-4bee-96d3-fd3accb98d7e
3730a228-f082-4060-a47f-8998fd823bfa
058746c9-caf2-4833-9c0e-59605e7f6e49
374e5f0a-977c-4050-ad48-c0d39cc7e422
**/

describe(path.basename(__filename), function() {

  describe('create media', function() {

    it('media should have an empty sharedMap (obsolete, need update)', function() {
      let x = createMedia()
      expect(x.shareMap instanceof Map).to.be.true
      expect(x.shareMap.size).to.equal(0)
    })
  })

  describe('create share', function() {

    let share
    let media
    
    const cwd = process.cwd()

    let userUUID = '916bcacf-e610-4f55-ad39-106e306d982e'

    const obj001 = {
      maintainers: [],
      viewers: ['f705ae6b-d3aa-4613-a853-64e6e74e32b7'],
      album: null,
      sticky: false,
      contents: [
        '19caae6dd58f2cc399789961bed6edee14797d8c7c0d518ac274ed0b0867e067'
      ]
    }

    beforeEach(() => (async () => {

      await rimrafAsync('tmptest')
      await mkdirpAsync('tmptest')
      await paths.setRootAsync(path.join(cwd, 'tmptest'))

      let tmpdir = paths.get('tmp')
      let docroot = paths.get('documents')
      let msroot = paths.get('mediashare')
      let msarc = paths.get('mediashareArchive')

      let docstore = await Promise.promisify(createDocumentStore)(docroot, tmpdir)    
      let msstore = createMediaShareStore(docstore)

      media = createMedia(msstore) // FIXME

    })())

    it('new share should set doctype to mediashare', function(done) {
      media.createMediaShare(userUUID, obj001, (err, share) => {
        expect(share.doc.doctype).to.equal('mediashare') 
        done()
      })
    })

    it('new share should set docversion to 1.0', function(done) {
      media.createMediaShare(userUUID, obj001, (err, share) => {
        expect(share.doc.docversion).to.equal('1.0') 
        done()
      })
    })

    it('new share should have uuid', function(done) {
      media.createMediaShare(userUUID, obj001, (err, share) => {
        expect(validator.isUUID(share.doc.uuid)).to.be.true
        done()
      })
    })

    it('new share should set author to given user', function(done) {
      media.createMediaShare(userUUID, obj001, (err, share) => {
        expect(share.doc.author).to.equal(userUUID)
        done()
      })
    })

    it('new share should set maintainer to [] (FIXME!)', function(done) {
      media.createMediaShare(userUUID, obj001, (err, share) => {
        expect(share.doc.maintainers).to.deep.equal([])
        done()
      })
    })

    it('new share should set viewers to given viewers', function(done) {
      media.createMediaShare(userUUID, obj001, (err, share) => {
        expect(share.doc.viewers).to.deep.equal(obj001.viewers)
        done()
      })
    })

    it('new share should set album to given album', function(done) {
      media.createMediaShare(userUUID, obj001, (err, share) => {
        expect(share.doc.album).to.deep.equal(obj001.album)
        done()
      })
    })

    it('new share should set sticky to given sticky', function(done) {
      media.createMediaShare(userUUID, obj001, (err, share) => {
        expect(share.doc.sticky).to.deep.equal(obj001.sticky)
        done()
      })
    })
  
    it('new share should have ctime and mtime', function(done) {
      media.createMediaShare(userUUID, obj001, (err, share) => {
        expect(Number.isInteger(share.doc.ctime)).to.be.true
        expect(Number.isInteger(share.doc.mtime)).to.be.true
        done()
      })
    })

    it('new share should have fixed property sequence', function(done) {

      media.createMediaShare(userUUID, obj001, (err, share) => {

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

        if (err) return done(err)
        expect(Object.getOwnPropertyNames(share.doc)).to.deep.equal(props)
        done()
      })
    })

    // weird, TODO
    it('new share should be put into shareMap (weird)', function(done) {
      media.createMediaShare(userUUID, obj001, (err, share) => {
        expect(media.shareMap.get(share.doc.uuid).doc).to.equal(share.doc)
        done()
      })
    })

    it('new share should be put into mediaMap', function(done) {
      media.createMediaShare(userUUID, obj001, (err, share) => {
        if (err) return done(err)

        let ss = media.mediaMap.get(obj001.contents[0])
        let arr = Array.from(ss)
        expect(arr[0].doc).to.equal(share.doc)
        done()
      })
    })

    it('share hash should be asserted', function(done) {
      throw new Error('not implemented')
    })

    it('new share should be stored', function(done) {
      throw new Error('not implemented')
    })
  })
})

