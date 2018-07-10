const Promise = require('bluebird')

const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')

const fakeNfsAsync = require('test/lib/nfs')
const { UUIDDE, UUIDF } = fakeNfsAsync

const Watson = require('phi-test/lib/watson')
const { sortF, getConflicts, shake, generate } = require('src/fruitmix/xcopy/xtree')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

const FILES = require('../lib').FILES

const { alonzo, vpai001, foo } = FILES

const alice = {
  uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
  username: 'alice',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
  lastChangeTime: 1523867673407,
  isFirstUser: true,
  createTime: 1523867673407,
  status: 'ACTIVE',
  phicommUserId: 'alice'
}

/**
test plan

1. images copy check
2. images move check
3. images ecopy check
4. images emove check

5. vfs search copy check 
6. vfs search move check
7. vfs search ecopy check
8. vfs search emove check

9. nfs search icopy
10. nfs search imove
11. nfs search ncopy
12. nfs search nmove
*/

describe(path.basename(__filename), () => {
  let watson, user, home, pub, n1, n2

  beforeEach(async function () {
    await rimrafAsync(tmptest)
    await mkdirpAsync(fruitmixDir)
    let fake = await fakeNfsAsync(tmptest)
    let boundVolume = fake.createBoundVolume(fake.storage, fakeNfsAsync.UUIDBC)

    let userFile = path.join(fruitmixDir, 'users.json')
    await fs.writeFileAsync(userFile, JSON.stringify([alice], null, '  '))

    let opts = { fruitmixDir, boundVolume }
    let fruitmix = new Fruitmix(opts)
    let app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
    await new Promise(resolve => fruitmix.once('FruitmixStarted', () => resolve()))

    watson = new Watson({ app })
    await new Promise((resolve, reject) =>
      watson.login('alice', 'alice', err => err ? reject(err) : resolve()))

    fruitmix.nfs.update(fake.storage)
    user = watson.users.alice
  })

  ;['copy', 'move'].forEach(type => 
    it('should do nothing', async function () {
      this.timeout(10000)

      let src = await user.mktreeAsync({
        type: 'vfs',
        drive: user.home.uuid,
        dir: user.home.uuid,
        children: [
          {
            type: 'directory',
            name: 'foo',
            children: [
              {
                type: 'file',
                name: alonzo.name,
                file: alonzo.path,
                size: alonzo.size,
                sha256: alonzo.hash 
              },
              {
                type: 'file',
                name: vpai001.name,
                file: vpai001.path,
                size: vpai001.size,
                sha256: vpai001.hash 
              } 
            ]
          }
        ]
      }) 

      await Promise.delay(1000)

      let xs = await new Promise((resolve, reject) => {
        request(watson.app.express) 
          .get('/files')
          .set('Authorization', 'JWT ' + user.token)
          .query({
            places: user.home.uuid,
            class: 'image', 
          })
          .expect(200)
          .end((err, res) => {
            if (err) return reject(err)
            resolve(res.body)
          })
      }) 

      let task = await new Promise((resolve, reject) => {
        request(watson.app.express)
          .post('/tasks')
          .set('Authorization', 'JWT ' + user.token)
          .send({
            batch: true,
            type,
            dst: {
              drive: user.pub.uuid,
              dir: user.pub.uuid
            },
            entries: xs.map(x => ({
              drive: user.home.uuid,
              dir: x.pdir,
              name: x.namepath.pop()
            })),
           
          })
          .expect(200)
          .end((err, res) => {
            if (err) return reject(err)
            resolve(res.body)
          })
      }) 

      console.log(task)

      await Promise.delay(2000)

      let task2 = await new Promise((resolve, reject) => {
        request(watson.app.express)
          .get(`/tasks/${task.uuid}`)
          .set('Authorization', 'JWT ' + user.token)
          .expect(200)
          .end((err, res) => {
            if (err) return reject(err)
            resolve(res.body)
          })
      })

      expect(task2.entries).to.deep.equal([])
      expect(task2.current).to.equal(null)
      expect(task2.allFinished).to.equal(true)
    }))

  it('should do nothing', async function () {
    this.timeout(10000)

    let src = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: [
        {
          type: 'directory',
          name: 'foo',
          children: [
            {
              type: 'file',
              name: alonzo.name,
              file: alonzo.path,
              size: alonzo.size,
              sha256: alonzo.hash 
            },
            {
              type: 'file',
              name: vpai001.name,
              file: vpai001.path,
              size: vpai001.size,
              sha256: vpai001.hash 
            } 
          ]
        }
      ]
    }) 

    await Promise.delay(1000)

    let xs = await new Promise((resolve, reject) => {
      request(watson.app.express) 
        .get('/files')
        .set('Authorization', 'JWT ' + user.token)
        .query({
          places: user.home.uuid,
          class: 'image', 
        })
        .expect(200)
        .end((err, res) => {
          if (err) return reject(err)
          resolve(res.body)
        })
    }) 

    let task = await new Promise((resolve, reject) => {
      request(watson.app.express)
        .post('/tasks')
        .set('Authorization', 'JWT ' + user.token)
        .send({
          batch: true,
          type: 'emove',
          dst: {
            drive: UUIDDE,
            dir: ''
          },
          entries: xs.map(x => ({
            drive: user.home.uuid,
            dir: x.pdir,
            name: x.namepath.pop()
          })),
         
        })
        .expect(200)
        .end((err, res) => {
          if (err) return reject(err)
          resolve(res.body)
        })
    }) 

    await Promise.delay(2000)

    let task2 = await new Promise((resolve, reject) => {
      request(watson.app.express)
        .get(`/tasks/${task.uuid}`)
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => {
          if (err) return reject(err)
          resolve(res.body)
        })
    })

    expect(task2.entries).to.deep.equal([])
    expect(task2.current).to.equal(null)
    expect(task2.allFinished).to.equal(true)
  })

  it('vfs search 0005', async function () {
    this.timeout(10000)

    let src = await user.mktreeAsync({
      type: 'vfs',
      drive: user.home.uuid,
      dir: user.home.uuid,
      children: [
        {
          type: 'directory',
          name: 'a001',
          children: [
            {
              type: 'file',
              name: 'a003',
              file: alonzo.path,
              size: alonzo.size,
              sha256: alonzo.hash 
            },
            {
              type: 'file',
              name: 'a002',
              file: vpai001.path,
              size: vpai001.size,
              sha256: vpai001.hash 
            } 
          ]
        },
        {
          type: 'file',
          name: 'a002',
          file: foo.path,
          size: foo.size,
          sha256: foo.hash
        }
      ]
    }) 

    await Promise.delay(1000)

    let xs = await new Promise((resolve, reject) => {
      request(watson.app.express) 
        .get('/files')
        .set('Authorization', 'JWT ' + user.token)
        .query({
          order: 'find',
          places: user.home.uuid,
          name: 'a', 
        })
        .expect(200)
        .end((err, res) => {
          if (err) return reject(err)
          console.log('vfs search', res.body)
          resolve(res.body)
        })
    }) 

    let task = await new Promise((resolve, reject) => {
      request(watson.app.express)
        .post('/tasks')
        .set('Authorization', 'JWT ' + user.token)
        .send({
          batch: true,
          type: 'move',
          dst: {
            drive: user.pub.uuid,
            dir: user.pub.uuid
          },
          entries: xs.map(x => ({
            drive: user.home.uuid,
            dir: x.pdir,
            name: x.namepath.pop()
          })),
         
        })
        .expect(200)
        .end((err, res) => {
          if (err) return reject(err)
          resolve(res.body)
        })
    }) 

    await Promise.delay(2000)

    let task2 = await new Promise((resolve, reject) => {
      request(watson.app.express)
        .get(`/tasks/${task.uuid}`)
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => {
          if (err) return reject(err)
          resolve(res.body)
        })
    })

    expect(task2.entries).to.deep.equal([])
    expect(task2.current).to.equal(null)
    expect(task2.allFinished).to.equal(true)
  })

  it('nfs search 0010', async function () {
    this.timeout(10000)

    let src = await user.mktreeAsync({
      type: 'nfs',
      drive: UUIDDE,
      dir: '',
      children: [
        {
          type: 'directory',
          name: 'a001',
          children: [
            {
              type: 'file',
              name: 'a003',
              file: alonzo.path,
              size: alonzo.size,
              sha256: alonzo.hash 
            },
            {
              type: 'file',
              name: 'a002',
              file: vpai001.path,
              size: vpai001.size,
              sha256: vpai001.hash 
            } 
          ]
        },
        {
          type: 'file',
          name: 'a002',
          file: foo.path,
          size: foo.size,
          sha256: foo.hash
        }
      ]
    }) 

    await Promise.delay(1000)

    let xs = await new Promise((resolve, reject) => {
      request(watson.app.express) 
        .get(`/phy-drives/${UUIDDE}`)
        .set('Authorization', 'JWT ' + user.token)
        .query({
          name: 'a', 
        })
        .expect(200)
        .end((err, res) => {
          if (err) return reject(err)
          resolve(res.body)
        })
    }) 

    let task = await new Promise((resolve, reject) => {
      request(watson.app.express)
        .post('/tasks')
        .set('Authorization', 'JWT ' + user.token)
        .send({
          batch: true,
          type: 'nmove',
          dst: {
            drive: UUIDF,
            dir: ''
          },
          entries: xs.map(x => {
            let name = x.namepath.pop()
            let dir = x.namepath.join('/')
            let entry =  {
              drive: UUIDDE,
              dir: x.namepath.join('/'),
              name,
            }
            return entry
          }),
         
        })
        .expect(200)
        .end((err, res) => {
          if (err) return reject(err)
          resolve(res.body)
        })
    }) 

    await Promise.delay(2000)
/**
    let task2 = await new Promise((resolve, reject) => {
      request(watson.app.express)
        .get(`/tasks/${task.uuid}`)
        .set('Authorization', 'JWT ' + user.token)
        .expect(200)
        .end((err, res) => {
          if (err) return reject(err)
          resolve(res.body)
        })
    })

    expect(task2.entries).to.deep.equal([])
    expect(task2.current).to.equal(null)
    expect(task2.allFinished).to.equal(true)
*/
  })
 
})
