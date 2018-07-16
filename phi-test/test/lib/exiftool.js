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

const cwd = process.cwd()

const ExifTool = require('src/lib/exiftool3')

const { wmvSample } = require('../lib').FILES

describe(path.basename(__filename), () => {
  it('hello', done => {
    let args = ['-S', '-FileType']
    let et = new ExifTool(args)
    let file = path.join(cwd, wmvSample.path) 

    let count = 256
    for (let i = 0; i < count; i++) {
      et.request(file, ['-S', '-FileType'], (err, data) => {
        console.log(err || data)
        if (!--count) done()
      })
    }
   
  })
})
