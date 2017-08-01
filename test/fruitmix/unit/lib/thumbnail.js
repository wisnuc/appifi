import path from 'path'
import crypto from 'crypto'

import { expect } from 'chai'
import app from 'src/fruitmix/app'
import paths from 'src/fruitmix/lib/paths'

import { fakePathModel, fakeRepoSilenced } from 'src/fruitmix/util/fake'

import request from 'supertest'
import { mkdirpAsync, rimrafAsync, fs } from 'src/fruitmix/util/async'

import createThumbnailer from 'src/fruitmix/lib/thumbnail'

const cwd = process.cwd()

let userUUID = '9f93db43-02e6-4b26-8fae-7d6f51da12af'
let drv001UUID = 'ceacf710-a414-4b95-be5e-748d73774fc4'  
let drv002UUID = '6586789e-4a2c-4159-b3da-903ae7f10c2a' 

const img001Path = path.join(process.cwd(), 'tmptest', 'drives', drv001UUID, '20141213.jpg')
const img001Hash = '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be'

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

  let thumbnail

  beforeEach(function() {
    return (async () => {

      await fakePathModel(path.join(cwd, 'tmptest'), users, drives)

      // fake drive dir
      let dir = paths.get('drives')
      await mkdirpAsync(path.join(dir, drv001UUID))
      await copyFileAsync('fruitfiles/20141213.jpg', img001Path)
      await mkdirpAsync(path.join(dir, drv002UUID))

      await fakeRepoSilenced()
      
      thumbnail = createThumbnailer()
    })()     
  })

  it('should queue (no assertion)', done => {

    let query = {
      width: '100',
      height: '100'
    }
        
    thumbnail.request(img001Hash, query, (err, ret) => {
      console.log(err || ret)
      done()
    })
  })

  it('should create (no assertion)', done => {
  
    let query = {
      width: '100',
      height: '100',
      instant: 'true'
    }

    thumbnail.request(img001Hash, query, (err, ret) => {
      console.log(err || ret)
      done()
    })
  })

  it('should create 2 (no assertion)', done => {

    let query = {
      width: '100',
      height: '100',
      modifier: 'caret',
      instant: 'true'
    }

    thumbnail.request(img001Hash, query, (err, ret) => {
      console.log(err || ret)
      done()
    })
  })
})


