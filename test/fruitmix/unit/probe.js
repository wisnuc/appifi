const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const chai = require('chai')
const expect = chai.expect

const Probe = require('src/fruitmix/worker/probe')
const { readXstatAsync, forceDriveXstatAsync } = require('src/fruitmix/file/xstat')

const cwd = process.cwd()
const rootPath = path.join(cwd, 'tmptest')
const rootUUID = '7a06167b-1ec0-41d7-9f92-8b1fc7682711'

describe(path.basename(__filename), () => {

  describe('probing root (tmptest/hello)', () => {

    let root, hello
    let helloUUID, helloPath = path.join(rootPath, 'hello')

    beforeEach(async () => {
      await rimrafAsync(rootPath)
      await mkdirpAsync(helloPath)
      root = await forceDriveXstatAsync(rootPath, rootUUID)
      hello = await readXstatAsync(helloPath)
    })

    it('should return null if mtime matches', done => {

      let probe = Probe(rootPath, rootUUID, root.mtime, 1)
      probe.on('error', e => done(e))
      probe.on('finish', props => {
        expect(props).to.be.null
        done()
      })
      probe.start()
    })

    it('should return {mtime, [hello.xstat]} if mtime mismatches', done => {

      let probe = Probe(rootPath, rootUUID, root.mtime - 1, 1)
      probe.on('error', e => done(e))
      probe.on('finish', props => {
        try {
          expect(props).to.deep.equal({
            mtime: root.mtime,
            xstats: [ hello ]
          })
          done()
        }
        catch (e) {
          done(e)
        }
      })
      probe.start()
    })
  })
})
