import path from 'path'
import fs from 'fs'

import { expect } from 'chai'
import request from 'supertest'
import xattr from 'fs-xattr'
import Promise from 'bluebird'

import paths from '../../../../src/fruitmix/cluster/lib/paths'
import { rimrafAsync, mkdirpAsync } from '../../../../src/fruitmix/util/async'
import { createFileMap, updateFileMap } from '../../../../src/fruitmix/cluster/lib/filemap'
import App from  '../../../../src/fruitmix/cluster/app'

let app = App()

paths.setRoot(process.cwd(), () => {})

let imagePath = path.join(process.cwd(), 'testpic', '20141213.jpg')

const size =  2331588 ,
  segmentsize = 1000000 ,
  nodeuuid = '123456',
  sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  name = '20141213.jpg',
  userUUID = '111222333444555',
  segmentHash = '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be12346'
// const createArgs =  { size, segmentsize, nodeuuid, sha256, name, userUUID }
describe(path.basename(__filename), function() {
   describe('create filemap', function() {
     beforeEach( async () => {
      await rimrafAsync('filemap')
      await mkdirpAsync('filemap')
     })

     it('createFilemap should create a file in filemap/', (done) => {
      let createFileMapArgs = { size, segmentsize, nodeuuid, sha256, name, userUUID}
      createFileMap(createFileMapArgs, (e , data) => {
        if(e) return done(e)
        let filepath = path.join(paths.get('filemap'), userUUID, sha256)
        let stat = fs.statSync(filepath)
        expect(stat.size).to.be.equal(size)
        let attr = JSON.parse(xattr.getSync(filepath, 'user.filemap'))
        expect(data).to.be.deep.equal(attr)
        done()
      })
    })

    afterEach('clean filemap', async (done)=> {
      await rimrafAsync('filemap')
      await mkdirpAsync('filemap')
      done()
    })
   })

  
  //  describe('test updateFileMap', function() {
  //   beforeEach( async (done) => {
  //     await rimrafAsync('filemap')
  //     await mkdirpAsync('filemap')
  //     let createFileMapArgs = { size, segmentsize, nodeuuid, sha256, name, userUUID}
  //     createFileMap(createFileMapArgs, (e , data) => {
  //       if(e) return done(e)
  //       done()
  //     })
  //   })

  //   it(`should update file ${ sha256 } in file map `, (done) => {
  //     //  /nodeuuid?filename=xxx&segmentHash=xxx&start=xx&sha256=xxx
  //     let req = request(app).put(`/filemap/${ nodeuuid }?filename=${ name }&segmentHash=${ segmentHash }&start=0&sha256=${ sha256 }`)
  //     let stream = fs.createReadStream(imagePath)
  //     stream.pipe(req)
  //     req.expect(200)
  //     done()
  //   })

    // afterEach('clean filemap', async (done)=> {
    //   await rimrafAsync('filemap')
    //   await mkdirpAsync('filemap')
    //   done()
    // })
  //  })
  
})
