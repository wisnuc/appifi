import path from 'path'

import Promise from 'bluebird'

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)
const { expect } = chai

import uuids from '../util/uuids'
import { rimrafAsync, mkdirpAsync, fs, xattr } from '../util/async'

import paths from 'src/fruitmix/lib/paths'
import models from 'src/fruitmix/models/models'
import { createUserModelAsync } from 'src/fruitmix/models/userModel'
import { createDriveModelAsync } from 'src/fruitmix/models/driveModel'
import { createDrive } from 'src/fruitmix/lib/drive'
import { createRepo } from 'src/fruitmix/lib/repo'

const cwd = process.cwd()

let userUUID = '9f93db43-02e6-4b26-8fae-7d6f51da12af'
let drv001UUID = 'ceacf710-a414-4b95-be5e-748d73774fc4'  
let drv002UUID = '6586789e-4a2c-4159-b3da-903ae7f10c2a' 
let img001Digest = '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be'

let users = [
  {
    uuid: userUUID,
    username: 'hello',
    password: '$2a$10$0kJAT..tF9IihAc6GZfKleZQYBGBHSovhZp5d/DiStQUjpSMnz8CC',
    avatar: null,
    email: null,
    isFirstUser: true,
    isAdmin: true,
    home: drv001UUID,
    library: drv001UUID,
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

// this function prepare the repo with above simple setting, one user and two drives
const prepare = async () => {

  // make test dir
  await rimrafAsync('tmptest')
  await mkdirpAsync('tmptest')

  // set path root
  await paths.setRootAsync(path.join(cwd, 'tmptest'))

  // fake drive dir
  let dir = paths.get('drives')
  await mkdirpAsync(path.join(dir, drv001UUID))
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

}

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

  describe('create repo', function() {

    beforeEach(function() {
      return prepare()
    })      
  
    it('should create a repo, with paths, driveModel, drive, and state properly set', function() {
      let driveModel = models.getModel('drive')
      let forest = createDrive()
      let repo = createRepo(paths, driveModel, forest)

      expect(repo.paths).to.equal(paths)
      expect(repo.driveModel).to.equal(driveModel)
      expect(repo.forest).to.equal(forest)
      expect(repo.state).to.equal('IDLE')
    })
  })

  describe('init repo', function() {
    
    beforeEach(function() {
      return prepare()
    }) 

    it('should transit to INITIALIZING state then INITIALIZED, with two drives with correct uuid', function(done) {
      let driveModel = models.getModel('drive')
      let forest = createDrive()
      let repo = createRepo(paths, driveModel, forest)

      repo.init(() => {
        expect(repo.state).to.equal('INITIALIZED')
        expect(repo.forest.roots.length).to.equal(2)
        expect(repo.forest.roots.map(n => n.uuid).sort()).to.deep.equal([drv002UUID, drv001UUID])
        done()
      })

      expect(repo.state).to.equal('INITIALIZING')
    })
  })

  describe('copy a file into drive root', function() {

    const jpegFilePath = path.join(process.cwd(), 'tmptest', 'drives', drv001UUID, '20141213.jpg')

    beforeEach(function() {
      return (async () => {
        await prepare()
        await copyFileAsync('fruitfiles/20141213.jpg', jpegFilePath)
      })()
    })

    it('if this fails, please git clone http://github.com/wisnu/fruitfiles', function(done) {
      fs.stat(jpegFilePath, (err, stats) => {
        expect(stats.isFile()).to.be.true
        done()
      }) 
    })

    it('observe', function(done) {

      let img001Meta = { type: 'JPEG', width: 3264, height: 1836, extended: true }

      let driveModel = models.getModel('drive')
      let forest = createDrive()
      let repo = createRepo(paths, driveModel, forest)

      repo.on('hashMagicWorkerStopped', () => {
        expect(forest.hashMap.size).to.equal(1)
        expect(forest.hashMap.has(img001Digest)).to.be.true
        expect(forest.hashMap.get(img001Digest).meta).to.deep.equal(img001Meta)
        done()
      })
      repo.init(() => {
        console.log('repo initialized')
      })
    })
  })

})


