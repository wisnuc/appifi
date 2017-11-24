const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const xattr = require('fs-xattr')

const chai = require('chai')
const expect = chai.expect

const MediaMap = require('src/media/map')
const VFS = require('src/vfs/vfs')

const xcopy = require('src/tasks/xcopy')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const rootUUID = '5c3571f7-c057-41e8-a4cb-489c5c3e2022' 


/**
tmptest
└── drives
    └── 5c3571f7-c057-41e8-a4cb-489c5c3e2022
        └── a
            └── b
                ├── c
                │   └── d
                │       └── e
                └── f
                    └── g
                        └── h

*/
const dirAPath = path.join(tmptest, 'drives', rootUUID, 'a')
const dirBPath = path.join(tmptest, 'drives', rootUUID, 'a', 'b')
const dirCPath = path.join(tmptest, 'drives', rootUUID, 'a', 'b', 'c')
const dirDPath = path.join(tmptest, 'drives', rootUUID, 'a', 'b', 'c', 'd')
const dirEPath = path.join(tmptest, 'drives', rootUUID, 'a', 'b', 'c', 'd', 'e')
const dirFPath = path.join(tmptest, 'drives', rootUUID, 'a', 'b', 'f') 
const dirGPath = path.join(tmptest, 'drives', rootUUID, 'a', 'b', 'f', 'g') 
const dirHPath = path.join(tmptest, 'drives', rootUUID, 'a', 'b', 'f', 'g', 'h')

describe(path.basename(__filename) + ' dirs', () => {

  let vfs, mm
  let linear1 = '5c3571f7-c057-41e8-a4cb-489c5c3e2022,a,b,c,d,e,f,g,h'
  let linear2 = '5c3571f7-c057-41e8-a4cb-489c5c3e2022,a,b,f,g,h,c,d,e'

  beforeEach(done => {
    rimraf(tmptest, err => {
      if (err) return done(err)
      mkdirp(dirEPath, err => {
        if (err) return done(err)
        mkdirp(dirHPath, err => {
          mm = new MediaMap() 
          vfs = new VFS(tmptest, mm)
          vfs.createRoot(rootUUID, (err, root) => {
            vfs.once('DirReadDone', () => {
              console.log('DirReadDone')
              let linear = root.linearize().map(n => n.name).join(',')
              expect(linear === linear1 || linear === linear2).to.be.true
              done()
            })
          })
        })
      })
    })
  })

  it('copy g (ent) in f (src) to e (dst), 6dde5e29', done => {

    let dirE = vfs.findDirByName('e')
    let dirF = vfs.findDirByName('f')
    let dirG = vfs.findDirByName('g')

    let src = {
      drive: rootUUID,
      dir: dirF.uuid,
    }

    let dst = {
      drive: rootUUID,
      dir: dirE.uuid 
    }

    let entries = [dirG.uuid] 

    xcopy(vfs, null, 'copy', null, src, dst, entries, (err, xc) => {
    // xcopy(vfs, src, dst, entries, (err, xc) => {
      if (err) return done(err)
      expect(xc.srcDriveUUID).to.equal(src.drive)
      expect(xc.dstDriveUUID).to.equal(dst.drive)

      xc.once('stopped', () => {
        done()
      })

    })
  })

})

/**

tmptest
├── drives
│   └── 5c3571f7-c057-41e8-a4cb-489c5c3e2022
│       └── a
│           └── b
│               ├── alonzo1
│               ├── c
│               │   └── d
│               │       └── e
│               └── f
│                   ├── alonzo2
│                   └── g
│                       ├── alonzo3
│                       └── h
│                           └── alonzo4
├── export
├── import
│   ├── alonzo11
│   └── x
│       ├── alonzo12
│       └── y
│           ├── alonzo13
│           └── z
│               └── alonzo14
└── tmp

*/

