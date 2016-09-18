class FlyWeightList {

  constructor() {

    this.array = []
    this.array.push('*')
    this.array.push([])

    this.map = new Map()
  }

  // allowed input: *, [], or [uuid...]
  getIndex(userlist) {

    if (userlist === '*') return 0
    if (Array.isArray(userlist) && !userlist.length) return 1
    
    let dedup = [...userlist].sort()
      .filter((item, index, array) => 
        !index || item !== array[index - 1])

    let join = dedup.join()

    let index = this.map.get(join) 
    if (index !== undefined) return index
  
    index = this.array.length

    // dedup is freezed
    // user who retrieves it later cannot modify it
    Object.freeze(dedup)

    this.array.push(dedup)
    this.map.set(join, index)
    return index
  }

  // return undefined if index out-of-range
  getList(index) {
    if (index >= this.array.length) return
    return this.array[index]
  }
}

export default FlyWeightList
