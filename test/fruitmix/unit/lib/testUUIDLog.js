import path from 'path'
import fs from 'fs'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'

import { expect } from 'chai'

import createUUIDLog from 'src/fruitmix/lib/uuidlog'

const uuid1 = '827019ba-0fd8-4401-aefe-4b72a4ea0c33'

describe(path.basename(__filename), function() {

  const cwd = process.cwd()

  beforeEach(done =>
    rimraf('tmptest', err => err ?  done(err) :
      mkdirp('tmptest', err => err ? done(err) : done())))

  it('get should return [] if log file non-exist', function(done) {

    let log = createUUIDLog(path.join(cwd, 'tmptest'))
    log.get(uuid1, (err, arr) => {
      if (err) return done(err)
      expect(arr).to.deep.equal([])
      done()
    })        
  })

  it('append should return null when log file non-exist', function(done) {

    let log = createUUIDLog(path.join(cwd, 'tmptest'))
    log.append(uuid1, 'hello', err => {
      expect(err).to.be.null
      done()
    })
  })

  it('append should create log file when log file non-exist, with text prefixed with newline', function(done) {

    let log = createUUIDLog(path.join(cwd, 'tmptest'))
    log.append(uuid1, 'hello', err => {
      if (err) return done(err)
      fs.readFile(path.join(cwd, 'tmptest', uuid1), (err, data) => {
        if (err) return done(err)
        expect(data.toString()).to.equal('\nhello')
        done()
      })
    })
  })

  it('append on existing log should store text to file end, prefixed with newline', function(done) {

    fs.writeFile(path.join(cwd, 'tmptest', uuid1), '\nhello', (err, data) => {
      let log = createUUIDLog(path.join(cwd, 'tmptest'))
      log.append(uuid1, 'world', err => {
        if (err) return done(err)
        fs.readFile(path.join(cwd, 'tmptest', uuid1), (err, data) => {
          if (err) return done(err)
          expect(data.toString()).to.equal('\nhello\nworld')
          done()
        })
      })
    })
  })

  it('append should NOT append empty line', function(done) {
    fs.writeFile(path.join(cwd, 'tmptest', uuid1), '\nhello', (err, data) => {
      let log = createUUIDLog(path.join(cwd, 'tmptest'))
      log.append(uuid1, '\n', err => {
        if (err) return done(err)
        fs.readFile(path.join(cwd, 'tmptest', uuid1), (err, data) => {
          if (err) return done(err)
          expect(data.toString()).to.equal('\nhello')
          done()
        })
      })
    })
  })

  it('append should trim text', function(done) {
    fs.writeFile(path.join(cwd, 'tmptest', uuid1), '\nhello', (err, data) => {
      let log = createUUIDLog(path.join(cwd, 'tmptest'))
      log.append(uuid1, ' world ', err => {
        if (err) return done(err)
        fs.readFile(path.join(cwd, 'tmptest', uuid1), (err, data) => {
          if (err) return done(err)
          expect(data.toString()).to.equal('\nhello\nworld')
          done()
        })
      })
    })
  })

  it('append should append trimmed first line only', function(done) {
    fs.writeFile(path.join(cwd, 'tmptest', uuid1), '\nhello', (err, data) => {
      let log = createUUIDLog(path.join(cwd, 'tmptest'))
      log.append(uuid1, ' world \nfoo\nbar ', err => {
        if (err) return done(err)
        fs.readFile(path.join(cwd, 'tmptest', uuid1), (err, data) => {
          if (err) return done(err)
          expect(data.toString()).to.equal('\nhello\nworld')
          done()
        })
      })
    })
  })

  it('append should NOT append if trimmed first line empty', function(done) {
    fs.writeFile(path.join(cwd, 'tmptest', uuid1), '\nhello', (err, data) => {
      let log = createUUIDLog(path.join(cwd, 'tmptest'))
      log.append(uuid1, '    \nfoo\nbar ', err => {
        if (err) return done(err)
        fs.readFile(path.join(cwd, 'tmptest', uuid1), (err, data) => {
          if (err) return done(err)
          expect(data.toString()).to.equal('\nhello')
          done()
        })
      })
    })
  })

  it('get should readback one line out of log file', function(done) {

    fs.writeFile(path.join(cwd, 'tmptest', uuid1), '\nhello', (err, data) => { 
      if (err) return done(err)
      let log = createUUIDLog(path.join(cwd, 'tmptest'))
      log.get(uuid1, (err, arr) => {
        if (err) return done(err)
        expect(arr).to.deep.equal(['hello']) 
        done()
      })
    })
  })

  it('get should readback two lines out of log file', function(done) {

    fs.writeFile(path.join(cwd, 'tmptest', uuid1), '\nhello\nworld', (err, data) => { 
      if (err) return done(err)
      let log = createUUIDLog(path.join(cwd, 'tmptest'))
      log.get(uuid1, (err, arr) => {
        if (err) return done(err)
        expect(arr).to.deep.equal(['hello', 'world']) 
        done()
      })
    })
  }) 
})