describe(path.basename(__filename) + ' files', () => {

  let vfs, mm

  let importDirPath = path.join(tmptest, 'import')
  let exportDirPath = path.join(tmptest, 'export')

  beforeEach(done => {
    rimraf.sync(tmptest)
    mkdirp.sync(dirEPath)
    mkdirp.sync(dirHPath)
    mkdirp.sync(path.join(importDirPath, 'x', 'y', 'z'))
    mkdirp.sync(exportDirPath)

    fs.copyFileSync('testdata/alonzo_church.jpg', path.join(dirBPath, 'alonzo1'))
    fs.copyFileSync('testdata/alonzo_church.jpg', path.join(dirFPath, 'alonzo2'))
    fs.copyFileSync('testdata/alonzo_church.jpg', path.join(dirGPath, 'alonzo3'))
    fs.copyFileSync('testdata/alonzo_church.jpg', path.join(dirHPath, 'alonzo4'))

    fs.copyFileSync('testdata/alonzo_church.jpg', path.join(importDirPath, 'alonzo11'))
    fs.copyFileSync('testdata/alonzo_church.jpg', path.join(importDirPath, 'x', 'alonzo12'))
    fs.copyFileSync('testdata/alonzo_church.jpg', path.join(importDirPath, 'x', 'y', 'alonzo13'))
    fs.copyFileSync('testdata/alonzo_church.jpg', path.join(importDirPath, 'x', 'y', 'z', 'alonzo14'))

    mm = new MediaMap() 
    vfs = new VFS(tmptest, mm)
    vfs.createRoot(rootUUID, (err, root) => vfs.once('DirReadDone', done))
  })

  // for viewing setup
  it('do nothing, d7119a6f', done => done())

  it('copy alonzo2 and dir g (ent) in dir f (src) into dir e (dst), ae8b4e34', done => {
    let dirE = vfs.findDirByName('e')
    let dirF = vfs.findDirByName('f')
    let fileAlonzo2 = dirF.children.find(f => f.name === 'alonzo2')
    let dirG = vfs.findDirByName('g')

    let src = {
      drive: rootUUID,
      dir: dirF.uuid,
    }

    let dst = {
      drive: rootUUID,
      dir: dirE.uuid 
    }

    let entries = [fileAlonzo2.uuid, dirG.uuid] 

    xcopy(vfs, null, 'copy', null, src, dst, entries, (err, xc) => { 
      if (err) return done(err)
      expect(xc.srcDriveUUID).to.equal(src.drive)
      expect(xc.dstDriveUUID).to.equal(dst.drive)
      xc.on('stopped', () => {
        console.log(xc.view())
        done()
      })
    })
  })

  it('move alonzo2 and dir g (ent) in dir f (src) to dir e (dst), b62f616a', done => {
    let dirE = vfs.findDirByName('e')
    let dirF = vfs.findDirByName('f')
    let fileAlonzo2 = dirF.children.find(f => f.name === 'alonzo2')
    let dirG = vfs.findDirByName('g')

    let src = {
      drive: rootUUID,
      dir: dirF.uuid,
    }

    let dst = {
      drive: rootUUID,
      dir: dirE.uuid 
    }

    let entries = [fileAlonzo2.uuid, dirG.uuid] 

    xcopy(vfs, null, 'move', null, src, dst, entries, (err, xc) => { 
      if (err) return done(err)
      expect(xc.srcDriveUUID).to.equal(src.drive)
      expect(xc.dstDriveUUID).to.equal(dst.drive)
      xc.on('stopped', () => {
        console.log(xc.view())
        done()
      })
    })
  }) 

  it('export alonzo2 and dir g (ent) in dir f (src) to dir export, 4ef7e76c', done => {
    let dirE = vfs.findDirByName('e')
    let dirF = vfs.findDirByName('f')
    let fileAlonzo2 = dirF.children.find(f => f.name === 'alonzo2')
    let dirG = vfs.findDirByName('g')

    let src = {
      drive: rootUUID,
      dir: dirF.uuid,
    }

    let dst = {
      path: exportDirPath,
    }

    // let entries = [fileAlonzo2.uuid, dirG.uuid] 
    let entries = [fileAlonzo2.uuid, dirG.uuid]

    xcopy(vfs, null, 'export', null, src, dst, entries, (err, xc) => {
      if (err) return done(err)
      
      xc.on('stopped', () => {
        console.log(xc.view())
        done()
      })
    })
  })  
})

