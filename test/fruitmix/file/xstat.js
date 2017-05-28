import path from 'path'
import fs from 'fs'
import UUID from 'uuid'
import xattr from 'fs-xattr'
import validator from 'validator'

import { mkdirpAsync, rimrafAsync } from '../../../src/fruitmix/lib/async'
import E from '../../../src/fruitmix/lib/error'

import S from '../../assets/samples'
import { cp, cpAsync } from '../../utils'

import { 
  readTimeStamp,
  readXstat,
  readXstatAsync,
  forceDriveXstatAsync,
} from '../../../src/fruitmix/file/xstat'


import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'
chai.use(chaiAsPromised)
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

describe(path.basename(__filename) + ' readTimeStamp', () => {

	describe('readTimeStamp', () => {

    before(async () => {
      await rimrafAsync(tmptest) 
      await mkdirpAsync(tmptest)
    })

		it('should read timestamp', done => 
      fs.stat(tmpdir, (err, stats) => 
        readTimeStamp(tmpdir, (err, mtime) => {
          if (err) return done(err)
          expect(mtime).to.equal(stats.mtime.getTime()) 
          done()
        })))
	})
})

describe(path.basename(__filename) + ' readXstat', () => {

  beforeEach(async () => {
    await rimrafAsync(tmptest) 
    await mkdirpAsync(tmptest)
  })

  describe('readXstat', () => {

    beforeEach(() => sinon.stub(UUID, 'v4').returns(uuidArr[2]))
    afterEach(() => UUID.v4.restore())

    it('should read xstat from clean directory', done => {
      fs.stat(tmpdir, (err, stats) => {
        if (err) return done(err)
        let mtime = stats.mtime.getTime()
        readXstat(tmpdir, (err, xstat) => {
          expect(xstat).to.deep.equal({
            uuid: uuidArr[2],
            type: 'directory',
            name: 'tmptest',
            mtime
          })
          done()
        })
      })
    })

    it('should read xstat from clean directory, async', () => 
      (async () => {
        let stats = await fs.statAsync(tmpdir)
        let mtime = stats.mtime.getTime()
        let xstat = await readXstatAsync(tmpdir)
        expect(xstat).to.deep.equal({
          uuid: uuidArr[2],
          type: 'directory',
          name: 'tmptest',
          mtime
        })
      })())

    it('should read xstat from clean directory, mocha async', async () => {

      let stats = await fs.statAsync(tmpdir)
      let mtime = stats.mtime.getTime()
      let xstat = await readXstatAsync(tmpdir)
      expect(xstat).to.deep.equal({
        uuid: uuidArr[2],
        type: 'directory',
        name: 'tmptest',
        mtime
      })
    })

    it('should throw ENOTDIRFILE for /dev/null, callback', done => {
      readXstat('/dev/null', (err, xstat) => {
        expect(err).to.be.an.instanceof(E.ENOTDIRFILE)
        done()
      })
    })

    it('should throw ENOTDIRFILE for /dev/null, async bluebird asCallback', done => {
      readXstatAsync('/dev/null').asCallback((err, xstat) => {
        expect(err).to.be.an.instanceof(E.ENOTDIRFILE)
        done()
      })
    })

    it('should throw ENOTDIRFILE for /dev/null, async chai-as-promise', () => {
      // this assertion comes from chai as promised.
      return expect(readXstatAsync('/dev/null')).to.be.rejectedWith(E.ENOTDIRFILE)
    })

    it('should throw ENOTDIRFILE for /dev/null, async try-catch', async () => {
      let err
      try { 
        await readXstatAsync('/dev/null') 
      }
      catch (e) { 
        err = e 
      }
      expect(err).to.be.an.instanceof(E.ENOTDIRFILE)
    })

    it('should drop non-json attr', async () => {
      await xattr.setAsync(tmpdir, 'user.fruitmix', 'hello')
      let stats = await fs.statAsync(tmpdir)
      let xstat = await readXstatAsync(tmpdir)
      expect(xstat).to.deep.equal({
        uuid: uuidArr[2],
        type: 'directory',
        name: 'tmptest',
        mtime: stats.mtime.getTime()
      })
    })
  })
}) 

