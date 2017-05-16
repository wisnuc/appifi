import path from 'path'
import fs from 'fs'
import EventEmitter from 'events'

import UUID from 'node-uuid'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

import sinon from 'sinon'
import xattr from 'fs-xattr'
import validator from 'validator'

import { mkdirpAsync, rimrafAsync } from '../../../src/fruitmix/lib/async'
import E from '../../../src/fruitmix/lib/error'
import { readTimeStamp, readXstat, readXstatAsync, forceDriveXstatAsync } from '../../../src/fruitmix/file/xstat'
import Node from '../../../src/fruitmix/file/node'
import FileNode from '../../../src/fruitmix/file/fileNode'
import DirectoryNode from '../../../src/fruitmix/file/directoryNode'
import FileData from '../../../src/fruitmix/file/fileData'
const { visitor } = require('./visitor')

const expect = chai.expect
const should = chai.should()

const uuidArr = [
	'c3256d90-f789-47c6-8228-9878f2b106f6',
	'6c15ff0f-b816-4b2e-8a2e-2f7c4902d13c',
	'b6d7a826-0635-465f-9034-1f5a69181f68',
	'e4197ec7-c588-492c-95c4-be6172318932',
	'494e2130-56c6-477c-ba4f-b87226eb7ebd',
	'52285890-5556-47fb-90f3-45e14e741ccd',
	'6648fe47-bcf0-43cb-9f64-996620595bd7',
	'238e1fa5-8847-43e6-860e-cf812d1f5e65',
	'146e05a5-d31b-4601-bc56-a46e66bb14eb'
]

const cwd = process.cwd()
const tmptest = 'tmptest'
const tmpdir = path.join(cwd, tmptest)

class ModelMock extends EventEmitter {
  constructor() {
    super()
  }
}

const createModelMock = () => {
  return new ModelMock()
}

