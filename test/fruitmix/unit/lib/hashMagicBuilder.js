import path from 'path'
import EventEmitter from 'events'

import chai from 'chai'

const expect = chai.expect

import { rimrafAsync, mkdirpAsync, fs, xattr } from 'src/fruitmix/util/async'
import { readXstat } from 'src/fruitmix/lib/xstat'

import { createHashMagicBuilder, createWorker } from 'src/fruitmix/lib/hashMagicBuilder' 

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
    createWorker(target, uuid1, err => {
      expect(err.code).to.equal('ENOENT')
      done()
    })
  })

  it('should return EISTDIR if target is a directory', function(done) {
    let target = path.join(TMPTEST, 'folder1')
    createWorker(target, uuid1, (err, hm) => {
      expect(err.code).to.equal('EISDIR')
      done()
    })
  })

  it('should return xstat for file1', function(done) {

    readXstat(path.join(TMPTEST, 'file1'), (err, xstat) => {
      if (err) return done(err)

      createWorker(xstat.abspath, xstat.uuid, (err, xstat2) => {
        expect(xstat2.magic.startsWith('ASCII text,')).to.be.true
        expect(xstat2.hash).to.equal(helloHash)
        expect(xstat2.htime).to.equal(xstat.mtime.getTime())
        done()
      })
    })
  }) 

  it('should return EABORT and callback once if aborted', function(done) {

    readXstat(path.join(TMPTEST, 'file1'), (err, xstat) => {
      if (err) return done(err)

      let abort = createWorker(xstat.abspath, xstat.uuid, (err, hm) => {
        expect(err.code).to.equal('EABORT')
        done()
      })

      abort()
    })
  })
})

describe(path.basename(__filename) + ': test hashMagic scheduler', function() {

  let file1Xstat, file2Xstat, file3Xstat, file4Xstat
  const readXstatAsync = Promise.promisify(readXstat)

  class Forest extends EventEmitter {

    constructor() {
      super()
    }

    findNodeByUUID(uuid) {
      if (uuid === file1Xstat.uuid) {
        return {
          uuid: file1Xstat.uuid,
          namepath: () => file1Xstat.abspath
        }
      }
      else if (uuid === file2Xstat.uuid) {
        return {
          uuid: file2Xstat.uuid,
          namepath: () => file2Xstat.abspath
        }
      }
      else if (uuid === file3Xstat.uuid) {
        return {
          uuid: file3Xstat.uuid,
          namepath: () => file3Xstat.abspath
        }
      }
      else if (uuid === file4Xstat.uuid) {
        return {
          uuid: file4Xstat.uuid,
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

    let onceStarted
    let xstatToUpdate
    let forest = new Forest()
    forest.updateFileNode = (xstat) => xstatToUpdate = xstat

    let builder = createHashMagicBuilder(forest, 1)
    builder.on('hashMagicBuilderStarted', () => {
      onceStarted = true
    })

    builder.on('hashMagicBuilderStopped', () => {

      readXstat(file1Xstat.abspath, (err, xst) => {

        expect(onceStarted).to.be.true

        expect(xst.hash).to.equal(helloHash)
        expect(xst.magic.startsWith('ASCII text,')).to.be.true
        expect(xst.htime).to.equal(file1Xstat.mtime.getTime())

        expect(xstatToUpdate.hash).to.equal(xst.hash)
        expect(xstatToUpdate.magic).to.equal(xst.magic)
        expect(xstatToUpdate.htime).to.equal(xst.htime)

        done()
      })
    })

    forest.emit('hashless', {
      uuid: file1Xstat.uuid,
      namepath: () => file1Xstat.abspath 
    })
  })  

  it('should do ...', function(done) {

    let forest = new Forest()
    forest.updateFileNode = (xstat) => {} // console.log(xstat)

    let builder = createHashMagicBuilder(forest, 2)
    builder.on('hashMagicBuilderStarted', () => {
      console.log('hashMagicBuilderStarted')
    })

    builder.on('hashMagicBuilderStopped', () => {
      console.log('hashMagicBuilderStopped')
      done()
    })

    forest.emit('hashless', {
      uuid: file1Xstat.uuid,
      namepath: () => file1Xstat.abspath
    })

    forest.emit('hashless', {
      uuid: file2Xstat.uuid,
      namepath: () => file2Xstat.abspath
    })

    forest.emit('hashless', {
      uuid: file3Xstat.uuid,
      namepath: () => file3Xstat.abspath
    })

    forest.emit('hashless', {
      uuid: file4Xstat.uuid,
      namepath: () => file4Xstat.abspath
    })

  })
})




