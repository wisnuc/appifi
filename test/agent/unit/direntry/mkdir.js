const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const { isUUID } = require('validator')

const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

// node src/utils/md4Encrypt.js alice

const alice = {
  uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
  username: 'alice',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
  lastChangeTime: 1523867673407,
  isFirstUser: true,
  phicommUserId: 'alice'
}

const bob = {
  uuid: '844921ed-bdfd-4bb2-891e-78e358b54869',
  username: 'bob',
  password: '$2a$10$OhlvXzpOyV5onhi5pMacvuDLwHCyLZbgIV1201MjwpJ.XtsslT3FK',
  smbPassword: 'B7C899154197E8A2A33121D76A240AB5',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  phicommUserId: 'bob'
}

const charlie = {
  uuid: '7805388f-a4fd-441f-81c0-4057c3c7004a',
  username: 'charlie',
  password: '$2a$10$TJdJ4L7Nqnnw1A9cyOlJuu658nmpSFklBoodiCLkQeso1m0mmkU6e',
  smbPassword: '8D44C8FF3A4D1979B24BFE29257173AD',
  lastChangeTime: 1523867673407,
  isFirstUser: false,
  phicommUserId: 'charlie'
}

describe(path.basename(__filename), () => {
  const requestToken = (express, userUUID, password, callback) =>
    request(express)
      .get('/token')
      .auth(userUUID, password)
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body.token))

  const requestTokenAsync = Promise.promisify(requestToken)

  const requestHome = (express, userUUID, token, callback) =>
    request(express)
      .get('/drives')
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        let home = res.body.find(d => d.type === 'private' && d.owner === userUUID)
        if (!home) {
          callback(new Error('home drive not found'))
        } else {
          callback(null, home)
        }
      })

  const requestHomeAsync = Promise.promisify(requestHome)

  let policies = [
    undefined,
    [null, null],
    [null, 'skip'],
    [null, 'replace'],
    [null, 'rename'],
    ['skip', null],
    ['skip', 'skip'],
    ['skip', 'replace'],
    ['skip', 'rename'],
    ['replace', null],
    ['replace', 'skip'],
    ['replace', 'replace'],
    ['replace', 'rename'],
    ['rename', null],
    ['rename', 'skip'],
    ['rename', 'replace'],
    ['rename', 'rename']
  ]

  describe('alice home', () => {
    let fruitmix, app, token, home

    beforeEach(async () => {
      await Promise.delay(100)
      await rimrafAsync(tmptest)
      await mkdirpAsync(fruitmixDir)

      let userFile = path.join(fruitmixDir, 'users.json')
      await fs.writeFileAsync(userFile, JSON.stringify([alice], null, '  '))

      fruitmix = new Fruitmix({ fruitmixDir })
      app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
      await new Promise(resolve => fruitmix.once('FruitmixStarted', () => resolve()))
      token = await requestTokenAsync(app.express, alice.uuid, 'alice')
      home = await requestHomeAsync(app.express, alice.uuid, token)
    })

    /**
    target does not exists, all policies succeed. resolved is [false, false]
    */
    policies.forEach(policy => {
      it(`200 if no hello, [${String(policy)}] resolved [false, false]`, done => {
        request(app.express)
          .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello', JSON.stringify({ op: 'mkdir' , policy }))
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body[0].resolved).to.deep.equal([false, false])
            done()
          })
      })
    })

    /**
    target is dir, same null 403, code EEXIST, xcode EISDIR
    */
    policies.filter(p => !p || p[0] === null).forEach(policy => {
     it(`403 if hello is dir, [${String(policy)}], EEXIST/EISDIR`, done => {  
        mkdirp(path.join(tmptest, 'fruitmix', 'drives', home.uuid, 'hello'), err => {
          if (err) return done(err)
          request(app.express)
            .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
            .set('Authorization', 'JWT ' + token)
            .field('hello', JSON.stringify({ op: 'mkdir', policy }))
            .expect(403)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body.code).to.equal('EEXIST')
              expect(res.body.xcode).to.equal('EISDIR')
              expect(res.body.result[0].error.code).to.equal('EEXIST')
              expect(res.body.result[0].error.xcode).to.equal('EISDIR')
              done()
            })
        })
      })
    })

    /**
    target is dir, same skip 200, resolved [true, false], uuid and name unchanged
    */
    policies.filter(p => p && p[0] === 'skip').forEach(policy => {
      it(`200 if hello is dir, [${String(policy)}] resolved [true, false], unchanged`, done => {  
        request(app.express)
          .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello', JSON.stringify({ op: 'mkdir' }))
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            let xstat = res.body[0].data

            request(app.express)
              .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
              .set('Authorization', 'JWT ' + token)
              .field('hello', JSON.stringify({ op: 'mkdir', policy }))
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)
                expect(res.body[0].resolved).to.deep.equal([true, false])
                expect(res.body[0].data).to.deep.equal(xstat)
                done()
              })
          })

      })
    })

    /**
    target is dir, same replace 200, resolved [true, false], uuid and name unchanged

    In underlying, replace keeping uuid, which means overwrite. This is non-sense for dir.
    */
    policies.filter(p => p && p[0] === 'replace').forEach(policy => {
      it(`200 if hello is dir, [${String(policy)}] resolved [true, false], unchanged 987580b4`, done => {  
        request(app.express)
          .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello', JSON.stringify({ op: 'mkdir' }))
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            let xstat = res.body[0].data

            request(app.express)
              .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
              .set('Authorization', 'JWT ' + token)
              .field('hello', JSON.stringify({ op: 'mkdir', policy }))
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)
                expect(res.body[0].resolved).to.deep.equal([true, false]) // resolved
                expect(res.body[0].data.name).to.equal(xstat.name)        // same name
                expect(res.body[0].data.uuid).to.equal(xstat.uuid)        // same instance
                done()
              })
          })

      })
    })

    /**
    target is dir, same rename 200, resolved [true, false], left two dirs'
    */
    policies.filter(p => p && p[0] === 'rename').forEach(policy => {
      it(`200 if hello is dir, [${String(policy)}] resolved [true, false], left two dirs, 085b25a6`, done => {  
        request(app.express)
          .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
          .set('Authorization', 'JWT ' + token)
          .field('hello', JSON.stringify({ op: 'mkdir' }))
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            let xstat = res.body[0].data

            request(app.express)
              .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
              .set('Authorization', 'JWT ' + token)
              .field('hello', JSON.stringify({ op: 'mkdir', policy }))
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)
                expect(res.body[0].resolved).to.deep.equal([true, false]) // resolved
                let xstat2 = res.body[0].data

                request(app.express)
                  .get(`/drives/${home.uuid}/dirs/${home.uuid}`)
                  .set('Authorization', 'JWT ' + token)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)
                    expect(res.body.entries.sort((a, b) => a.name.localeCompare(b.name))).to.deep.equal([xstat, xstat2])
                    done()
                  })
              })
          })

      })
    })

    /**
    target is file, diff null 403. EEXIST/EISFILE
    */
    policies.filter(p => !p || !p[1]).forEach(policy => {
      it(`403 if hello is file, [${String(policy)}], EEXIST/EISFILE`, done => {  
        fs.writeFile(path.join(tmptest, 'fruitmix', 'drives', home.uuid, 'hello'), 'hello', err => {
          if (err) return done(err)
          request(app.express)
            .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
            .set('Authorization', 'JWT ' + token)
            .field('hello', JSON.stringify({ op: 'mkdir' , policy }))
            .expect(403)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body.code).to.equal('EEXIST')
              expect(res.body.xcode).to.equal('EISFILE')
              expect(res.body.result[0].error.code).to.equal('EEXIST')
              expect(res.body.result[0].error.xcode).to.equal('EISFILE')
              done()
            })
        })
      })
    })


    /**
    target is file, diff skip 200. resolved is [true, false], data is null, file unchanged

    TODO use api to create file
    */
    policies.filter(p => p && p[1] === 'skip').forEach(policy => {
      it(`200 if hello is file, ${String(policy)} resolved [false, true], file unchanged, b3cd5d6a`, done => {  
        fs.writeFile(path.join(tmptest, 'fruitmix', 'drives', home.uuid, 'hello'), 'hello', err => {
          if (err) return done(err)
          request(app.express)
            .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
            .set('Authorization', 'JWT ' + token)
            .field('hello', JSON.stringify({ op: 'mkdir' , policy }))
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body[0].resolved).to.deep.equal([false, true])
              expect(res.body[0].data).to.equal(null)
              done()
            })
        })
      })
    })


    /**
    target is file, diff replace 200. resolved is [false, true], 

    TODO use api to create file, assert uuid change
    */
    policies.filter(p => p && p[1] === 'replace').forEach(policy => {
      it(`200 if hello is file, ${String(policy)} resolved [false, true], x file + dir`, done => {  
        fs.writeFile(path.join(tmptest, 'fruitmix', 'drives', home.uuid, 'hello'), 'hello', err => {
          if (err) return done(err)
          request(app.express)
            .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
            .set('Authorization', 'JWT ' + token)
            .field('hello', JSON.stringify({ op: 'mkdir' , policy }))
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body[0].resolved).to.deep.equal([false, true])
              expect(res.body[0].data.type).to.equal('directory')
              done()
            })
        })
      })
    })

    /**
    target is file, diff rename 200. resolved is [false, true], 

    TODO use api to create file, assert uuid change
    */
    policies.filter(p => p && p[1] === 'rename').forEach(policy => {
      it(`200 if hello is file, ${String(policy)} resolved [false, true], keep file + dir`, done => {  
        fs.writeFile(path.join(tmptest, 'fruitmix', 'drives', home.uuid, 'hello'), 'hello', err => {
          if (err) return done(err)
          request(app.express)
            .post(`/drives/${home.uuid}/dirs/${home.uuid}/entries`)
            .set('Authorization', 'JWT ' + token)
            .field('hello', JSON.stringify({ op: 'mkdir' , policy }))
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              expect(res.body[0].resolved).to.deep.equal([false, true])
              expect(res.body[0].data.type).to.equal('directory')
              done()
            })
        })
      })
    })

  })
 
})
