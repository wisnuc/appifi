import path from 'path'
import chai from 'chai'

const expect = chai.expect

import { rimrafAsync, mkdirpAsync, fs, xattr } from 'src/fruitmix/util/async'
import { readXstat } from 'src/fruitmix/lib/xstat'

import { createHashMagicScheduler, createWorker } from 'src/fruitmix/lib/hashMagicSched' 

const uuid1 = 'e716c067-ef4d-49da-9d32-db2a44b3b448' 

const helloHash = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'

describe(path.basename(__filename) + ': test hashMagic worker', function() {

  const TMPTEST = path.join(process.cwd(), 'tmptest')

  beforeEach(() => (async () => {
    await rimrafAsync('tmptest')
    await mkdirpAsync('tmptest/folder1')
    await fs.writeFileAsync('tmptest/file1', 'hello')
  })())

  it('should return ENOENT if target nonexist', function(done) {
    let target = path.join(TMPTEST, 'folder0')
    createWorker(target, uuid1, (err, hm) => {
      expect(err.code).to.equal('ENOENT')
      expect(hm).to.deep.equal({ uuid: uuid1, target })
      done()
    })
  })

  it('should return ENOTDIR if target is a directory', function(done) {
    let target = path.join(TMPTEST, 'folder1')
    createWorker(target, uuid1, (err, hm) => {
      expect(err.code).to.equal('ENOTDIR')
      expect(hm).to.deep.equal({ uuid: uuid1, target })
      done()
    })
  })

  it('should return correct hashmagic for file1', function(done) {
    readXstat(path.join(TMPTEST, 'file1'), (err, xstat) => {
      if (err) return done(err)

      createWorker(xstat.abspath, xstat.uuid, (err, hm) => {

        expect(hm.magic.startsWith('ASCII text,')).to.be.true
        delete hm.magic

        expect(hm).to.deep.equal({
          uuid: xstat.uuid,
          target: xstat.abspath,
          hash: helloHash,
          timestamp: xstat.mtime.getTime()
        })

        done()
      })
    })
  }) 

  it('should return EINTR and callback once if aborted', function(done) {

    let count = 0

    readXstat(path.join(TMPTEST, 'file1'), (err, xstat) => {
      if (err) return done(err)

      let abort = createWorker(xstat.abspath, xstat.uuid, (err, hm) => {
        expect(err.code).to.equal('EINTR')
        expect(hm).to.deep.equal({ uuid: xstat.uuid, target: xstat.abspath })
        count++
      })

      abort()
      setTimeout(() => {
        expect(count).to.equal(1)
        done()
      }, 300)
    })
  })
})

describe(path.basename(__filename) + ': test hashMagic scheduler', function() {

  let file1Xstat, file2Xstat, file3Xstat, file4Xstat
  const readXstatAsync = Promise.promisify(readXstat)

  const forest = {
    findNodeByUUID(uuid) {
      if (uuid === file1Xstat.uuid) {
        return {
          namepath: () => file1Xstat.abspath
        }
      }
      else if (uuid === file2Xstat.uuid) {
        return {
          namepath: () => file2Xstat.abspath
        }
      }
      else if (uuid === file3Xstat.uuid) {
        return {
          namepath: () => file3Xstat.abspath
        }
      }
      else if (uuid === file4Xstat.uuid) {
        return {
          namepath: () => file4Xstat.abspath
        }
      }
      else 
        return 
    }
  }

  beforeEach(() => (async () => {

    await rimrafAsync('tmptest')
    await mkdirpAsync('tmptest/folder1')
    await fs.writeFileAsync('tmptest/file1', 'hello')
    await fs.writeFileAsync('tmptest/file2', 'world')
    await fs.writeFileAsync('tmptest/file3', 'foo')
    await fs.writeFileAsync('tmptest/file4', 'bar')
    file1Xstat = await readXstatAsync('tmptest/file1')
    file2Xstat = await readXstatAsync('tmptest/file2')
    file3Xstat = await readXstatAsync('tmptest/file3')
    file4Xstat = await readXstatAsync('tmptest/file4')

  })())

  it('should do ...', function(done) {

    let started, error, hashmagic

    let sched = createHashMagicScheduler(forest, 1)
    sched.on('hashMagic', (err, hm) => {
      error = err
      hashmagic = hm
    })

    sched.on('hashMagicStarted', () => {
      started = true
    })

    sched.on('hashMagicStopped', () => {
      expect(started).to.be.true
      expect(error).to.be.null
      expect(hashmagic.magic.startsWith('ASCII text,')).to.be.true
      delete hashmagic.magic
      expect(hashmagic).to.deep.equal({
        uuid: file1Xstat.uuid,
        target: file1Xstat.abspath,
        hash: helloHash,
        timestamp: file1Xstat.mtime.getTime()
      })
      done()
    })
    sched.request(file1Xstat.uuid)
  })  


  it('should do ...', function(done) {

    let sched = createHashMagicScheduler(forest, 1)
    sched.on('hashMagic', (err, hm) => {
      console.log(err, hm)
    })

    sched.on('hashMagicStarted', () => {
      console.log('hashMagicStarted')
    })

    sched.on('hashMagicStopped', () => {
      console.log('hashMagicStopped')
      done()
    })

    sched.request(file1Xstat.uuid)
    sched.request(file2Xstat.uuid)
    sched.request(uuid1)
    sched.request(file3Xstat.uuid)
    sched.request(file4Xstat.uuid)
  })
})




