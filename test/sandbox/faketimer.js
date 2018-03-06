const path = require('path')
const { expect } = require('chai')
const sinon = require('sinon')

describe(path.basename(__filename), () => {

  let clock
  before(() => clock = sinon.useFakeTimers())
  after(() => clock.restore())

  it('test timeout 200', done => {
    let count = 0
    setTimeout(() => count++, 200)

    clock.tick(100)
    expect(count).to.equal(0)
  
    clock.tick(201)
    expect(count).to.equal(1)

    done()
  })
})
