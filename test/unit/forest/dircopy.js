const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const child = require('child_process')

const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))

const DirCopy = require('src/forest/dircopy')

const cwd = process.cwd()
const srcDir = path.join(cwd, 'testdata')
const tmptest = path.join(cwd, 'tmptest')
const tmpDir = path.join(cwd, 'tmptest', 'tmp')
const dstDir = path.join(cwd, 'tmptest', 'dst')

describe(path.basename(__filename), () => {

  describe('hello world', () => {

    beforeEach(async () => {
      await rimrafAsync(tmptest) 
      await mkdirpAsync(tmpDir)
      await mkdirpAsync(dstDir)
    })

    it('should do nothing', function (done) {

      this.timeout(0)

      const files = fs.readdirSync(srcDir).filter(x => x !== '.git')
      const getDirPath = () => dstDir

      console.log(files)

      let dc = new DirCopy(srcDir, tmpDir, files, getDirPath)
      
      dc.on('stopped', () => done())
    }) 
  })
})
