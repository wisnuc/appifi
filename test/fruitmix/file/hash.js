import path from 'path'
import fs from 'fs'
import UUID from 'node-uuid'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'
import xattr from 'fs-xattr'
import validator from 'validator'

import E from '../../../src/fruitmix/lib/error'
import { FILE } from '../../../src/fruitmix/lib/const'

import { mkdirpAsync, rimrafAsync } from '../../../src/fruitmix/lib/async'
import { readXstatAsync, forceDriveXstatAsync } from '../../../src/fruitmix/file/xstat'
import hash from '../../../src/fruitmix/file/hash'

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

const tree01 = {
  'dir0': { uuid: uuidArr[0], type: 'directory' },
  'dir1': { uuid: uuidArr[1], type: 'directory' },
  'file0': { uuid: uuidArr[2], type: 'file' },
  'file1': { uuid: uuidArr[3], type: 'file' },
}

describe(path.basename(__filename), () => {


  describe('create a hash worker', () => {

    beforeEach(async () => {
      await rimrafAsync(tmpdir)
      await mkdirpAsync(tmpdir)
    })

    it('should return a hash worker', done => {
      let h = hash(tmpdir, uuidArr[0])
      expect(h.finished).to.be.false
      done()
    })

    it('should set fpath to given fpath', done => {
      let h = hash(tmpdir, uuidArr[0])
      expect(h.fpath).to.equal(tmpdir)
      done()
    })

    it('should set uuid to given uuid', done => {
      let h = hash(tmpdir, uuidArr[0])
      expect(h.uuid).to.equal(uuidArr[0])
      done()
    })

    it('should set cmd to undefined', done => {
      let h = hash(tmpdir, uuidArr[0])
      expect(h.cmd).to.be.undefined
      done()
    })

    it('should set hash to undefined', done => {
      let h = hash(tmpdir, uuidArr[0])
      expect(h.hash).to.be.undefined
      done()
    })
  })

  describe('hash computing', () => {

    let digest = '486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7'
    let xstat, fpath = path.join(tmpdir, 'hello')

    beforeEach(async () => {
      await rimrafAsync(tmpdir)
      await mkdirpAsync(tmpdir)
      await fs.writeFileAsync(fpath, 'world')
      xstat = await readXstatAsync(fpath)
    })
   
    it('should return hash value for world', done => {
      let h = hash(fpath, xstat.uuid)
      h.on('error', err => done(err))
      h.on('finish', xstat2 => {
        expect(xstat2).to.deep.equal(Object.assign({}, xstat, { hash: digest }))
        done()
      })
      h.start()
    })

    it('should return error if aborted', done => {
      let h = hash(fpath, xstat.uuid)
      h.on('error', err => {
        expect(err).to.be.an.instanceof(E.EABROT)
        done()
      })
      h.start()
      setTimeout(() => h.abort(), 10)
    })
  })
})















