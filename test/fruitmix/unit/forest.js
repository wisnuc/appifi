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
const Monitor = require('src/fruitmix/forest/monitor')

const { readXstatAsync, forceDriveXstatAsync } = require('src/fruitmix/lib/xstat')

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
      await Forest.init(drivesDir, tmpDir)
    })

    it('read', async () => {

      let monitor = new Monitor()
      await Forest.createDriveAsync(drive1, [monitor])
      await monitor.done
      r = Forest.getDriveDirs(drive1.uuid)
      console.log(r)
    })

    
  })
})
