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

//    let mtime

    before(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmpDir)
      await mkdirpAsync(drivesDir)
      await mkdirpAsync(path.join(drivesDir, drive1.uuid, 'hello', 'world', 'foo', 'bar'))
//      mtime = (await fs.lstatAsync(path.join(drivesDir, drive1.uuid))).mtime.getTime()
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

  describe('single JPEG file vpai001.jpg, e640de0e', () => {
  
    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmpDir)
      await mkdirpAsync(path.join(drivesDir, drive1.uuid))

      let src = path.join(cwd, 'testdata', 'vpai001.jpg')
      let dst = path.join(drivesDir, drive1.uuid, 'vpai001.jpg')

      await fs.copyFileAsync(src, dst)

    })

    it('read', async () => {
      let monitor = new Monitor()
      let mediaMap = new Map()
      let driveList = new DriveList(tmptest, mediaMap)
      driveList.createDriveAsync(drive1, [monitor])
      await monitor.done

      await Promise.delay(500)
      console.log(mediaMap)
      // console.log(Forest)
      // console.log(metamap)
      return
    })
  })
})
