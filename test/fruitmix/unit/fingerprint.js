const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const crypto = require('crypto')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)

const expect = chai.expect
const should = chai.should()

const { createTestFilesAsync } = require('src/utils/createTestFiles')
const createFingerprintWorker = require('src/lib/fingerprintWorker')

const fingerprintSimpleAsync = Promise.promisify(require('src/utils/fingerprintSimple'))

const fingerprint = (filePath, callback) => {

  let fw = createFingerprintWorker(filePath)
  fw.on('finish', () => {
    if (fw.error) 
      callback(fw.error)
    else 
      callback(null, fw.data.fingerprint)
  })
}

const fingerprintAsync = Promise.promisify(fingerprint)

const cwd = process.cwd()
const rootPath = path.join(cwd, 'tmptest')
const tmpDir = path.join(rootPath, 'tmp')

describe(path.basename(__filename), () => {

  describe('calculate fingerprint of test-files', () => {


    before(async function () {

      this.timeout(0)

      await rimrafAsync('test-files')
      await mkdirpAsync('test-files')
      await createTestFilesAsync()
    })

/**
    it('calc fingerprints for all files', async function () {

      this.timeout(0)
      
      let fp1 = {}
      let fp2 = {}
      let entries = await fs.readdirAsync('test-files')
      
      for (let i = 0; i < entries.length; i++) {
        fp1[entries[i]] = await fingerprintAsync(path.join('test-files', entries[i])) 
      }

      console.log('fp1', fp1)

      for (let i = 0; i < entries.length; i++) {
        fp2[entries[i]] = await fingerprintSimpleAsync(path.join('test-files', entries[i])) 
      }

      console.log('fp2', fp2)

      expect(fp1).to.deep.equal(fp2)
    })
**/
/**
    it('compare fingerprint for one-giga', async function () {
      this.timeout(0)
     
      let fp = await new Promise((resolve, reject) => {
        let fw = createFingerprintWorker('test-files/one-giga')
        fw.on('finish', () => {
          console.log(fw)
          fw.error ? reject(fw.error) : resolve(fw.data.fingerprint)
        })
      }) 

      let fpSimple = await fingerprintSimpleAsync('test-files/one-giga')

      expect(fp).to.equal(fpSimple)
    })
**/

    it('compare fingerprint for one-giga-plus-x', async function () {
      this.timeout(0)
     
      let fp = await new Promise((resolve, reject) => {
        let fw = createFingerprintWorker('test-files/one-giga-plus-x')
        fw.on('finish', () => {
          console.log(fw)
          fw.error ? reject(fw.error) : resolve(fw.data.fingerprint)
        })
      }) 

      let fpSimple = await fingerprintSimpleAsync('test-files/one-giga-plus-x')

      expect(fp).to.equal(fpSimple)
    })


  }) 
})



