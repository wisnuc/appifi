const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)

const UUID = require('uuid')
const xattr = require('fs-xattr')

const chai = require('chai')
const expect = chai.expect

const MediaMap = require('src/media/map')
const Forest = require('src/vfs/forest')
const Directory = require('src/vfs/directory')
const File = require('src/vfs/file')

const Debug = require('debug')
const debug = process.env.hasOwnProperty('DEBUG') ? Debug('test') : () => {}

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

describe(path.basename(__filename), () => {

  let rootUUID = '3cc3df6b-5533-4c5b-91b8-67186eebc0ae'

  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
  })

  it('create empty root', done => {
    let mm = new MediaMap()
    let forest = new Forest(tmptest, mm) 

    forest.createRoot(rootUUID, (err, root) => {
      if (err) done(err)

      expect(root instanceof Directory)
      expect(root.ctx).to.equal(forest)
      expect(root.uuid).to.equal(rootUUID)
      expect(root.name).to.equal(rootUUID)
      expect(root.mtime < 0).to.be.true
      expect(root.state instanceof Directory.Init).to.be.true

      // root is in roots
      expect(forest.roots.get(rootUUID)).to.equal(root)

      // root is indexed
      expect(forest.uuidMap.get(rootUUID)).to.equal(root)

      // root is in initDirs
      expect(forest.initDirs.has(rootUUID)).to.be.true

      // root directory has been stamped
      let fattr = xattr.getSync(path.join(tmptest, 'drives', rootUUID), 'user.fruitmix')
      let attr = JSON.parse(fattr) 
      expect(attr).to.deep.equal({ uuid: rootUUID })

      // scheduled
      expect(forest.dirReadScheduled).to.be.true

      // run scheduler
      setImmediate(() => { 

        // root moved to readingDirs
        expect(root.state instanceof Directory.Reading).to.be.true
        expect(forest.initDirs.has(rootUUID)).to.be.false 
        expect(forest.readingDirs.has(rootUUID)).to.be.true

        // until read done
        forest.on('DirReadDone', () => {
          // root moved to idle state
          expect(root.state instanceof Directory.Idle).to.be.true
          expect(forest.readingDirs.has(rootUUID)).to.be.false
          done()
        })
      })
    })

  })

})

describe(path.basename(__filename) + ' a/b/c/d/e', () => {

  let rootUUID = '3cc3df6b-5533-4c5b-91b8-67186eebc0ae'
  let abcdePath = path.join(tmptest, 'drives', rootUUID, 'a', 'b', 'c', 'd', 'e')
  let mm, forest, rootDir

  beforeEach(done => {
    rimraf(tmptest, err => {
      if (err) return done(err)
      mkdirp(abcdePath, err => {
        if (err) return done(err)
        mm = new MediaMap()
        forest = new Forest(tmptest, mm)
        forest.createRoot(rootUUID, (err, root) => {
          if (err) done(err)
          forest.once('DirReadDone', () => {
            rootDir = root
            expect(rootDir.linearize().map(n => n.name)).to.deep.equal([rootUUID, 'a', 'b', 'c', 'd', 'e'])
            debug('==== end of beforeEach ====')
            done()
          })
        })
      })
    })
  })

  it('delete e then read d', done => {
    let dirD = forest.findDirByName('d')
    if (!dirD) return done(new Error('dir d not found'))

    let dirE = forest.findDirByName('e')
    if (!dirE) return done(new Error('dir e not found'))

    rimraf.sync(dirE.abspath())
    dirD.read()

    forest.once('DirReadDone', () => {
      expect(rootDir.linearize().map(n => n.name)).to.deep.equal([rootUUID, 'a', 'b', 'c', 'd'])
      expect(dirE.linearize().map(n => n.name)).to.deep.equal(['e'])
      expect(dirE.isDetached())
      done()
    })
  }) // end of it

  it('delete d then read c', done => {
    let dirC = forest.findDirByName('c')
    if (!dirC) return done(new Error('dir c not found'))

    let dirD = forest.findDirByName('d')
    if (!dirD) return done(new Error('dir d not found'))

    rimraf.sync(dirD.abspath())
    dirC.read()

    forest.once('DirReadDone', () => {
      expect(rootDir.linearize().map(n => n.name)).to.deep.equal([rootUUID, 'a', 'b', 'c'])
      expect(dirD.linearize().map(n => n.name)).to.deep.equal(['d', 'e'])
      expect(dirD.isDetached())
      done()
    })
  }) // end of it

  it('delete d then reading d', done => {
    let dirD = forest.findDirByName('d')
    rimraf.sync(dirD.abspath()) 
    dirD.read()

    forest.once('DirReadDone', () => {
      expect(rootDir.linearize().map(n => n.name)).to.deep.equal([rootUUID, 'a', 'b', 'c'])
      done()
    })
  })

  it('delete d then reading e', done => {
    let dirC = forest.findDirByName('c')
    if (!dirC) return done(new Error('dir c not found'))

    let dirD = forest.findDirByName('d')
    if (!dirD) return done(new Error('dir d not found'))

    let dirE = forest.findDirByName('e')
    if (!dirE) return done(new Error('dir e not found'))

    rimraf.sync(dirD.abspath()) 
    dirE.read()

    forest.once('DirReadDone', () => {
      expect(rootDir.linearize().map(n => n.name)).to.deep.equal([rootUUID, 'a', 'b', 'c'])
      done()
    })
  })


  it('rename d then read c', done => {
    let dirC = forest.findDirByName('c')
    if (!dirC) return done(new Error('dir c not found'))

    let dirD = forest.findDirByName('d')
    if (!dirD) return done(new Error('dir d not found'))

    fs.renameSync(dirD.abspath(), path.join(dirC.abspath(), 'h'))
    dirC.read()

    forest.once('DirReadDone', () => {
      expect(rootDir.linearize().map(n => n.name)).to.deep.equal([rootUUID, 'a', 'b', 'c', 'h', 'e'])
      done() 
    })
  })

  it('rename d then read d', done => {
    let dirC = forest.findDirByName('c')
    if (!dirC) return done(new Error('dir c not found'))

    let dirD = forest.findDirByName('d')
    if (!dirD) return done(new Error('dir d not found'))

    fs.renameSync(dirD.abspath(), path.join(dirC.abspath(), 'h'))
    dirD.read()

    forest.once('DirReadDone', () => {
      expect(rootDir.linearize().map(n => n.name)).to.deep.equal([rootUUID, 'a', 'b', 'c', 'h', 'e'])
      done() 
    })
  })

  it('rename d then read e', done => {
    let dirC = forest.findDirByName('c')
    if (!dirC) return done(new Error('dir c not found'))

    let dirD = forest.findDirByName('d')
    if (!dirD) return done(new Error('dir d not found'))

    let dirE = forest.findDirByName('e')
    if (!dirE) return done(new Error('dir e not found'))

    fs.renameSync(dirD.abspath(), path.join(dirC.abspath(), 'h'))
    dirE.read()

    forest.once('DirReadDone', () => {
      expect(rootDir.linearize().map(n => n.name)).to.deep.equal([rootUUID, 'a', 'b', 'c', 'h', 'e'])
      done() 
    })
  })

})


