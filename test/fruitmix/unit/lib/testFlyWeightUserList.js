import path from 'path'

import { expect } from 'chai'

import FlyWeight from 'src/fruitmix/lib/flyweightUserList'


describe(path.basename(__filename), function() {

  let list
  const uuid1 = '5da92303-33a1-4f79-8d8f-a7b6becde6c3'
  const uuid2 = 'b9aa7c34-8b86-4306-9042-396cf8fa1a9c'
  const uuid3 = 'f97f9e1f-848b-4ed4-bd47-1ddfa82b2777'

  beforeEach(function() {
    list = new FlyWeight()
  })

  it('should return index 0 for wildcard (*)', function() {
    expect(list.getIndex('*')).to.equal(0)
  })

  it('should return index 1 for empty array []', function() {
    expect(list.getIndex([])).to.equal(1)
  })

  it('should sort userlist / uuid array', function() {
    let index = list.getIndex([uuid3, uuid2, uuid1]) 
    expect(list.getList(index)).to.deep.equal([uuid1, uuid2, uuid3])
  })

  it('should undupe userlist / uuid array', function() {
    let index = list.getIndex([uuid2, uuid1, uuid2, uuid3, uuid1, uuid3])
    expect(list.getList(index)).to.deep.equal([uuid1, uuid2, uuid3])
  })

  it('should return the same index for normalized equal array', function() {
    let index1 = list.getIndex([uuid2, uuid1, uuid2, uuid3])
    let index2 = list.getIndex([uuid1, uuid3, uuid2])
    expect(index1).to.equal(index2)
  })
})

