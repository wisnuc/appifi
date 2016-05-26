import { should, expect, assert } from 'chai'
import sinon from 'sinon'

import appstore from 'lib/appstore'
import { unit } from 'lib/appstore'

import request from 'superagent'

class reqmock {
 
  constructor(url, err, res) {
    this.url = url 
    this.settings = {}
    this.err = err
    this.res = res
  }

  set(key, val) {
    this.settings[key] = val
    return this
  }

  end(f) {
    f(this.err, this.res) 
  }
}

describe('testing lib/appstore retrieveAppList', function() {

  let req, err, res

  beforeEach(function() {
    req = err = res = null
    sinon.stub(request, 'get', function(url) {
      req = new reqmock(url, err, res)
      return req
    })   
  })

  afterEach(function(){
    request.get.restore()
  })

  it('retrieveAppList resolve', function(done) {

    err = null
    res = { text: 'hello' }

    unit.retrieveAppList('testurl')
      .then(r => {
        expect(req.url).to.equal('testurl')
        expect(req.settings['Accept']).to.equal('text/plain')
        expect(r).to.equal('hello')     
        done()
      })
  })

  it('retrieveAppList reject', function(done) {
    
    err = 'failed'

    unit.retrieveAppList('testurl')
      .catch(e => {
        expect(e).to.equal(err)
        done()
      })
  })
})


