import path from 'path'
import fs from 'fs'
import mkdirp from 'mkdirp'
import rimraf from 'rimraf'
import request from 'supertest'

import app from 'src/fruitmix/app'
import models from 'src/fruitmix/models/models'

import { createUserModelAsync } from 'src/fruitmix/models/userModel'

let users = [
  {
    'uuid': '9f93db43-02e6-4b26-8fae-7d6f51da12af',
    'username': 'hello',
    'password': '$2a$10$0kJAT..tF9IihAc6GZfKleZQYBGBHSovhZp5d/DiStQUjpSMnz8CC',
    'avatar': null,
    'email': null,
    'isFirstUser': true,
    'isAdmin': true,
  }
]


describe(path.basename(__filename) + ': test basic authentication', function() {

  let token

  beforeEach(function(done) {
    mkdirp('tmptest', err => {
      if (err) return done(err)
      fs.writeFile('tmptest/users.json', JSON.stringify(users, null, '  '), err => {
        if (err) return done(err)
        createUserModelAsync('tmptest/users.json', 'tmptest')
          .then(mod => {
            models.setModel('user', mod)
            done()
          })
          .catch(e => done(e))
      })
    })
  })

  it('GET /authtest/basic should success', function(done) {
    request(app)
      .get('/authtest/basic')
      .auth('9f93db43-02e6-4b26-8fae-7d6f51da12af', 'world')
      .set('Accept', 'application/json')
      .expect(200, done)  
  })

  it('GET token (NOT A TEST)', function(done) {
    request(app)
      .get('/token')
      .auth('9f93db43-02e6-4b26-8fae-7d6f51da12af', 'world')
      .set('Accept', 'application/json')
      .expect((res) => token = res.body.token)
      .end(done)
  })

  it('GET token then GET /authtest/jwt should success', function(done) {
    request(app)
      .get('/authtest/jwt')
      .set('Authorization', 'JWT ' + token)
      .set('Accept', 'application/json')
      .expect(200, done)
  })
})

