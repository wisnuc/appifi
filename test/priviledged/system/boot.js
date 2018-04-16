const Promise = require('bluebird')

const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Boot = require('src/system/Boot')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

const configuration = {
  chassis: {
    userBinding: true,
    volumeBinding: true,
    dir: path.join(tmptest, 'chassis'),
    tmpDir: path.join(tmptest, 'chassis', 'atmp')
  },
  storage: {
    fruitmixDir: 'wisnuc/fruitmix',
    volumeDir: '/run/wisnuc/volumes',
    nonVolumeDir: '/run/wisnuc/blocks',
    userProps: ['uuid', 'username' ]
  }
}

describe(path.basename(__filename), () => {

  beforeEach(async () => {
    await Promise.delay(1000)
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
  })

  it('new boot object should arrive Pending', done => {

    let opts = { configuration }
    let boot = new Boot(opts)

    boot.once('StateEntered', state => {
      expect(state).to.equal('Pending')
      // console.log(JSON.stringify(boot.storage, null, '  '))
      // console.log(boot)
      done() 
    })
  })

  it('new boot object should transit from Pending to Unavailable when bound user is set', done => {
    let opts = { configuration }
    let boot = new Boot(opts)
    boot.once('StateEntered', state => {
      expect(state).to.equal('Pending')

      boot.once('StateEntered', state => {
        expect(state).to.equal('Unavailable')
        done()
      })

      boot.setBoundUser ({
        phicommUserId: '123456',
        password: 'helleo'
      }) 
    })
  })

  it('new boot object should transit from Pending to Unavailable when bound user is set', done => {
    let opts = { configuration }
    let boot = new Boot(opts)
    boot.once('StateEntered', state => {
      expect(state).to.equal('Pending')

      boot.once('StateEntered', state => {
        expect(state).to.equal('Unavailable')
        done()
      })

      boot.setBoundUser ({
        phicommUserId: '123456',
        password: 'helleo'
      }) 
    })
  })

  it('init with sdb single, 4b24032e', function (done) {

    this.timeout(10000)

    let opts = { configuration }
    let boot = new Boot(opts)
    boot.once('StateEntered', state => {
      expect(state).to.equal('Pending')

      boot.once('StateEntered', state => {
        expect(state).to.equal('Unavailable')
        boot.init(['sdb'], 'single', err => {
          if (err) return done(err)
        })
      })

      /** avoid continuous transition **/
      setImmediate(() => 
        boot.setBoundUser ({
          phicommUserId: '123456',
          password: 'helleo'
        })) 
    })

    boot.on('StateEntered', state => {
      console.log(':: ', state)
      if (state === 'Started') done()
    })

  })





})
