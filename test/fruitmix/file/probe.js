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
import probe from '../../../src/fruitmix/file/probe'

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

const fillAsync = async (dir, tree) => {

  let xstats = []

  for (let prop in tree) {
    if (tree.hasOwnProperty(prop)) {

      let npath = path.join(tmpdir, prop)
      if (tree[prop].type === 'directory') {
        await mkdirpAsync(npath)
        xattr.setAsync(npath, 'user.fruitmix', JSON.stringify({
          uuid: tree[prop].uuid 
        }))
      }
      else {
        await fs.writeFileAsync(npath, '\n')
        xattr.setAsync(npath, 'user.fruitmix', JSON.stringify({
          uuid: tree[prop].uuid,
          magic: 0
        }))
      } 

      xstats.push(await readXstatAsync(npath))
    }
  }

  xstats.sort((a, b) => a.name.localeCompare(b.name))

  let stats = await fs.lstatAsync(dir)
  let mtime = stats.mtime.getTime()

  return { mtime, xstats }
}


// force probing means feed probe with FILE.NULLTIME as mtime

describe(path.basename(__filename), () => {

  describe('no preset directory uuid, empty', () => {

    beforeEach(async () => {
      await rimrafAsync(tmpdir)
      await mkdirpAsync(tmpdir)
    })

    it('should return a probe worker', done => {
      let w = probe(tmpdir, uuidArr[0], 123456, 0)
      expect(w.finished).to.be.false
      expect(w.again).to.be.false
      expect(w.timer).to.be.undefined
      done()
    })

    it('should throw EINSTANCE when force probing directory without attr', done => {
      let w = probe(tmpdir, uuidArr[0], 123456, 0)
      w.on('error', (err, again) => {
        expect(again).to.be.false
        expect(err).to.be.an('error')
        expect(err.code).to.equal('EINSTANCE')
        done()
      })
      w.on('finish', (data, again) => {throw `error finish`})
      w.start()
    })
  })

  describe('preset directory uuid, empty', () => {

    let xstat

    beforeEach(async () => {
      await rimrafAsync(tmpdir)
      await Promise.delay(10)
      await mkdirpAsync(tmpdir)
      xstat = await readXstatAsync(tmpdir)
    })

    it('should throw EINSTANCE when force probing directory without different uuid', done => {
      let w = probe(tmpdir, uuidArr[0], FILE.NULLTIME, 0)
      w.on('error', (err, again) => {
        expect(again).to.be.false
        expect(err).to.be.an('error')
        expect(err.code).to.equal('EINSTANCE')
        done()
      })
      w.on('finish', (data, again) => {throw `error finish`})
      w.start()
    })

    it('should return null data if mtime match', done => {
      let w = probe(tmpdir, xstat.uuid, xstat.mtime, 0)
      w.on('error', (err, again) => { throw `error error` })
      w.on('finish', (data, again) => {
        expect(data).to.be.null
        expect(again).to.be.false
        done()
      })
      w.start()
    })

    it('should return xstat list if mtime renewed', done => {
      fillAsync(tmpdir, tree01).asCallback((err, data1) => {
        if (err) return done(err)
        let w = probe(tmpdir, xstat.uuid, xstat.mtime, 0)
        w.on('error', (err, again) => { throw `error error`})
        w.on('finish', (data2, again) => {
          expect(data2).to.deep.equal(data1)
          expect(again).to.be.false
          done()
        })
        w.start()
      })
    })   
  })
})

