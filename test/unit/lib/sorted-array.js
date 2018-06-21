const path = require('path')
const expect = require('chai').expect

const SortedArray = require('src/lib/sorted-array')

class FakeFile {
  constructor (time, uuid) {
    this.time = time
    this.uuid = uuid
    this.name = time
  }

  getTime () {
    return this.time
  }
}

describe(path.basename(__filename), () => {
  describe('basic', () => {
    const data1 = [
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
      [4, 'd'],
      [5, 'e'],
      [6, 'f']
    ]

    it('indexOf 1a for [] should return 0', done => {
      let sa = new SortedArray()
      let ff = new FakeFile(1, 'a')
      expect(sa.indexOf(ff)).to.equal(0)
      done()
    })

    it('indexOf 1a for [2b] should return 0', done => {
      let sa = new SortedArray()
      sa.array.push(new FakeFile(2, 'b'))
      let ff = new FakeFile(1, 'a')
      expect(sa.indexOf(ff)).to.equal(0)
      done()
    })

    it('indexOf 2a for [2b] should return 0', done => {
      let sa = new SortedArray()
      sa.array.push(new FakeFile(2, 'b'))
      let ff = new FakeFile(2, 'a')
      expect(sa.indexOf(ff)).to.equal(0)
      done()
    })

    it('indexOf 2b for [2b] should return 0', done => {
      let sa = new SortedArray()
      sa.array.push(new FakeFile(2, 'b'))
      let ff = new FakeFile(2, 'b')
      expect(sa.indexOf(ff)).to.equal(0)
      done()
    })

    it('indexOf 2c for [2b] should return 1, 833e639f', done => {
      let sa = new SortedArray()
      sa.array.push(new FakeFile(2, 'b'))
      let ff = new FakeFile(2, 'c')
      expect(sa.indexOf(ff)).to.equal(1)
      done()
    })

    it('indexOf 3a for [2b] should return 1', done => {
      let sa = new SortedArray()
      sa.array.push(new FakeFile(2, 'b'))
      let ff = new FakeFile(2, 'c')
      expect(sa.indexOf(ff)).to.equal(1)
      done()
    })

    it('indexOf 1a for [] should return 0, 041ee9ba', done => {
      let sa = new SortedArray() 
      sa.array.push(new FakeFile(1, 'a'))
      let ff = new FakeFile(2, 'b')
      expect(sa.indexOf(ff)).to.equal(1)
      done()
    })

    it('indexOf 3c for [1a, 2b] should return 2, 0ae168f7', done => {
      let sa = new SortedArray()
      sa.array.push(new FakeFile(1, 'a'))
      sa.array.push(new FakeFile(2, 'b'))
      let ff = new FakeFile(3, 'c')
      expect(sa.indexOf(ff)).to.equal(2)
      done()
    })

    it('insert data1 sequentially, 30a4ca71', done => {
      let sa = new SortedArray()
      data1.forEach(data => sa.insert(new FakeFile(data[0], data[1])))
      expect(sa.array.map(ff => [ff.time, ff.uuid])).to.deep.equal(data1)
      done()
    })

    it('insert data1 sequentially then remove all', done => {
      let sa = new SortedArray()
      let files = data1.map(data => new FakeFile(data[0], data[1]))
      files.forEach(file => sa.insert(file))
      files.forEach(file => sa.remove(file))
      expect(sa.array).to.deep.equal([])
      done()
    })

    it('insert data1 sequentially, reversed order', done => {
      let sa = new SortedArray()
      let files = data1.map(data => new FakeFile(data[0], data[1]))
      files.reverse().forEach(file => sa.insert(file))
      expect(sa.array.map(ff => [ff.time, ff.uuid])).to.deep.equal(data1)
      done()
    })
  })

  describe('random 1000 times', () => {
    for (let i = 0; i < 1000; i++) {
      it (`random ${i}`, done => {
        const randomInt = max => Math.floor(Math.random() * Math.floor(max))
        const data1 = 'abcdefghijklmnopqrstuvwxyz'.split('').map(c => [randomInt(10), c])

        let sa = new SortedArray()
        let files = data1.map(d => new FakeFile(d[0], d[1]))
        files.forEach(f => sa.insert(f))

        // console.log(sa.array)

        files.forEach(f => sa.remove(f))
        expect(sa.array).to.deep.equal([])
        done()
      })
    }
  }) 
})

