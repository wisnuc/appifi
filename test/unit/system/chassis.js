const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Chassis = require('src/system/Chassis')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

describe(path.basename(__filename), () => {
  describe('phicomm', () => {
    let opts = {
      type: 'PHICOMM',
      dir: tmptest
    }

    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmptest)
    })

    it('should enter idle if volume file does not exist', done => {
      let chassis = new Chassis(opts)
      chassis.on('Entered', state => {
        if (state === 'Idle') {
          chassis.removeAllListeners()
          expect(chassis.volumeUUID).to.be.undefined
          expect(chassis.queue).to.deep.equal([])
          done()
        }
      })
    }) 

    it('should enter idle with volumeUUID loaded, 45f6a864', done => {
      let uuid = '881a0aab-e772-478d-8849-853ce196298e'
      let filePath = path.join(tmptest, 'volume')
      fs.writeFile(filePath, uuid, err => {
        if (err) return done(err)
        let chassis = new Chassis(opts)
        chassis.on('Entered', state => {
          if (state === 'Idle') {
            chassis.removeAllListeners()
            expect(chassis.volumeUUID).to.equal(uuid)
            expect(chassis.queue).to.deep.equal([])
            done()
          }
        })
      })
    }) 

    it('should enter idle with invalid volume uuid', done => {
      let uuid = 'alice'
      let filePath = path.join(tmptest, 'volume')
      fs.writeFile(filePath, uuid, err => {
        if (err) return done(err)
        let chassis = new Chassis(opts)
        chassis.on('Entered', state => {
          if (state === 'Idle') {
            chassis.removeAllListeners()
            expect(chassis.volumeUUID).to.be.undefined
            expect(chassis.queue).to.deep.equal([])
            done()
          }
        })
      })
    }) 

    it('should enter failed if volume file is a dir', done => {
      mkdirp(path.join(tmptest, 'volume'), err => {
        if (err) return done(err)
        let chassis = new Chassis(opts)
        chassis.on('Entered', state => {
          if (state === 'Failed') {
            chassis.removeAllListeners()
            expect(chassis.state.err.code).to.equal('EISDIR')
            done()
          }
        })
      })
    })  

  }) 
})
