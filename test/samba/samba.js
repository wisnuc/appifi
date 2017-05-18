const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const sinon = require('sinon')

const { expect } = require('chai')

const SambaManager = require('../../../../src/samba/sambaManager.js')

const rimrafAsync = Promise.promisify(rimraf)
const mkdirpAsync = Promise.promisify(mkdirp)

Promise.promisifyAll(fs)

const cwd = process.cwd()
const tmpdir = path.join(cwd, 'tmptest')
const pfile = path.join(tmpdir, 'persistence')
const testData = 'only for testing!'
// const testData2 = { foo: 'bar' }

describe(path.basename(__filename), () => {

  beforeEach(async () => {
    await rimrafAsync(tmpdir)
    await mkdirpAsync(tmpdir)
  })

  it('should create a SambaManager', async () => {
    let result = await SambaManager(1000)
    expect(result.delay).to.equal(1000)
  })

  // it('should not save data before delay', async () => {

  //   let p = await createPersistenceAsync(pfile, tmpdir, 50)
  //   p.save(testData)

  //   await Promise.delay(25)

  //   let err
  //   try {
  //     let readback = await fs.readFileAsync(pfile)
  //   }
  //   catch(e) {
  //     err = e
  //   }
  //   expect(err.code).to.equal('ENOENT')
  // })

  // it('should save data after delay', async () => {

  //   let p = await createPersistenceAsync(pfile, tmpdir, 25) 
  //   p.save(testData)
    
  //   await Promise.delay(50)

  //   let readback = await fs.readFileAsync(pfile)
  //   let data = JSON.parse(readback)
  //   expect(data).to.deep.equal(testData)
  // })

  // it('should save twice if save requested during saving', async () => {

  //   let p = await createPersistenceAsync(pfile, tmpdir, 25)
  //   p.save(testData)

  //   const fsrename = fs.rename
  //   sinon.stub(fs, 'rename', (src, dst, callback) => 
  //     setTimeout(() => fsrename(src, dst, callback), 100))    

  //   await Promise.delay(50)
  //   p.save(testData2) 

  //   await Promise.delay(200)

  //   let readback = await fs.readFileAsync(pfile)
  //   let data = JSON.parse(readback)
  //   expect(data).to.deep.equal(testData2)

  //   fs.rename.restore()
  // })
})