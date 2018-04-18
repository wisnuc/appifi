const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const DataStore = require('src/lib/DataStore')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

describe(path.basename(__filename), () => {
  const opts = Object.freeze({
    file: path.join(tmptest, 'file'),
    tmpDir: path.join(tmptest, 'tmp'),
    isArray: false
  })

  const arrOpts = Object.freeze({
    file: path.join(tmptest, 'file'),
    tmpDir: path.join(tmptest, 'tmp'),
    isArray: true
  })

  const writeFileSync = data => fs.writeFileSync(opts.file, JSON.stringify(data, null, '  '))
  const readFileSync = () => JSON.parse(fs.readFileSync(opts.file))

  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
  })

  it('should load null if file not exist, object, 33a7b921', done => {
    let ds = new DataStore(opts)
    ds.once('Update', (data, oldData) => {
      expect(data).to.equal(null)
      expect(oldData).to.equal(undefined)
      done()
    })
  })

  it('should load [] if file not exist, array', done => {
    let ds = new DataStore(Object.assign({}, opts, { isArray: true }))
    ds.once('Update', (data, oldData) => {
      expect(data).to.deep.equal([])
      expect(oldData).to.equal(undefined)
      done()
    })
  })

  it("should save { hello: 'world' }", done => {
    let ds = new DataStore(opts)
    ds.save({ hello: 'world' }, err => {
      if (err) return done(err)
      expect(readFileSync()).to.deep.equal({ hello: 'world' })
      done()
    })
  })

  it("should save [hello, world]", done => {
    let ds = new DataStore(arrOpts)
    ds.save(['hello', 'world'], err => {
      if (err) return done(err)
      expect(readFileSync()).to.deep.equal(['hello', 'world'])
      done()
    })
  })

  it("save { hello: 'world' } then { foo: 'bar' } should emit updates accordingly", done => {
    let ds = new DataStore(opts)
    ds.save({ hello: 'world' }, err => {
      if (err) return done(err)
      expect(readFileSync()).to.deep.equal({ hello: 'world' })
    })
    ds.save({ foo: 'bar' }, err => {
      if (err) return done(err)
      let readback = JSON.parse(fs.readFileSync(opts.file))
      expect(readFileSync()).to.deep.equal({ foo: 'bar' })
    })

    let q = []
    ds.on('Update', (data, oldData) => {
      q.push([data, oldData])
      if (q.length === 3) {
        expect(q).to.deep.equal([
          [null, undefined],
          [{ hello: 'world' }, null],
          [{ foo: 'bar' }, { hello: 'world' }]
        ])
        done()
      }
    })
  })

  it("save [hello] then [world] should emit updates accordingly", done => {
    let ds = new DataStore(arrOpts)
    ds.save(['hello'], err => {
      if (err) return done(err)
      expect(readFileSync()).to.deep.equal(['hello'])
    })
    ds.save(['world'], err => {
      if (err) return done(err)
      let readback = JSON.parse(fs.readFileSync(opts.file))
      expect(readFileSync()).to.deep.equal(['world'])
    })

    let q = []
    ds.on('Update', (data, oldData) => {
      q.push([data, oldData])
      if (q.length === 3) {
        expect(q).to.deep.equal([
          [[], undefined],
          [['hello'], []],
          [['world'], ['hello']]
        ])
        done()
      }
    })
  })

  it('maybe save hello into [] should return [hello], 0e96c999', done => {
    writeFileSync([])

    let ds = new DataStore(Object.assign({}, opts, { isArray: true }))
    ds.save(data => data.includes('hello') ? data : [...data, 'hello'], (err, data) => {
      if (err) return done(err)
      expect(data).to.deep.equal(['hello'])
      done()
    })
  })

  it('maybe save hello twice into [] should return [hello], [hello], c511f467', done => {
    writeFileSync([])

    let ds = new DataStore(Object.assign({}, opts, { isArray: true }))
    ds.save(data => data.includes('hello') ? data : [...data, 'hello'], (err, data) => {
      if (err) return done(err)
      expect(data).to.deep.equal(['hello'])
    })
    ds.save(data => data.includes('hello') ? data : [...data, 'hello'], (err, data) => {
      if (err) return done(err)
      expect(data).to.deep.equal(['hello'])
      done()
    })
  })

  it('maybe save hello into [hello] should return [hello], c1ba0985', done => {
    writeFileSync(['hello'])

    let ds = new DataStore(Object.assign({}, opts, { isArray: true }))
    ds.save(data => data.includes('hello') ? data : [...data, 'hello'], (err, data) => {
      if (err) return done(err)
      expect(data).to.deep.equal(['hello'])
      done()
    })
  })

  it('maybe save world into [hello] should return [hello, world], b390b769', done => {
    writeFileSync(['hello'])

    let ds = new DataStore(Object.assign({}, opts, { isArray: true }))
    ds.save(data => data.includes('world') ? data : [...data, 'world'], (err, data) => {
      if (err) return done(err)
      expect(data).to.deep.equal(['hello', 'world'])
      done()
    })
  })

  it('maybe save world into [hello] twice should return [hello, word], [hello world], 03fc7ce2', done => {
    writeFileSync(['hello'])

    let ds = new DataStore(Object.assign({}, opts, { isArray: true }))
    ds.save(data => data.includes('world') ? data : [...data, 'world'], (err, data) => {
      if (err) return done(err)
      expect(data).to.deep.equal(['hello', 'world'])
    })
    ds.save(data => data.includes('world') ? data : [...data, 'world'], (err, data) => {
      if (err) return done(err)
      expect(data).to.deep.equal(['hello', 'world'])
      done()
    })
  }) 

})