// root
//  a
//    c (from dir)
//  b
//    c (to dir)
describe(path.basename(__filename) + ', cp dir on dir conflict', () => {

  let mm, vfs, dirA, dirB, dirAC, dirBC, xc

  beforeEach(done => {
    rimraf.sync(tmptest)
    mkdirp.sync(path.join(tmptest, 'drives', rootUUID, 'a', 'c'))
    mkdirp.sync(path.join(tmptest, 'drives', rootUUID, 'b', 'c'))

    mm = new MediaMap()
    vfs = new VFS(tmptest, mm)
  
    vfs.createRoot(rootUUID, (err, root) => {
      vfs.once('DirReadDone', () => {
        dirA = vfs.findDirByName('a')
        dirB = vfs.findDirByName('b')
        dirAC = vfs.findDirByName('c', 'a')
        dirBC = vfs.findDirByName('c', 'b')

        let src = { drive: rootUUID, dir: dirA.uuid }
        let dst = { drive: rootUUID, dir: dirB.uuid }
        let entries = [dirAC.uuid]

        xcopy(vfs, null, 'copy', src, dst, entries, (err, _xc) => {
        // xcopy(vfs, src, dst, entries, (err, _xc) => {
          if (err) done(err)
          xc = _xc
          done()
        })
      })
    })
  })

  it('stopped with a @ Read and a/c @ Conflict, cf35240f', done => {
    xc.on('stopped', () => {
      // a is in read
      let xs = Array.from(xc.readDirs)
      expect(xs.length).to.equal(1)
      expect(xs[0].srcUUID).to.equal(dirA.uuid)
      expect(xs[0].dstUUID).to.equal(dirB.uuid)
      expect(xs[0].state.constructor.name).to.equal('Read') 
      
      // a/c is in conflict
      let ys = Array.from(xc.conflictDirs)
      expect(ys.length).to.equal(1)
      expect(ys[0].srcUUID).to.equal(dirAC.uuid)
      expect(ys[0].state.constructor.name).to.equal('Conflict')

      console.log(xc.view())
      done()
    })
  })

  it('update a/c with same,skip should resolve conflict, a6a94864', done => {
    xc.once('stopped', () => {

      xc.setPolicy(dirAC.uuid, 'same', 'skip', false)

      xc.once('stopped', () => {
        expect(xc.readDirs.size).to.equal(0)
        expect(xc.conflictDirs.size).to.equal(0)
        expect(xc.root.state.constructor.name).to.equal('Finished')
        done()
      })
    })
  })

  it('update a/c with same,replace should resolve conflict, 6817775f', done => {
    xc.once('stopped', () => {
      xc.update(dirAC.uuid, {
        dir: { policy: 'rename' }
      }) 

      xc.once('stopped', () => {
        expect(xc.readDirs.size).to.equal(0)
        expect(xc.conflictDirs.size).to.equal(0)
        expect(xc.root.state.constructor.name).to.equal('Finished')
        done()
      })
    })
  })

  it('update a with rename should NOT resolve conflict, e766cc6c', done => {
    xc.once('stopped', () => {
      xc.update(dirA.uuid, {
        dir: { policy: 'parents' }
      }) 

      xc.reqSched()
      xc.once('stopped', () => {
        // a is in read
        let xs = Array.from(xc.readDirs)
        expect(xs.length).to.equal(1)
        expect(xs[0].srcUUID).to.equal(dirA.uuid)
        expect(xs[0].dstUUID).to.equal(dirB.uuid)
        expect(xs[0].state.constructor.name).to.equal('Read') 
        
        // a/c is in conflict
        let ys = Array.from(xc.conflictDirs)
        expect(ys.length).to.equal(1)
        expect(ys[0].srcUUID).to.equal(dirAC.uuid)
        expect(ys[0].state.constructor.name).to.equal('Conflict')
        done()
      })
    })
  })

  it('update a with rename,recursive should resolve conflict, c215608a', done => {
    xc.once('stopped', () => {
      xc.update(dirAC.uuid, {
        dir: { policy: 'rename' }
      }) 

      xc.once('stopped', () => {
        expect(xc.readDirs.size).to.equal(0)
        expect(xc.conflictDirs.size).to.equal(0)
        expect(xc.root.state.constructor.name).to.equal('Finished')
        done()
      })
    })
  })

  it('update a/c with skip should resolve conflict, 7422531c', done => {
    xc.once('stopped', () => {
      xc.update(dirAC.uuid, {
        dir: { policy: 'skip' }
      }) 

      xc.once('stopped', () => {
        expect(xc.readDirs.size).to.equal(0)
        expect(xc.conflictDirs.size).to.equal(0)
        expect(xc.root.state.constructor.name).to.equal('Finished')
        done()
      })
    })
  })

  it('update a with skip should NOT resolve conflict, 619b1e40', done => {
    xc.once('stopped', () => {
      xc.update(dirA.uuid, {
        dir: { policy: 'skip' }
      }) 

      xc.reqSched()
      xc.once('stopped', () => {
        // a is in read
        let xs = Array.from(xc.readDirs)
        expect(xs.length).to.equal(1)
        expect(xs[0].srcUUID).to.equal(dirA.uuid)
        expect(xs[0].dstUUID).to.equal(dirB.uuid)
        expect(xs[0].state.constructor.name).to.equal('Read') 
        
        // a/c is in conflict
        let ys = Array.from(xc.conflictDirs)
        expect(ys.length).to.equal(1)
        expect(ys[0].srcUUID).to.equal(dirAC.uuid)
        expect(ys[0].state.constructor.name).to.equal('Conflict')
        done()
      })
    })
  })

  it('update a with skip should resolve conflict, 250937fa', done => {
    xc.once('stopped', () => {
      xc.update(dirA.uuid, {
        dir: { policy: 'skip', recursive: true }
      }) 

      xc.once('stopped', () => {
        expect(xc.readDirs.size).to.equal(0)
        expect(xc.conflictDirs.size).to.equal(0)
        expect(xc.root.state.constructor.name).to.equal('Finished')
        done()
      })
    })
  })


  it('update a/c with skip should resolve conflict, be695f08', done => {
    xc.once('stopped', () => {
      xc.update(dirAC.uuid, {
        dir: { policy: 'skip' }
      }) 

      xc.once('stopped', () => {
        expect(xc.readDirs.size).to.equal(0)
        expect(xc.conflictDirs.size).to.equal(0)
        expect(xc.root.state.constructor.name).to.equal('Finished')
        done()
      })
    })
  })

})

