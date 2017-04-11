const path = require('path')
const { expect } = require('chai')
const sinon = require('sinon')
import EventEmitter from 'events'

import { rimrafAsync, mkdirpAsync } from '../../../src/fruitmix/util/async'
import { createDocumentStoreAsync } from '../../../src/fruitmix/lib/documentStore'
import { createFileShareStoreAsync } from '../../../src/fruitmix/lib/shareStore'
import { createFileShareData } from '../../../src/fruitmix/file/fileShareData'
import { createFileShareService } from '../../../src/fruitmix/file/fileShareService'
import E from '../../../src/fruitmix/lib/error'
import FileData from '../../../src/fruitmix/file/fileData'
import FileService from '../../../src/fruitmix/file/fileService'

const { model, uuids, createTestTrees } = require('./testTrees')

const cwd = process.cwd()
const tmpdir = path.join(cwd, 'tmptest')
const froot = path.join(tmpdir, 'tmptest')

let fileData
describe(path.basename(__filename), () => {

  // generate a tree
  before(async () => {

    await rimrafAsync('tmptest')
    await mkdirpAsync('tmptest')

    fileData = new FileData(tmpdir, model)
    await createTestTrees(model,fileData)

  })

  // after(async () => await rimrafAsync('tmptest'))

  let fileShareStore, shareData, fileService
  beforeEach(async () => {

    await rimrafAsync(froot)
    await mkdirpAsync(froot)

    let docstore = await createDocumentStoreAsync(froot)
    fileShareStore = await createFileShareStoreAsync(froot, docstore)
    shareData = createFileShareData(model, fileShareStore)
    fileService = new FileService(froot, fileData, shareData)

    //FIXME: 
    // let fileShareService = createFileShareService(fileData, shareData)
    // let post = {
    //   writelist: [aliceUUID],
    //   readlist: [bobUUID],
    //   collection: [uuid2, uuid4, uuid6]
    // }
    // await fileShareService.createFileShare('abcd', post)
  })

  afterEach(async () => await rimrafAsync(froot))

  describe('new FileService', function () {
    it('should new FileService successfully', done => {

      expect(fileService.froot).to.deep.equal(froot)
      expect(fileService.data).to.deep.equal(fileData)
      expect(fileService.shareData).to.deep.equal(shareData)
      done()
    })
  })

  describe('list', function () {
    it('should return error if userUUID isn`t onwer', async () => {
      let err
      try {
        await fileService.list({
          userUUID: uuids.uuid9, 
          dirUUID: uuids.uuid1
        })
      }
      catch (e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })
  })
  
  describe('navList', function () {
    it('should return error if dirUUID isn`t a virtual drive uuid', async () => {
      let err
      try {
        await fileService.navList({
          userUUID: uuids.userUUID,
          dirUUID: uuids.uuid10,
          rootUUID: uuids.uuid1
        })
      }
      catch (e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.ENOENT)
    })
  })

  describe('createDirectory', function () {
    it('should return error if dirUUID is a fileShare uuid', async () => {
      let err
      try {
        let list = await fileService.createDirectory({
          userUUID: uuids.userUUID,
          dirUUID: uuids.uuid10,
          dirname: 'xxxxx'
        })
        console.log(list)
      }
      catch (e) {
        err = e
      }
      console.log('mkdir error: ' + err)
      // expect(err).to.be.an.instanceof(E.NODENOTFOUND)
    })
  })
  
  describe('tree', function () {
    it('should return error if userUUID isn`t onwer', async () => {
      let err
      try {
        await fileService.tree({
          userUUID: uuids.uuid9,
          dirUUID: uuids.uuid1
        })
      }
      catch (e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.EACCESS)
    })
  })

    
  describe('navTree', function () {
    it('should return error if dirUUID isn`t a virtual drive uuid', async () => {
      let err
      try {
        let list = await fileService.navTree({
          userUUID: uuids.userUUID,
          dirUUID: uuids.uuid10,
          rootUUID: uuids.uuid1
        })
        console.log(list)
      }
      catch (e) {
        err = e
      }
      expect(err).to.be.an.instanceof(E.ENOENT)
    })
  })
})