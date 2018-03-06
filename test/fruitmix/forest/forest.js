const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const expect = chai.expect
const should = chai.should()

const Forest = require('src/fruitmix/forest/forest')
const { readXstatAsync, forceDriveXstatAsync } = require('src/fruitmix/file/xstat')

const cwd = process.cwd()
const rootPath = path.join(cwd, 'tmptest')
const tmpDir = path.join(rootPath, 'tmp')
const drivesDir = path.join(rootPath, 'drives')

const drive1 = {
  uuid: 'c4713fb1-ffee-4015-88f1-dcd6ca928e2b',
  owner: '202e0466-a126-41cc-ac86-f62f89b1ad80'
}

describe(path.basename(__filename), () => {

  describe('create drive 1 with /hello/world/foo/bar (all directories)', () => {

    let mtime

    beforeEach(async () => {
      await rimrafAsync(rootPath)
      await mkdirpAsync(tmpDir)
      await mkdirpAsync(drivesDir)
      await mkdirpAsync(path.join(drivesDir, drive1.uuid, 'hello', 'world', 'foo', 'bar'))
      mtime = (await fs.lstatAsync(path.join(drivesDir, drive1.uuid))).mtime.getTime()
      await Forest.initAsync(drivesDir, tmpDir)
    })

    it('create drive1 and assert instantly', async () => {
      await Forest.createDriveAsync(drive1)
/**
      expect(Forest.roots).to.deep.equal([{
        ctx: Forest,
        paused: false,
        parent: null,
        children: [],
        uuid: drive1.uuid,
        name: drive1.uuid,
        mtime: mtime,
        reader: null,
        queue: [],
        pending: false,
        timer: -1,
      }])
**/
      // wait for scan done
      await Promise.delay(100)
    })
/**
    it('create drive1 and assert until scan done', done => {
      Forest.createDriveAsync(drive1, () => {
        try {
          expect(Forest.uuidMap.size).to.equal(5)
          done()
        }
        catch(e) {
          done(e)
        }
      }).then(x => x, x => x)
    })
**/
  })
})
