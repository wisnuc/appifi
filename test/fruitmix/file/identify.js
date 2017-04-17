import path from 'path'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import E from '../../../src/fruitmix/lib/error'
import { mkdirpAsync, rimrafAsync } from '../../../src/fruitmix/lib/async'
import { readXstatAsync, updateFileHashAsync } from '../../../src/fruitmix/file/xstat'
import identify from '../../../src/fruitmix/file/identify'
import { cpAsync } from '../../utils'
import S from '../../assets/samples'

chai.use(chaiAsPromised)

const expect = chai.expect

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
const smpdir = path.join(cwd, 'test', 'assets')

describe(path.basename(__filename), () => {

  describe('should return identify worker', () => {

    it('should return identify worker', done => {
      let id = identify(tmpdir, uuidArr[0], S[0].hash) 
      expect(id.fpath).to.equal(tmpdir)
      expect(id.uuid).to.equal(uuidArr[0])
      expect(id.hash).to.equal(S[0].hash)
      done()
    })
  })

  describe('should retrieve metadata from sample 0', () => {

    let xstat
    let fpath = path.join(tmpdir, S[0].name)
    beforeEach(async () => {
      await rimrafAsync(tmpdir)
      await mkdirpAsync(tmpdir)
      await cpAsync(path.join(smpdir, S[0].name), fpath)
      xstat = await readXstatAsync(fpath)
      xstat = await updateFileHashAsync(fpath, xstat.uuid, S[0].hash, xstat.mtime)
      expect(await readXstatAsync(fpath)).to.deep.equal(xstat)
    })

    it('should identify sample image', done => {
      let id = identify(fpath, xstat.uuid, xstat.hash) 
      id.on('error', err => done(err))
      id.on('finish', data => {
        expect(data).to.deep.equal(S[0].identifyObject)
        done()
      })
      id.start()
    }) 

    it('should return error if fpath is not a file', done => {
      let id = identify(tmpdir, xstat.uuid, xstat.hash)
      id.on('error', err => {
        expect(err).to.be.an.instanceof(E.ENOTFILE)
        done()
      })
      id.start()
    })

    it('should return error if uuid mismatch', done => {
      let id = identify(fpath, uuidArr[0], xstat.hash)
      id.on('error', err => {
        expect(err).to.be.an.instanceof(E.EINSTANCE)
        done()
      })
      id.start()
    })

    it('should return error if hash mismatch', done => {
      let hash1 = '486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7'
      let id = identify(fpath, xstat.uuid, hash1)
      id.on('error', err => {
        expect(err).to.be.an.instanceof(E.ECONTENT)
        done()
      })
      id.start()
    })

    it('should return error if aborted', done => {
      let id = identify(fpath, xstat.uuid, xstat.hash)
      id.on('error', err => {
        expect(err).to.be.an.instanceof(E.EABORT)
        done()
      })
      id.start()
      setTimeout(() => id.abort(), 5)
    })
  })
})

