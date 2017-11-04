const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const chai = require('chai')
const expect = chai.expect

const File = require('src/forest/file')
const Directory = require('src/forest/directory')
const MediaMap = require('src/media/map')
const Meta = MediaMap.Meta

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const driveUUID = '058f33e5-0b47-4f38-8f80-df414eb38a07' 

describe(path.basename(__filename), () => {

  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(path.join(tmptest, driveUUID))
  })
  afterEach(() => {})

  it('create new media map', done => {
    let map = new MediaMap({ concurrency: 2 })
    expect(map instanceof EventEmitter).to.be.true
    expect(map.concurrency).to.equal(2)
    expect(map.map instanceof Map).to.be.true
    expect(map.map.size).to.equal(0)
    expect(map.running instanceof Set).to.be.true
    expect(map.running.size).to.equal(0)
    expect(map.pending instanceof Set).to.be.true
    expect(map.pending.size).to.equal(0)
    done()
  })

  it('index a file', done => {
    let map = new MediaMap({ concurrency: 2 }) 
    let file = {
      hash: 'x',
      magic: 'JPEG'
    }

    map.indexFile(file)
    console.log(map)
    console.log(file)
    done()   
  })
})

