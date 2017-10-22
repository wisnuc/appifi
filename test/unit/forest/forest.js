const Promise = require('bluebird')
const path = require('path')
//const fs = Promise.promisifyAll(require('fs-extra'))
const fs = Promise.promisifyAll(require('fs'))
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const expect = chai.expect
const should = chai.should()

const DriveList = require('src/forest/forest')
const Monitor = require('src/forest/monitor')
const Directory = require('src/forest/directory')
const File = require('src/forest/file')

const { FILES } = require('test/agent/lib')

const { readXstatAsync, forceDriveXstatAsync } = require('src/lib/xstat')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmpDir = path.join(tmptest, 'tmp')
const drivesDir = path.join(tmptest, 'drives')

const drive1 = {
  uuid: 'c4713fb1-ffee-4015-88f1-dcd6ca928e2b',
  owner: '202e0466-a126-41cc-ac86-f62f89b1ad80'
}

describe(path.basename(__filename), () => {

  describe('create drive 1 with /hello/world/foo/bar (all directories)', () => {

    before(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmpDir)
      await mkdirpAsync(drivesDir)
      await mkdirpAsync(path.join(drivesDir, drive1.uuid, 'hello', 'world', 'foo', 'bar'))
    })

    it('simple read, 91e11c6e', async () => {
      // use fruitmix:monitor to print monitor information
      let monitor = new Monitor()
      let mediaMap = new Map()
      let driveList = new DriveList('tmptest', mediaMap)
      driveList.createDriveAsync(drive1, [monitor])
      await monitor.done

      let obj = Array.from(driveList.uuidMap)
        .reduce((o, kv) => {
          let dir = kv[1]
          o[dir.name] = dir.parent ? dir.parent.name : null
          return o
        }, {})

      expect(obj).to.deep.equal({ 
        'c4713fb1-ffee-4015-88f1-dcd6ca928e2b': null,
        hello: 'c4713fb1-ffee-4015-88f1-dcd6ca928e2b',
        world: 'hello',
        foo: 'world',
        bar: 'foo' 
      })
    })
    
  })

  describe('single JPEG file vpai001.jpg', () => {
  
    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmpDir)
      await mkdirpAsync(path.join(drivesDir, drive1.uuid))

      let src = path.join(cwd, 'testdata', 'vpai001.jpg')
      let dst = path.join(drivesDir, drive1.uuid, 'vpai001.jpg')

      await fs.copyFileAsync(src, dst)

    })

    it('read e640de0e', done => {
      let mediaMap = new Map()
      let driveList = new DriveList(tmptest, mediaMap)
      driveList.createDrive(drive1, err => {
        if (err) return done(err)
        driveList.on('indexingDone', () => {
          console.log(driveList)
          done()
        })
      })
    })

  })

  describe('hello/word/foo/bar', () => {

    let mediaMap
    let driveList
    let { vpai001 } = FILES
 
    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmpDir)
      await mkdirpAsync(drivesDir)
      await mkdirpAsync(path.join(drivesDir, drive1.uuid, 'hello', 'world', 'foo', 'bar'))

      let monitor = new Monitor()
      mediaMap = new Map()
      driveList = new DriveList(tmptest, mediaMap)
      await driveList.createDriveAsync(drive1, [monitor])
      await monitor.done

    })

    it('put vpai001.jpg into root 4720f130', done => {
      let src = path.join(cwd, 'testdata', 'vpai001.jpg')
      let dst = path.join(drivesDir, drive1.uuid, 'vpai001.jpg')

      fs.copyFile(src, dst, err => {
        if (err) return done(err)
        
        let [ _, root] = driveList.roots[Symbol.iterator]().next().value
        driveList.on('indexingDone', () => {
          expect(root.children.length).to.equal(2)

          // assert vpai File object
          let vpai = root.children.find(c => c instanceof File)
          expect(vpai.name).to.equal('vpai001.jpg')
          expect(vpai.magic).to.equal('JPEG')
          expect(vpai.hash).to.equal(vpai001.hash) 
          expect(vpai.finger).to.be.null
          expect(vpai.fingerFail).to.equal(0)
          expect(vpai.meta).to.be.null
          expect(vpai.metaFail).to.equal(0)

          // assert meta map
          expect(driveList.metaMap.size).to.equal(1)          
          expect(driveList.metaMap.get(vpai.hash).size).to.equal(1)
          expect(driveList.metaMap.get(vpai.hash).has(vpai)).to.be.true

          done() 
        })

        root.read()
      })
    })

    it('put vpai001.jpg twice into root b7adebab', done => {
      let src = path.join(cwd, 'testdata', 'vpai001.jpg')
      let dst1 = path.join(drivesDir, drive1.uuid, 'vpai001.jpg')
      let dst2 = path.join(drivesDir, drive1.uuid, 'vpai002.jpg')

      fs.copyFile(src, dst1, err => {
        if (err) return done(err)
        fs.copyFile(src, dst2, err => {
          let [ _, root] = driveList.roots[Symbol.iterator]().next().value
          driveList.on('indexingDone', () => {
            expect(root.children.length).to.equal(3)

            // assert vpai File object
            let vpai1 = root.children.find(c => c instanceof File && c.name === 'vpai001.jpg')
            expect(vpai1.magic).to.equal('JPEG')
            expect(vpai1.hash).to.equal(vpai001.hash) 
            expect(vpai1.finger).to.be.null
            expect(vpai1.fingerFail).to.equal(0)
            expect(vpai1.meta).to.be.null
            expect(vpai1.metaFail).to.equal(0)

            let vpai2 = root.children.find(c => c instanceof File && c.name === 'vpai001.jpg')
            expect(vpai2.magic).to.equal('JPEG')
            expect(vpai2.hash).to.equal(vpai001.hash) 
            expect(vpai2.finger).to.be.null
            expect(vpai2.fingerFail).to.equal(0)
            expect(vpai2.meta).to.be.null
            expect(vpai2.metaFail).to.equal(0)

            // assert meta map
            expect(driveList.metaMap.size).to.equal(1)          
            expect(driveList.metaMap.get(vpai001.hash).size).to.equal(2)
            expect(driveList.metaMap.get(vpai001.hash).has(vpai1)).to.be.true
            expect(driveList.metaMap.get(vpai001.hash).has(vpai2)).to.be.true
            done() 
          })

          root.read()
        })
      })
    })

  })
})
