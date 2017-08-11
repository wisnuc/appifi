const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirpAsync = Promise.promisify(mkdirp)

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

const DirImport = require('src/tasks/dirimport')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const src = path.join(cwd, 'testdata')
const tmp = path.join(tmptest, 'tmp')
const dst = path.join(tmptest, 'dst')


describe(path.basename(__filename), () => {
  describe('dirimport', () => {
    beforeEach(async () => {
      await rimrafAsync(tmptest)  
      await mkdirpAsync(tmp)
      await mkdirpAsync(dst)
    })

    it('should do nothing', done => {

      let di = new DirImport({ src, tmp, dst, files: ['vpai001.jpg'] })
     
      di.on('stopped', data => {
        done()
      }) 
    })
  })
})
