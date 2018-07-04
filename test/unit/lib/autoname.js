const path = require('path')

const expect = require('chai').expect

const autoname = require('src/lib/autoname')

describe(path.basename(__filename), () => {

  it('a [a] => a (2)', done => {
    expect(autoname('a', ['a'])).to.equal('a (2)')
    done()
  })

  it('a [a (0)] => a', done => {
    expect(autoname('a', ['a (0)'])).to.equal('a')
    done()
  })

  it('a [a, a (0)] => a (2)', done => {
    expect(autoname('a', ['a', 'a (0)'])).to.equal('a (2)')
    done()
  })

  it('a [a, a (1)] => a (2)', done => {
    expect(autoname('a', ['a', 'a (1)'])).to.equal('a (2)')
    done()
  })

  it('a [a, a (2)] => a (3)', done => {
    expect(autoname('a', ['a', 'a (2)'])).to.equal('a (3)')
    done()
  })

  it('a [a, a (0), a (1), a (4)] => a (5)', done => {
    expect(autoname('a', ['a', 'a (0)', 'a (1)', 'a (4)'])).to.equal('a (5)')
    done()
  })

  it('a [a, a (4), a(100)] => a (5), a(100) has no space', done => {
    expect(autoname('a', ['a', 'a (4)', 'a(100)'])).to.equal('a (5)')
    done()
  })

  it('a [a, a (1024)] => a (1025)', done => {
    expect(autoname('a', ['a', 'a (1024)'])).to.equal('a (1025)')
    done()
  })

  it('a.tar [a.tar, a (2).tar] => [a (3).tar]', done => {
    expect(autoname('a.tar', ['a.tar', 'a (2).tar'])).to.equal('a (3).tar')
    done()
  })

  it('a.tar.gz [a.tar.gz, a (2).tar.gz] => [a (3).tar.gz]', done => {
    expect(autoname('a.tar.gz', ['a.tar.gz', 'a (2).tar.gz'])).to.equal('a (3).tar.gz')
    done()
  })

  it('a.tar.gz [a.tar.gz, a (2).tar.gz, a (5).tar] => [a (3).tar.gz]', done => {
    expect(autoname('a.tar.gz', ['a.tar.gz', 'a (2).tar.gz', 'a (5).tar'])).to.equal('a (3).tar.gz')
    done()
  })

  it('a.tar.gz [a.tar.gz, a (2).tar.gz, a (5).gz] => [a (3).tar.gz]', done => {
    expect(autoname('a.tar.gz', ['a.tar.gz', 'a (2).tar.gz', 'a (5).gz'])).to.equal('a (3).tar.gz')
    done()
  })

})


