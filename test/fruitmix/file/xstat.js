import path from 'path'
import fs from 'fs'
import UUID from 'node-uuid'
import chai from 'chai'
import xattr from 'fs-xattr'
import validator from 'validator'

import { mkdirpAsync, rimrafAsync } from '../../../src/fruitmix/lib/async'

import { 
  readTimeStamp 
} from '../../../src/fruitmix/file/xstat'

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

describe(path.basename(__filename) + ' readTimeStamp', () => {

	describe('readTimeStamp', () => {

    before(() => (async () => {
      await rimrafAsync(tmptest) 
      await mkdirpAsync(tmptest)
    })())

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

  
}) 
