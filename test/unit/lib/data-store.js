const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

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

  it('should arrive @ Idle with null if file does not exist, object', done => {
    let ds = new DataStore(opts)
    ds.once('Update', (data, oldData) => {
      expect(data).to.be.null
      expect(oldData).to.be.undefined
      expect(ds.state.constructor.name).to.equal('Idle')
      done()
    })
  }) 

  it('should arrive @ Idle with null if file does not exist, array', done => {
    let ds = new DataStore(Object.assign({}, opts, { isArray: true}))
    ds.once('Update', (data, oldData) => {
      expect(data).to.deep.equal([])
      expect(oldData).to.be.undefined
      expect(ds.stateName()).to.equal('Idle')
      done()
    })
  }) 

  it("should save { hello: 'world' }, object", done => {
    let ds = new DataStore(opts) 
    ds.once('Update', () => {
      ds.save({ hello: 'world' }, err => {
        if (err) return done(err)
        expect(ds.stateName()).to.equal('Idle')
        let readback = JSON.parse(fs.readFileSync(opts.file))
        expect(readback).to.deep.equal({ hello: 'world' })
        done()
      })
    })
  })

  it("save twice right after loaded (@Idle), object", done => {
    let ds = new DataStore(opts)
    ds.once('Update', () => {

      expect(ds.stateName()).to.equal('Idle')

      ds.save({ hello: 'world' }, err => {
        if (err) return done(err)
        // this assumes the ds goes to next state aggressively
        expect(ds.stateName()).to.equal('Saving')
        let readback = JSON.parse(fs.readFileSync(opts.file))
        expect(readback).to.deep.equal({ hello: 'world' })
      })

      expect(ds.stateName()).to.equal('Saving')
  
      ds.save({ foo: 'bar' }, err => {
        if (err) return done(err)
        // this assumes ds goes to next state aggressively
        expect(ds.stateName()).to.equal('Idle')
        let readback = JSON.parse(fs.readFileSync(opts.file))
        expect(readback).to.deep.equal({ foo: 'bar' })
      })

      expect(ds.stateName()).to.equal('Saving')
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

  it("should twice right after loaded (@Loading), object", done => {
    let ds = new DataStore(opts)
    ds.save({ hello: 'world' }, err => {
      if (err) return done(err)
      // this assumes the ds goes to next state aggressively
      expect(ds.stateName()).to.equal('Saving')
      let readback = JSON.parse(fs.readFileSync(opts.file))
      expect(readback).to.deep.equal({ hello: 'world' })
    })

    expect(ds.stateName()).to.equal('Loading')

    ds.save({ foo: 'bar' }, err => {
      if (err) return done(err)
      // this assumes ds goes to next state aggressively
      expect(ds.stateName()).to.equal('Idle')
      let readback = JSON.parse(fs.readFileSync(opts.file))
      expect(readback).to.deep.equal({ foo: 'bar' })
    })

    expect(ds.stateName()).to.equal('Loading')

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

})

