const debug = require('debug')('sorted-map')

/**
Each element in the array is an object with {
  key: 
  queue: []
}

*/
class SortedMap {
  constructor () {
    this.array = []
  }

  binaryIndexOf (key) {
    let minIndex = 0
    let maxIndex = this.array.length - 1
    let currentIndex
    let currentKey

    while (minIndex <= maxIndex) {
      currentIndex = (minIndex + maxIndex) / 2 | 0
      currentKey = this.array[currentIndex].key

      if (currentKey < key) {
        minIndex = currentIndex + 1
      } else if (currentKey > key) {
        maxIndex = currentIndex - 1
      } else {
        return currentIndex
      }
    }

    return this.array.length
  }

  insert (key, val) {
    let index = this.binaryIndexOf(key)

    if (this.array[index] && this.array[index].key === key) {
      this.array[index].queue.push(val)
    } else {
      this.array.splice(index, 0, { key, queue: [val] })
    }

    debug(this.array)
    return this
  }

  remove (key, val) {
    let kIndex = this.binaryIndexOf(key)
    if (this.array[kIndex].key !== key) return // bad key

    let q = this.array[kIndex].queue
    let vIndex = q.indexOf(val)
    if (vIndex === -1) return // bad val

    q.splice(vIndex, 1)
    if (q.length === 0) this.array.splice(kIndex, 1)

    debug(this.array)
    return this
  }
}

module.exports = SortedMap
