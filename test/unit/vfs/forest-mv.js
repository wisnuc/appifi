const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)

const UUID = require('uuid')
const xattr = require('fs-xattr')

const chai = require('chai')
const expect = chai.expect

const MediaMap = require('src/media/map')
const Forest = require('src/vfs/forest')
const Directory = require('src/vfs/directory')
const File = require('src/vfs/file')

const Debug = require('debug')
const debug = process.env.hasOwnProperty('DEBUG') ? Debug('test') : () => {}

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

describe(path.basename(__filename), () => {

  let rootUUID = '3cc3df6b-5533-4c5b-91b8-67186eebc0ae'

  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
  })

  it('try move ?', done => {
    done()
  })
})