describe(path.basename(__filename) + ' readXstat file', () => {

  let fpath = path.join(tmpdir, S[0].name)

  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
    await cpAsync(path.join(cwd, 'test', 'assets', S[0].name), fpath)
    sinon.stub(UUID, 'v4').returns(uuidArr[0])
  })

  afterEach(() => {
    UUID.v4.restore()
  })

  it('should read xstat from file without attr', async() => {
    let stats = await fs.statAsync(fpath)

    let xstat = await readXstatAsync(fpath)

    expect(xstat).to.deep.equal({ 
      uuid: uuidArr[0],
      type: 'file',
      name: 'gg_gps.jpg',
      mtime: stats.mtime.getTime(),
      size: 80603,
      magic: 'JPEG'
    })
  })

  it('should read xstat from file with attr containing uuid and type', async() => {

    let stats = await fs.statAsync(fpath)    
    xattr.setAsync(fpath, 'user.fruitmix', JSON.stringify({
      uuid: uuidArr[1],
      magic: 'JPEG' 
    }))

    let xstat = await readXstatAsync(fpath)

    expect(xstat).to.deep.equal({ 
      uuid: uuidArr[1],
      type: 'file',
      name: S[0].name,
      mtime: stats.mtime.getTime(),
      size: S[0].size,
      magic: 'JPEG'
    })
  })

  it('should read xstat from file with attr containing uuid, type, htime, and hash', async() => {

    let stats = await fs.statAsync(fpath)    
    xattr.setAsync(fpath, 'user.fruitmix', JSON.stringify({
      uuid: uuidArr[1],
      hash: S[0].hash,
      htime: stats.mtime.getTime(),
      magic: 'JPEG'
    }))

    let xstat = await readXstatAsync(fpath)

    expect(xstat).to.deep.equal({ 
      uuid: uuidArr[1],
      type: 'file',
      name: 'gg_gps.jpg',
      mtime: stats.mtime.getTime(),
      size: 80603,
      magic: 'JPEG',
      hash: S[0].hash
    })
  })

  it('should read xstat from file with attr containing uuid, type, outdated htime, and hash', async() => {

    let stats = await fs.statAsync(fpath)    
    await xattr.setAsync(fpath, 'user.fruitmix', JSON.stringify({
      uuid: uuidArr[1],
      hash: S[0].hash,
      htime: stats.mtime.getTime() - 1000,
      magic: 'JPEG'
    }))

    let xstat = await readXstatAsync(fpath)

    expect(xstat).to.deep.equal({ 
      uuid: uuidArr[1],
      type: 'file',
      name: 'gg_gps.jpg',
      mtime: stats.mtime.getTime(),
      size: 80603,
      magic: 'JPEG'
    })
  })
})

describe(path.basename(__filename) + ' forceDriveXstat', () => {

  let pre

  beforeEach(async () => {
    await rimrafAsync(tmptest) 
    await mkdirpAsync(tmptest)
    let stats = await fs.statAsync(tmpdir)
    pre = {
      uuid: uuidArr[2],
      type: 'directory',
      name: 'tmptest',
      mtime: stats.mtime.getTime() 
    }
    sinon.stub(UUID, 'v4').returns(uuidArr[1])
  })

  afterEach(() => UUID.v4.restore())

  it('should force xstat of clean dirctory', async () => {
    let xstat = await forceDriveXstatAsync(tmpdir, uuidArr[2])
    expect(xstat).to.deep.equal(pre)
  })

  it('should force xstat of directory with existing (different) uuid', async () => {

    let xstat

    await xattr.setAsync(tmpdir, 'user.fruitmix', JSON.stringify({ uuid: uuidArr[0] }))

    // xstat = await readXstatAsync(tmpdir)
    // expect(xstat.uuid).to.equal(uuidArr[0])

    xstat = await forceDriveXstatAsync(tmpdir, uuidArr[2])
    expect(xstat).to.deep.equal(pre)
  })
})

