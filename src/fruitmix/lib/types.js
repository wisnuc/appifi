import validator from 'validator'
import deepEqual from 'deep-equal'

const isUUID = (uuid) => (typeof uuid === 'string' && validator.isUUID(uuid)) ? true : false
const isSHA256 = (hash) => /[a-f0-9]{64}/.test(hash)

const addUUIDArray = (a, b) => {
  let c = Array.from(new Set([...a, ...b]))
  return deepEqual(a, c) ? a :c
}

const complement = (a, b) => 
  a.reduce((acc, c) => 
    b.includes(c) ? acc : [...acc, c], [])

const assert = (predicate, message) => { if(!predicate) throw new Error(message) }



export {
  isUUID,
  isSHA256,
  addUUIDArray,
  complement,
  assert,
}
