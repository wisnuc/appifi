const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const expect = require('chai').expect

const find = require('src/fruitmix/nfs/find')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

const findAsync = Promise.promisify(find)

describe(path.basename(__filename), () => {
  describe('ad hoc, d1/d2/d3', () => {

    beforeEach(async () => {
      await rimrafAsync(tmptest)
      await mkdirpAsync(path.join(tmptest, 'd1', 'd2', 'd3'))
    })

    it('d1/d2/d3, all', async () => {
      let result = await findAsync(tmptest, 'd', 400, null)
      console.log(result)
    })

    it ('d1/d2/d3, 36771f9e', async () => {
      let result 

      result = await findAsync(tmptest, 'd', 1, null)
      console.log('1', result)

      console.log(result.pop())

      result = await findAsync(tmptest, 'd', 1, { type: 'directory', namepath: ['d9'] })
      console.log('2', result)

      result = await findAsync(tmptest, 'd', 1, result.pop())
      console.log('3', result)
    })
  })
})