describe(path.basename(__filename), () => {
  let model, fileData

  beforeEach(async () => {
    await rimrafAsync(tmptest) 
    await mkdirpAsync(tmptest)
    model = createModelMock()
    fileData = new FileData(tmpdir, model)
  })

  // afterEach(async () => {
  //   await rimrafAsync(tmptest)
  // })

  describe('create a fileData', () => {
    it('should create a new file data (constructor)', done => {
      expect(fileData.dir).to.equal(tmpdir)
      expect(fileData.model).to.equal(model)
      expect(fileData.root).to.be.an.instanceof(Node)
      expect(fileData.uuidMap).to.be.an.instanceof(Map)
      done()
    })
  })

  describe('create, update, requestProbe', () => {
    beforeEach(async () => {
      model.emit('drivesCreated', [{
        uuid: uuidArr[0],
        type: 'private',
        owner: uuidArr[1],
        label: 'alice'
      }])
      await Promise.delay(10)
    })

    // this test is not unit anymore, its integration test
    it('should create a drive (drivesCreated)', async () => {
      // this emit will trigger
      // 1. mkdirp
      // 2. forceDriveXstat
      // 3. probe
      
      let stats = await fs.statAsync(path.join(tmpdir, uuidArr[0]))

      let dn= fileData.root.children[0]
      let uuid = uuidArr[0]
      
      // assert directory node member
      expect(dn.ctx).to.equal(fileData)
      expect(dn.uuid).to.equal(uuid)
      expect(dn.name).to.equal(uuid)
      expect(dn.mtime).to.equal(stats.mtime.getTime())

      // assert drive
      expect(dn.drive.uuid).to.equal(uuid)
      expect(dn.drive.type).to.equal('private')
      expect(dn.drive.owner).to.equal(uuidArr[1])

      // assert map
      expect(fileData.uuidMap.get(uuid)).to.equal(dn)
    })

    it('should update a drive', async () => {

      let drive2 = {
        uuid: uuidArr[0],
        type: 'private',
        owner: uuidArr[1],
        label: 'bob'
      }

      let dn = fileData.root.children[0]
      expect(dn.drive.label).to.equal('alice')

      model.emit('driveUpdated', drive2)
      await Promise.delay(10)
      dn = fileData.root.children[0]

      expect(dn.drive.label).to.equal('bob')
      expect(fileData.uuidMap.get(uuidArr[0])).to.equal(dn)
    })

    it('should create a directory node', async () => {
      let fpath = path.join(tmpdir, uuidArr[0], 'testFolder')
      await mkdirpAsync(fpath)
      let xstat = await readXstatAsync(fpath)
      let parent = fileData.uuidMap.get(uuidArr[0])
      let result = fileData.createNode(parent, xstat)

      await Promise.delay(10)
      let real = visitor(path.join(tmpdir, uuidArr[0]))
      await Promise.delay(10)

      expect(fileData.uuidMap.has(result)).to.be.true    
      expect(real.size).to.equal(fileData.uuidMap.size)
      fileData.uuidMap.forEach((value, key, map) => {
        expect(real.has(key)).to.be.true
      })
    })

    it('should create a file node', async () => {
      let fpath = path.join(tmpdir, uuidArr[0], 'testFile')
      await fs.writeFileAsync(fpath, 'world')
      let xstat = await readXstatAsync(fpath)
      await Promise.delay(10)

      let parent = fileData.uuidMap.get(uuidArr[0])
      let result = fileData.createNode(parent, xstat)

      let real = visitor(path.join(tmpdir, uuidArr[0]))
      await Promise.delay(10)

      expect(fileData.uuidMap.has(result)).to.be.true
      expect(real.size).to.equal(fileData.uuidMap.size)
      
      real.forEach((value, key, map) => {
        expect(fileData.uuidMap.has(key)).to.be.true
      })
    })

    it('should update a directory node', async () => {
      let fpath = path.join(tmpdir, uuidArr[0], 'testFolder')
      await mkdirpAsync(fpath)

      let xstat = await readXstatAsync(path.join(tmpdir, uuidArr[0]))
      fileData.updateNode(fileData.uuidMap.get(uuidArr[0]), xstat)
      // probe of the node will start after delay 500ms
      // so delay time here should longer than 500ms
      await Promise.delay(600) 

      expect(fileData.uuidMap.size).to.equal(2)
      expect(fileData.uuidMap.has(xstat.uuid)).to.be.true
    })

    it('request probe after add files or folders', async () => {
      let fpath_1 = path.join(tmpdir, uuidArr[0], 'testFile')
      await fs.writeFileAsync(fpath_1, 'hello')
      let xstat_1 = await readXstatAsync(fpath_1)
      let fpath_2 = path.join(tmpdir, uuidArr[0], 'testFolder')
      await mkdirpAsync(fpath_2)
      let xstat_2 = await readXstatAsync(fpath_2)

      fileData.requestProbeByUUID(uuidArr[0])
      await Promise.delay(600)
      expect(fileData.uuidMap.size).to.equal(3)
      expect(fileData.uuidMap.has(xstat_1.uuid)).to.be.true
      expect(fileData.uuidMap.has(xstat_2.uuid)).to.be.true
    })

    it('request probe after delete file of folder', async () => {
      let fpath_1 = path.join(tmpdir, uuidArr[0], 'testFile')
      await fs.writeFileAsync(fpath_1, 'hello')
      let xstat_1 = await readXstatAsync(fpath_1)
      let parent = fileData.uuidMap.get(uuidArr[0])
      fileData.createNode(parent, xstat_1)

      let fpath_2 = path.join(tmpdir, uuidArr[0], 'testFolder')
      await mkdirpAsync(fpath_2)
      let xstat_2 = await readXstatAsync(fpath_2)
      fileData.createNode(parent, xstat_2)
      await Promise.delay(10)

      expect(fileData.uuidMap.size).to.equal(3)

      await rimrafAsync(fpath_1)
      fileData.requestProbeByUUID(uuidArr[0])
      await Promise.delay(600)

      expect(fileData.uuidMap.size).to.equal(2)
      expect(fileData.uuidMap.has(xstat_1.uuid)).to.be.false
      expect(fileData.uuidMap.has(xstat_2.uuid)).to.be.true
    })

  })
  
})

