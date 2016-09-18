import path from 'path'
import { expect } from 'chai'

import { mapXstatToObject } from 'src/fruitmix/lib/util'

describe(path.basename(__filename), function() {

  describe('mapXstatToObject', function() {  

    let xstat = { 
      dev: 2049,
      mode: 16893,
      nlink: 2,
      uid: 1000,
      gid: 1000,
      rdev: 0,
      blksize: 4096,
      ino: 135577,
      size: 4096,
      blocks: 16,
      atime: new Date('2016-06-27T06:36:58.382Z'),
      mtime: new Date('2016-06-27T06:36:58.382Z'),
      ctime: new Date('2016-06-27T06:36:58.382Z'),
      birthtime: new Date('2016-06-27T06:36:58.382Z'),
      uuid: '0924c387-f1c6-4a35-a5db-ae4b7568d5de',
      owner: [ '061a954c-c52a-4aa2-8702-7bc84c72ec84' ],
      writelist: [ '9e7b40bf-f931-4292-8870-9e62b9d5a12c' ],
      readlist: [ 'b7ed9abc-01d3-41f0-80eb-361498025e56' ],
      hash: 'hashhash',
      magic: 'ASCII text',
      abspath: '/home/xenial/Projects/fruitmix/tmptest' 
    }

    it('should return Object for directory', function(done) { 

      let dirXstat = Object.assign({}, xstat, {
        isDirectory: () => true,
        isFile: () => false
      })

      let result = mapXstatToObject(dirXstat)

      expect(result.uuid).to.equal(xstat.uuid)
      expect(result.type).to.equal('folder')
      expect(result.owner).to.deep.equal(xstat.owner)
      xstat.writelist.forEach(w => expect(result.writelist).to.include(w))
      xstat.readlist.forEach(r => expect(result.readlist).to.include(r))
      expect(result.name).to.equal('tmptest')
      expect(result.size).to.be.undefined
      expect(result.hash).to.be.undefined

      done()
    })

    it('should return Object for file', function(done) {

      let fileXstat = Object.assign({}, xstat, {
        isDirectory: () => false,
        isFile: () => true
      })

      let result= mapXstatToObject(fileXstat)

      expect(result.uuid).to.equal(xstat.uuid)
      expect(result.type).to.equal('file')

      expect(result.owner).to.deep.equal(xstat.owner)
      xstat.writelist.forEach(w => expect(result.writelist).to.include(w))
      xstat.readlist.forEach(r => expect(result.readlist).to.include(r))

      expect(result.name).to.equal('tmptest')
      expect(result.mtime).to.equal(xstat.mtime.getTime())
      expect(result.size).to.equal(xstat.size)
      expect(result.hash).to.equal(xstat.hash)
      expect(result.magic).to.equal(xstat.magic)
   
      done() 
    })

    it('should throw error if neither file nor folder', function(done) {

      let otherXstat = Object.assign({}, xstat, {
        isDirectory: () => false,
        isFile: () => false
      })

      expect(mapXstatToObject.bind(null,otherXstat)).to.throw(Error)
      done()
    })
  })
})


