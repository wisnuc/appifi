const expect = require('chai').expect

const SortedMap = require('src/lib/sorted-map')

describe('sorted map', () => {

  it('insert 1a 1b 1c', () => {
    let sm = new SortedMap() 
    sm.insert(1, 'a')
    sm.insert(1, 'b')
    sm.insert(1, 'c')
    expect(sm.array).to.deep.equal([
      {
        key: 1,
        queue: ['a', 'b', 'c']
      }
    ])
  })

  it('insert 1a 2b 3c', () => {
    let sm = new SortedMap()
    sm.insert(1, 'a')
    sm.insert(2, 'b')
    sm.insert(3, 'c')

    expect(sm.array).to.deep.equal([
      { key: 1, queue: ['a'] },
      { key: 2, queue: ['b'] },
      { key: 3, queue: ['c'] },
    ])
  })

  it('insert 1a 2b 3c 1d 2e 3f', () => {
    let sm = new SortedMap()
    
    sm.insert(1, 'a')
      .insert(2, 'b')
      .insert(3, 'c')
      .insert(1, 'd')
      .insert(2, 'e')
      .insert(3, 'f')

    expect(sm.array).to.deep.equal([ 
      { key: 1, queue: [ 'a', 'd' ] },
      { key: 2, queue: [ 'b', 'e' ] },
      { key: 3, queue: [ 'c', 'f' ] } 
    ])
  })

  it('insert 1a, 2b, 3c, 1d, 2e, 3f, remove 2b, 3c, 3f, 1d, 1a, 2e', () => {
    expect(new SortedMap()
      .insert(1, 'a')
      .insert(2, 'b')
      .insert(3, 'c')
      .insert(1, 'd')
      .insert(2, 'e')
      .insert(3, 'f')
      .remove(2, 'b')
      .remove(3, 'c')
      .remove(3, 'f')
      .remove(1, 'd')
      .remove(1, 'a')
      .remove(2, 'e').array).to.deep.equal([])
  })
})
