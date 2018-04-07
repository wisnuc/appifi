const Promise = require('bluebird') 
const path = require('path')

const rimraf = require('rimraf')

const chai = require('chai').use(require('chai-as-promised'))
const sinon = require('sinon')
const expect = chai.expect
const should = chai.should()

const { refresh } = require('src/lib/storage')

describe(path.basename(__filename) + 'ad hoc', () => {

  it('call refresh', done => {
    refresh((err, storage) => {
      console.log(err || JSON.stringify(storage, null, 2))
      done()
    })
  }) 
})
