const path = require('path')
const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Auth = require('src/middleware/Auth')
const createTokenRouter = require('src/routes/Token')
const createApp = require('src/system/express')

const alice = {
  uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
  disabled: false,
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy' // password: 'alice'
}

const bob = {
  uuid: '844921ed-bdfd-4bb2-891e-78e358b54869',
  disabled: true,
  password: '$2a$10$OhlvXzpOyV5onhi5pMacvuDLwHCyLZbgIV1201MjwpJ.XtsslT3FK' // password: 'bob'
}

const charlie = {
  uuid: 'dfd1ed53-4590-42ed-8d94-7975c5d2490c',
  disabled: false,
  password: '$2a$10$dDuUPGJBu0MFGUckE5sRXemO/Tot134EKubH4m/Rox5Y8Oo62oQjC' // password: 'charlie'
}

const createApp1 = () => {
  let auth = new Auth('some secret', [alice, bob])
  let opts = {
    auth: auth.middleware,
    setttings: { json: { spaces: 2 } },
    log: { skip: 'all', error: 'all' },
    routers: [
      ['/token', createTokenRouter(auth)]
    ]
  }

  return createApp(opts)
}

describe(path.basename(__filename), () => {
  describe('alice and bob (disabled)', () => {
    it('should return 401 if no auth', done => {
      request(createApp1())
        .get('/token')
        .expect(401)
        .end(done)
    })

    it('should return 401 if bob (disabled) ', done => {
      request(createApp1())
        .get('/token')
        .auth(bob.uuid, 'bob')
        .expect(401)
        .end(done)
    })

    it('should return 401 if charlie (nonexist)', done => {
      request(createApp1())
        .get('/token')
        .auth(charlie.uuid, 'charlie')
        .expect(401)
        .end(done)
    })

    it('should return 401 if incorrect password', done => {
      request(createApp1())
        .get('/token')
        .auth(alice.uuid, 'incorrect')
        .expect(401)
        .end(done)
    })

    it("should return alice's token", done => {
      request(createApp1())
        .get('/token')
        .auth(alice.uuid, 'alice')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.type).to.equal('JWT')
          expect(res.body.token).to.be.a('string')
          done()
        })
    })

    it("should verify alice's token", done => {
      let app = createApp1()
      request(app)
        .get('/token')
        .auth(alice.uuid, 'alice')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          let token = res.body.token

          request(app)
            .get('/token/verify')
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end(done)
        })
    })

    it('should NOT verify faked token string', done => {
      request(createApp1())
        .get('/token/verify')
        .set('Authorization', 'JWT ' + 'FAKED_TOKEN_STRING')
        .expect(401)
        .end(done)
    })
  })
})
