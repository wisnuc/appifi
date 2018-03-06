const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirpAsync = Promise.promisify(mkdirp)

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect
const should = chai.should()

const Readdir = require('src/stepper/readdir-recursive-stream.js')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmp = path.join(tmptest, 'tmp')

describe(path.basename(__filename), () => {

  describe('do nothing', () => {

    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(tmptest)
    })

    it('new readdir', done => {
      let rd = new Readdir(tmptest) 
      expect(rd.isStopped()).to.be.true
      expect(rd.failed.length).to.equal(0)
      done()
    })

    it('push non-existent name', done => {
      let rd = new Readdir(tmptest)
      rd.push('hello')

      rd.on('error', err => {
        expect(err.code).to.equal('ENOENT')
      })

      rd.on('step', () => {
        expect(rd.isStopped()).to.be.true
        expect(rd.failed.length).to.equal(1)
        done()
      })
    })

    it('push hello []', done => {
      mkdirp.sync(path.join(tmptest, 'hello'))

      let output = []

      let rd = new Readdir(tmptest)
      rd.push('hello')
      rd.on('data', data => output.push(data))
      rd.on('step', () => {
        if (rd.isStopped()) {
          expect(output).to.deep.equal([{
            path: 'hello',
            files: []
          }])
          done()
        }
      })
    })

    it('push hello [] / world []', done => {
      mkdirp.sync(path.join(tmptest, 'hello', 'world'))

      let output = []

      let rd = new Readdir(tmptest)
      rd.push('hello')
      rd.on('data', data => {
        output.push(data)
      })
      rd.on('step', () => {
        if (rd.isStopped()) {
          expect(output).to.deep.equal([{
            path: 'hello',
            files: []
          }, {
            path: 'hello/world',
            files: []
          }])
          done()
        }
      })
    })

    it('push hello [foo, bar] / world [foo, bar] / foobar [foo, bar]', done => {
      mkdirp.sync(path.join(tmptest, 'hello', 'world', 'foobar'))
      fs.writeFileSync(path.join(tmptest, 'hello', 'foo'), 'foo') 
      fs.writeFileSync(path.join(tmptest, 'hello', 'bar'), 'bar')
      fs.writeFileSync(path.join(tmptest, 'hello', 'world', 'foo'), 'foo')
      fs.writeFileSync(path.join(tmptest, 'hello', 'world', 'bar'), 'bar')
      fs.writeFileSync(path.join(tmptest, 'hello', 'world', 'foobar', 'foo'), 'foo')
      fs.writeFileSync(path.join(tmptest, 'hello', 'world', 'foobar', 'bar'), 'bar')

      let output = []

      let rd = new Readdir(tmptest)
      rd.push('hello')
      rd.on('data', data => output.push(data))
      rd.on('step', () => {
        if (rd.isStopped()) {

          let sorted = output
            .map(x => ({ path: x.path, files: x.files.sort() }))
            .sort((a, b) => a.path.localeCompare(b.path))

          expect(sorted).to.deep.equal([{
            path: 'hello',
            files: ['bar', 'foo']
          }, {
            path: 'hello/world',
            files: ['bar', 'foo']
          }, {
            path: 'hello/world/foobar',
            files: ['bar', 'foo']
          }])

          done()
        }
      })
    })
  })
})
