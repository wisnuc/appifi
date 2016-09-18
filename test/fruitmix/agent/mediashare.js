import path from 'path'
import Promise from 'bluebird'

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

const expect = chai.expect
const should = chai.should()

import validator from 'validator'

import app from 'src/fruitmix/app'
import models from 'src/fruitmix/models/models'
import paths from 'src/fruitmix/lib/paths'
import { createUserModelAsync } from 'src/fruitmix/models/userModel'
import { createDriveModelAsync } from 'src/fruitmix/models/driveModel'
import { createDrive } from 'src/fruitmix/lib/drive'
import { createRepo } from 'src/fruitmix/lib/repo'

import { createDocumentStore } from 'src/fruitmix/lib/documentStore'
import { createMediaShareStore } from 'src/fruitmix/lib/mediaShareStore'
import createMedia from 'src/fruitmix/lib/media'

import request from 'supertest'
import { mkdirpAsync, rimrafAsync, fs } from 'src/fruitmix/util/async'

import { initFamilyRoot, genUserToken } from 'src/fruitmix/util/family'

let userUUID = '9f93db43-02e6-4b26-8fae-7d6f51da12af'
let drv001UUID = 'ceacf710-a414-4b95-be5e-748d73774fc4'  
let drv002UUID = '6586789e-4a2c-4159-b3da-903ae7f10c2a' 

const img001Path = path.join(process.cwd(), 'tmptest', 'drives', drv001UUID, '20141213.jpg')

let users = [
  {
    uuid: userUUID,
    username: 'hello',
    password: '$2a$10$0kJAT..tF9IihAc6GZfKleZQYBGBHSovhZp5d/DiStQUjpSMnz8CC',
    avatar: null,
    email: null,
    isFirstUser: true,
    isAdmin: true,
  }
]

