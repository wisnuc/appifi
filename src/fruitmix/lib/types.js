import validator from 'validator'
import deepEqual from 'deep-equal'

const isUUID = (uuid) => (typeof uuid === 'string' && validator.isUUID(uuid)) ? true : false
const isSHA256 = (hash) => /[a-f0-9]{64}/.test(hash)

const addUUIDArray = (a, b) => {
  let c = Array.from(new Set([...a, ...b]))
  return deepEqual(a, c) ? a :c
}

// remove the element in a which already exist in b
const subtractUUIDArray = (a, b) => {
  let aa = [...a]
  let dirty = false

  b.forEach(item => {
    let index = aa.indexOf(item)
    if (index !== -1) {
      dirty = true
      aa.splice(index, 1) 
    }
  }) 
  return dirty ? aa : a
}

const complement = (a, b) => 
  a.reduce((acc, c) => 
    b.includes(c) ? acc : [...acc, c], [])




export {
  isUUID,
  isSHA256,
  addUUIDArray,
  subtractUUIDArray
}
