class SortedArray {
  constructor () {
    this.array = []
    Object.defineProperty(this, 'length', {
      get () {
        return this.array.length
      }
    })
  }

  compare (x, y) {
    if (x.getTime() < y.getTime()) return -1
    if (x.getTime() > y.getTime()) return 1
    return x.uuid.localeCompare(y.uuid)
  }

  // return the smallest index that is equal to or greater than given item
  // if all items are smaller than the given one, return array.length
  indexOf (file) {
    let min = 0
    let mid = 0
    let max = this.array.length - 1
    while (min <= max) {
      mid = Math.floor((min + max) / 2)
      let c = this.compare(file, this.array[mid])
      if (c < 0) {
        max = mid - 1
      } else if (c > 0) {
        min = mid + 1
      } else {
        return mid // found
      }
    }

    if (this.array.length === 0 || this.compare(file, this.array[mid]) < 0) {
      return mid
    } else {
      return mid + 1
    }
  }

  // TODO this may be replaced by defining time property (getter) for file
  indexOfByKey (time, uuid) {
    let file = { 
      time, 
      uuid, 
      getTime: function () {
        return this.time
      } 
    }

    return this.indexOf(file)
  }

  insert (file) {
    let index = this.indexOf(file)
    // this, of course, won't happen in normal case
    if (this.array[index] === file) {
      console.log(file)
      throw new Error('sorted array, insert, file already in indices')
    } else {
      this.array.splice(index, 0, file)
    }
  }

  remove (file) {
    let index = this.indexOf(file)
    if (this.array[index] !== file) {
      console.log(file)
      throw new Error('sorted array, remove, file is not in indices')
    } else {
      this.array.splice(index, 1)
    }
  }
}

module.exports = SortedArray
