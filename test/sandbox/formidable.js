const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

const express = require('express')
const logger = require('morgan')
const bodyParser = require('body-parser')
const formidable = require('formidable') 

const request = require('supertest')

describe(path.basename(__filename), () => {

  describe('test formidable early abort', () => {

    let app

    before(() => {

      app = express()
      app.use(logger('dev'))
      app.use(bodyParser.json())
      app.use(bodyParser.urlencoded({ extended: false }))

      app.post('/', (req, res) => {

        let form = new formidable.IncomingForm()

        form.onPart = function(part) {
  
          part.on('data', data => {
            console.log('part data', data.length)
          })

          part.on('end', () => {
            console.log('part end')
            res.status(200).end()
          })

          part.on('error', err => {
            console.log('part error', err)
          })

        }

        req.on('abort', () => {
          console.log('req abort')
        })

        form.on('error', err => {
          console.log('form error', err)
        })

        form.parse(req)
      })

    })

    it('should do what?', done => {

      let r = request(app)
        .post('/')  
        .attach('file', 'testdata/alonzo_church.jpg')
        .expect(200)
        .end((err, res) => {
          console.log(err || res.body)
          done()
        })

      setTimeout(() => r.abort(), 10)
    })
  })
})
