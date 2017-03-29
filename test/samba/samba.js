const path = require('path')
const { expect } = require('chai')

const getPrependPath = require('../../src/samba/prependPath.js')

describe(path.basename(__filename), () => {
  it('should get the path name', () => {
    let result = getPrependPath()
    expect(result).to.equal('/home/testonly')
  })
})