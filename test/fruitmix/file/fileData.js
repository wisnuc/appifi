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

const { ENOTDIRFILE } = E

import { 
  readTimeStamp,
  readXstat,
  readXstatAsync,
  forceDriveXstatAsync,
} from '../../../src/fruitmix/file/xstat'

import Node from '../../../src/fruitmix/file/node'
import FileNode from '../../../src/fruitmix/file/fileNode'
import DirectoryNode from '../../../src/fruitmix/file/directoryNode'
import FileData from '../../../src/fruitmix/file/fileData'

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

  describe('create file data', () => {
    before(async () => {
      await rimrafAsync(tmptest) 
      await mkdirpAsync(tmptest)
    })
  })

  it('should create a new file data', done => {

    let model = createModelMock() 
    let fileData = new FileData(tmpdir, model)
    expect(fileData.dir).to.equal(tmpdir)
    expect(fileData.model).to.equal(model)
    expect(fileData.root).to.be.an.instanceof(Node)
    expect(fileData.uuidMap).to.be.an.instanceof(Map)
    done()
  })

  // this test is not unit anymore, its integration test
  it('should create a drive', async () => {

    let model = createModelMock()
    let fileData = new FileData(tmpdir, model)

    // this emit will trigger
    // 1. mkdirp
    // 2. forceDriveXstat
    // 3. probe
    model.emit('drivesCreated', [{
      uuid: uuidArr[0],
      type: 'private',
      owner: uuidArr[1]
    }])

    await Promise.delay(100)
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
})

