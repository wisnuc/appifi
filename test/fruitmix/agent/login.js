import path from 'path'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'
import request from 'supertest'
import fs from 'fs'

import app from 'src/fruitmix/app'
import models from 'src/fruitmix/models/models'
import { expect } from 'chai'

import Models from 'src/fruitmix/models/models'  
import Promise from 'bluebird'

import { createUserModel } from 'src/fruitmix/models/userModel'

const userUUID = '9f93db43-02e6-4b26-8fae-7d6f51da12af'
const drv001UUID = 'ceacf710-a414-4b95-be5e-748d73774fc4'  
const drv002UUID = '6586789e-4a2c-4159-b3da-903ae7f10c2a' 

describe(path.basename(__filename), function() {

  const cwd = process.cwd()

  const userFilePath = path.join(cwd, 'tmptest', 'users.json')
  const tmpdir = path.join(cwd, 'tmptest', 'tmp')

  const users = [
    {
      type: 'local',
      uuid: userUUID,
      username: 'hello',
      password: '$2a$10$0kJAT..tF9IihAc6GZfKleZQYBGBHSovhZp5d/DiStQUjpSMnz8CC',
      avatar: null,
      email: null,
      isFirstUser: true,
      isAdmin: true,
      home: drv001UUID,
      library: drv002UUID
    }
  ]

  beforeEach(function(done) {
    rimraf('tmptest', err => {
      if (err) return done(err)
      mkdirp('tmptest/tmp', err => {
        if (err) return done(err)
        done() 
      })
    })
  })
    
  it('return empty set when no user exists', (done) => {

    createUserModel(userFilePath, tmpdir, (err, userModel) => {
      models.setModel('user', userModel)
      request(app)
        .get('/login')
        .set('Accept', 'application/json')
        .expect(200)
        .end((err, res) => { 
           if(err) return done(err);
           expect(res.body).to.deep.equal([]);
           done();
         })
    })

  })
  
  it('return full set when user exists', (done) => {

    fs.writeFile(userFilePath, JSON.stringify(users), err => {
      createUserModel(userFilePath, tmpdir, (err, userModel) => {
        models.setModel('user', userModel)
        request(app)
          .get('/login')
          .set('Accept', 'application/json')
          .expect(200)
          .end((err, res) => { 
            if(err) return done(err);
            expect(res.body).to.deep.equal([
              Object.assign({}, {
                avatar: users[0].avatar,
                username: users[0].username,
                uuid: users[0].uuid
              })
            ]);
            done();
          })
      })
    })
  })
})

