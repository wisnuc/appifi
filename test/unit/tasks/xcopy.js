const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

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

    xcopy(vfs, src, dst, entries, (err, xc) => {
      if (err) return done(err)
      expect(xc.srcDriveUUID).to.equal(src.drive)
      expect(xc.dstDriveUUID).to.equal(dst.drive)

      xc.on('finish', () => {
        done()
      })

    })
  })
 
})

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
describe(path.basename(__filename) + ' files', () => {

  let vfs, mm
  let linear1 = '5c3571f7-c057-41e8-a4cb-489c5c3e2022,a,b,c,d,e,f,g,h'
  let linear2 = '5c3571f7-c057-41e8-a4cb-489c5c3e2022,a,b,f,g,h,c,d,e'

  beforeEach(done => {
    rimraf(tmptest, err => {
      if (err) return done(err)
      mkdirp(dirEPath, err => {
        if (err) return done(err)
        mkdirp(dirHPath, err => {

          fs.copyFileSync('testdata/alonzo_church.jpg', path.join(dirBPath, 'alonzo1'))
          fs.copyFileSync('testdata/alonzo_church.jpg', path.join(dirFPath, 'alonzo2'))
          fs.copyFileSync('testdata/alonzo_church.jpg', path.join(dirGPath, 'alonzo3'))
          fs.copyFileSync('testdata/alonzo_church.jpg', path.join(dirHPath, 'alonzo4'))

          mm = new MediaMap() 
          vfs = new VFS(tmptest, mm)
          vfs.createRoot(rootUUID, (err, root) => {
            vfs.once('DirReadDone', () => {

              let linear = root.linearize().map(n => n.name).join(',')
              let linear1p = linear1 + ',alonzo4,alonzo3,alonzo2,alonzo1'
              let linear2p = linear2 + ',alonzo4,alonzo3,alonzo2,alonzo1'
              let linear3p = '5c3571f7-c057-41e8-a4cb-489c5c3e2022,a,b,f,g,h,alonzo4,alonzo3,alonzo2,c,d,e,alonzo1'

              if (linear !== linear1p && linear !== linear2p && linear !== linear3p)
                console.log(linear)

              expect(linear === linear1p || linear === linear2p).to.be.true
              done()
            })
          })
        })
      })
    })
  })

  it('copy g (ent) in f (src) to e (dst), ae8b4e34', done => {

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

    xcopy(vfs, src, dst, entries, (err, xc) => {
      if (err) return done(err)
      expect(xc.srcDriveUUID).to.equal(src.drive)
      expect(xc.dstDriveUUID).to.equal(dst.drive)

      xc.on('finish', () => {
        done()
      })

    })
  })
 
})