let drives = [
  {
    label: 'drv001',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: drv001UUID,
    owner: [ userUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'drv002',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: drv002UUID,
    owner: [ userUUID ],
    writelist: [],
    readlist: [],
    cache: true
  }
]

const requestToken = (callback) => {

  request(app)
    .get('/token')
    .auth(userUUID, 'world')
    .set('Accept', 'application/json')
    .end((err, res) => err ? callback(err) : callback(null, res.body.token))
}

const requestTokenAsync = Promise.promisify(requestToken)

const createRepoHashMagicStopped = (paths, model, forest, callback) => {
  
  let err
  let repo = createRepo(paths, model, forest) 
  repo.on('hashMagicWorkerStopped', () => !err && callback(null, repo))
  repo.init(e => e && callback(err = e))
}

const createRepoAsync = Promise.promisify(createRepoHashMagicStopped)

const copyFile = (src, dst, callback) => {

  let error = null
  let is = fs.createReadStream(src)
  is.on('error', err => {
    if (error) return
    error = err
    callback(err)
  })

  let os = fs.createWriteStream(dst)
  os.on('error', err => {
    if (error) return
    error = err
    callback(err)
  })

  os.on('close', () => {
    if (error) return
    callback(null)
  })  
  
  is.pipe(os)
}

const copyFileAsync = Promise.promisify(copyFile)

describe(path.basename(__filename), function() {

  describe('test mediashare', function() {
  
    let token
    let cwd = process.cwd()

    beforeEach(function() {
      return (async () => {

        // make test dir
        await rimrafAsync('tmptest')
        await mkdirpAsync('tmptest')

        // set path root
        await paths.setRootAsync(path.join(cwd, 'tmptest'))

        // fake drive dir
        let dir = paths.get('drives')
        await mkdirpAsync(path.join(dir, drv001UUID))
        await copyFileAsync('fruitfiles/20141213.jpg', img001Path)
        await mkdirpAsync(path.join(dir, drv002UUID))
        
        // write model files
        dir = paths.get('models')
        let tmpdir = paths.get('tmp')
        await fs.writeFileAsync(path.join(dir, 'users.json'), JSON.stringify(users, null, '  '))
        await fs.writeFileAsync(path.join(dir, 'drives.json'), JSON.stringify(drives, null, '  '))

        // create models
        let umod = await createUserModelAsync(path.join(dir, 'users.json'), tmpdir)
        let dmod = await createDriveModelAsync(path.join(dir, 'drives.json'), tmpdir)

        // set models
        models.setModel('user', umod)
        models.setModel('drive', dmod)

        // forest
        let forest = createDrive()
        models.setModel('forest', forest)

        // create repo and wait until drives cached
        let repo = await createRepoAsync(paths, dmod, forest)
        models.setModel('repo', repo)

        let docpath = paths.get('documents')
        let docstore = await Promise.promisify(createDocumentStore)(docpath, tmpdir)  

        let mediasharePath = paths.get('mediashare')
        let mediashareArchivePath = paths.get('mediashareArchive')
        let msstore = createMediaShareStore(mediasharePath, mediashareArchivePath, tmpdir, docstore) 

        let media = createMedia(msstore)        
        models.setModel('media', media)

        // request a token for later use
        token = await requestTokenAsync()
        // console.log(token)
      })()     
    })

    const postMediaShare = (post, callback) => {

      request(app)
        .post('/mediashare')
        .send(post)
        .set('Authorization', 'JWT ' + token)
        .set('Accept', 'application/json')
        .expect(200)
        .end((err, res) => {
          if (err) return callback(err)
          callback(null, res.body)
        })
   
    }

    const postMediaShareAsync = Promise.promisify(postMediaShare)

    const single = {
      maintainers: [],
      viewers: [],
      contents: [
        '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be' 
      ],
    }


    it('doc/single should have doctype as mediashare', () => 
      postMediaShareAsync(single).should.eventually.have.property('doctype', 'mediashare'))

    it('doc/single should have docversion as 1.o', () => 
      postMediaShareAsync(single).should.eventually.have.property('docversion', '1.0'))

    it('doc/single should have uuid', () => 
      postMediaShareAsync(single).should.eventually.have.property('uuid')
        .to.satisfy(uuid => typeof uuid === 'string' && validator.isUUID(uuid)))

    it('doc/single should have userUUID as author', () => 
      postMediaShareAsync(single).should.eventually.have.property('author').to.equal(userUUID))

    it('doc/single should have empty maintainers', () =>
      postMediaShareAsync(single).should.eventually.have.property('maintainers').to.deep.equal([]))

    it('doc/single should have empty viewers', () =>
      postMediaShareAsync(single).should.eventually.have.property('viewers').to.deep.equal([]))
  
    it('doc/single should have null album', () =>
      postMediaShareAsync(single).should.eventually.have.property('album').to.be.null)
    
    it('doc/single should have false sticky', () =>
      postMediaShareAsync(single).should.eventually.have.property('sticky').to.be.false)

    it('doc/single should have ctime', () => 
      postMediaShareAsync(single).should.eventually.have.property('ctime').to.be.a('number'))

    it('doc/single should have mtime', () =>
      postMediaShareAsync(single).should.eventually.have.property('mtime').to.be.a('number'))

    it('doc/single should have 1 item in contents', () => 
      postMediaShareAsync(single).should.eventually.have.deep.property('contents.length').to.equal(1))

    it('doc/single contents[0] should have author as userUUID', () =>
      postMediaShareAsync(single).should.eventually.have.deep.property('contents[0].author', userUUID))

    it('doc/single contents[0] should have the same digest as given', () =>
      postMediaShareAsync(single).should.eventually.have.deep.property('contents[0].digest', single.contents[0]))

    it('doc/single contnets[0] should have time', () => 
      postMediaShareAsync(single).should.eventually.have.deep.property('contents[0].time').to.be.a('number'))

/**

{ doctype: 'mediashare',
  docversion: '1.0',
  uuid: '6b142490-c9bf-40b9-9599-4ee675929780',
  author: '9f93db43-02e6-4b26-8fae-7d6f51da12af',
  maintainers: [],
  viewers: [],
  album: null,
  sticky: false,
  ctime: 1474098479233,
  mtime: 1474098479233,
  contents: 
   [ { author: '9f93db43-02e6-4b26-8fae-7d6f51da12af',
       digest: '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be',
       time: 1474098479233 } ] }

**/

    it('test get mediashares', function(done) {
      request(app)
        .post('/mediashare')
        .send({
          maintainers: [],
          viewers: [],
          contents: [
            '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be' 
          ],
        })
        .set('Authorization', 'JWT ' + token)
        .set('Accept', 'application/json')
        .expect(200)
        .end(err => {
          if (err) return done(err)

          request(app)
            .get('/mediashare')   
            .set('Authorization', 'JWT ' + token) 
            .set('Accept', 'application/json')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              console.log(res.body)
              done()
            })
        })
    })

  })
})