// root
//  a
//    c (from file)
//  b
//    c (to file)

/**
describe(path.basename(__filename) + ', cp file on file conflict', () => {

  let mm, vfs, dirA, dirB, xc

  beforeEach(done => {
    rimraf.sync(tmptest)
    mkdirp.sync(path.join(tmptest, 'drives', rootUUID, 'a'))
    mkdirp.sync(path.join(tmptest, 'drives', rootUUID, 'b'))
    fs.copyFileSync('testdata/foo', path.join(tmptest, 'drives', rootUUID, 'a', 'c'))
    fs.copyFileSync('testdata/foo', path.join(tmptest, 'drives', rootUUID, 'b', 'c'))

    mm = new MediaMap()
    vfs = new VFS(tmptest, mm)
  
    vfs.createRoot(rootUUID, (err, root) => {
      vfs.once('DirReadDone', () => {
        dirA = vfs.findDirByName('a')
        dirB = vfs.findDirByName('b')

        let src = { drive: rootUUID, dir: dirA.uuid }
        let dst = { drive: rootUUID, dir: dirB.uuid }

        let attr = JSON.parse(xattr.getSync(path.join(tmptest, 'drives', rootUUID, 'a', 'c'), 'user.fruitmix'))
        let entries = [attr.uuid]
        xcopy(vfs, src, dst, entries, (err, _xc) => {
          if (err) done(err)
          xc = _xc
          done()
        })
      })
    })
  })

  it('stopped with a @ Read and a/c @ Conflict, 3dea504f', done => {
    xc.on('stopped', () => {
     
      let xs = Array.from(xc.readDirs) 
      expect(xs.length).to.equal(1)
      expect(xs[0].srcUUID).to.equal(dirA.uuid)
      expect(xs[0].dstUUID).to.equal(dirB.uuid)
      expect(xs[0].state.constructor.name).to.equal('Read')

      let ys = Array.from(xc.conflictFiles)
      expect(ys.length).to.equal(1)
      done()
    })
  })
})

**/









