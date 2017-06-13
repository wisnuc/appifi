import validator from 'validator'
import deepEqual from 'deep-equal'

const isUUID = uuid => typeof uuid === 'string' && validator.isUUID(uuid)
const isSHA256 = hash => /[a-f0-9]{64}/.test(hash)
const unique = arr => new Set(arr).size === arr.length

const addUUIDArray = (a, b) => {
  let c = Array.from(new Set([...a, ...b]))
  return deepEqual(a, c) ? a :c
}

const complement = (a, b) => 
  a.reduce((acc, c) => 
    b.includes(c) ? acc : [...acc, c], [])

const assert = (predicate, message) => { if(!predicate) throw new Error(message) }

const validateProps = (obj, mandatory, optional = []) => {
  if (complement(mandatory, Object.keys(obj)).length !== 0 )
    throw new Error('some mandatory props not defined in object')
  if (complement(Object.keys(obj), [...mandatory, ...optional]).length !== 0)
    throw new Error('object has props that are neither mandatory nor optional')
}

export {
  isUUID,
  isSHA256,
  addUUIDArray,
  complement,
  assert,
  validateProps,
  unique
}

