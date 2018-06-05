const debug = require('debug')('sorted-map')

/**
Each element in the array is an object with {
  time:  
  uuid: 
  file: a file object
}

*/
class SortedMap {
  constructor () {
    this.array = []
  }

  // key is an array [
  binaryIndexOf (key1, key2) {
    let i, k1, k2

    for (let min = 0, max = this.array.length - 1; 
      (k1 !== key1 && k2 !== key2) && min <= max; 
      min = (k1 < key1 || (k1===key1 && k2.localeCompare(key2) === -1)) ? i + 1 : min, 
      max = (k1 > key1 || (k1 === key1 && k2.localeCompare(key2) === 1)) ? i - 1 : max) { 
      i = (min + max) / 2 | 0
      k1 = this.array[i].key1,
      k2 = this.array[i].key2
    }

    return (k1 === key1 && k2 === key2) ? i : this.array.length
  }

  insert (key1, key2, val) {
    let index = this.binaryIndexOf(key)

    if (this.array[index] && this.array[index].key === key) {
      this.array[index].queue.push(val)
      // TODO
      // this.array[index].queue.sort((a, b) => 
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
