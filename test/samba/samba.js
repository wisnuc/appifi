const path = require('path')
const { expect } = require('chai')

const getPrependPath = require('../../src/samba/prependPath.js')

describe(path.basename('../../src/samba/prependPath.js'), () => {

  // ./node_modules/.bin/mocha --opts ./test/samba/mocha.opts ./test/samba/samba.js
  it('should succeed when path name is correct', () => {
    let result = getPrependPath()
    expect(result).to.equal('/home/testonly')
  })

  it('should fail when path name is not correct', () => {
    let result = getPrependPath()
    expect(result).to.not.equal('/home/abc')
  })

})