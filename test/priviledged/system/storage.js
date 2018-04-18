const Promise = require('bluebird')
const path = require('path')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const { probeAsync, mkfsBtrfsAsync } = require('src/system/storage')

const wisnucConfigs = {
  volumeDir: '/run/wisnuc/volumes',
  nonVolumeDir: '/run/wisnuc/blocks',
   
  fruitmixDir: 'wisnuc/fruitmix',
  userProps: [
    'uuid',
    'username',
    'isFirstUser',
    'isAdmin',
    'avatar',
    'global'
  ]
}

describe(path.basename(__filename), () => {

  describe('probe', () => {
    it('should probe storage of current system', async () => {
      let storage = await probeAsync(wisnucConfigs)
      console.log(JSON.stringify(storage, null, '  '))
    }) 
  })

  describe('mkfsBtrfs', () => {
    beforeEach(async function () { 
      this.timeout(10000)

      

      await Promise.delay(1000)
    })

    it('should mkfs single for sdb and sdc', async function () {
      this.timeout(10000)
      await mkfsBtrfsAsync(wisnucConfigs, { mode: 'single', target: ['sdb', 'sdc'] })
      
    })

    it('should mkfs raid1 for sdb and sdc', async function () {
      this.timeout(10000)
      let uuid = await mkfsBtrfsAsync(wisnucConfigs, { mode: 'single', target: ['sdb', 'sdc'] })
      console.log(uuid) 
    })
  })
})
