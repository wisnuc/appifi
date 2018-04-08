const path = require('path')
const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Auth = require('src/middleware/Auth')
const Token = require('src/routes/Token')
const TimeDate = require('src/routes/TimeDate')
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
      ['/token', Token(auth)],
      ['/control/timedate', TimeDate(auth)] 
    ]
  }

  return createApp(opts)
}

describe(path.basename(__filename), () => {
  describe('alice and bob (disabled)', () => {
    it('should return 401 if no auth', done => {
      request(createApp1())
        .get('/control/timedate')
        .expect(401)
        .end(done)
    })

    it('should return 401 if bob (disabled) ', done => {
      request(createApp1())
        .get('/control/timedate')
        .auth(bob.uuid, 'bob')
        .expect(401)
        .end(done)
    })

    it('should return 401 if charlie (nonexist)', done => {
      request(createApp1())
        .get('/control/timedate')
        .auth(charlie.uuid, 'charlie')
        .expect(401)
        .end(done)
    })

    it("should return timedate for alice, print", done => {
      let app = createApp1()
      request(app)
        .get('/token')
        .auth(alice.uuid, 'alice')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          let token = res.body.token
          request(app)
            .get('/control/timedate')
            .set('Authorization', 'JWT ' + token)
            .expect(200)
            .end((err, res) => {
              console.log(err || res.body)
              done(err)
            })
        })
    })
  })
})
