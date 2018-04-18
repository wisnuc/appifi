const path = require('path')
const validator = require('validator')

/**
assertion utilities

@module assertion
@todo add tests (priority low).
*/

/**
Throw an error with given message if given predicate evaluates to false 

@function assert
@param {*} predicate - an expression that should evaluates to true
@param {string} message - message 
*/
const assert = (predicate, message) => {
  if (!predicate) throw new Error(message);
}

/**
Test if given variable is a valid uuid string (lowercase only).

@function isUUID
@param {*} uuid
*/
const isUUID = uuid => typeof uuid === 'string' && /[a-f0-9\-]/.test(uuid) && validator.isUUID(uuid)

const assertUUID = (uuid, name) => {
  if (!isUUID(uuid)) throw new Error(`${name} is not a valid uuid string`)
}

/**
Test if given variable is a valid sha256 string by regex (lowercase only).

@function isSHA256
@param {*} hash
*/
const isSHA256 = hash => /[a-f0-9]{64}/.test(hash)

/**
Test if given array contains distinct items.

@function isDistincArray
@param {Array}
*/
const isDistinctArrray = arr => new Set(arr).size === arr.length

/**
Test if given array contains distinct uuid strings.
@function isDistinctUUIDArray
@param {string[]} arr
*/
const isUniqueUUIDArray = arr => unique(arr) && (arr.every(i => isUUID(i)) || arr.length === 0)

/**
Test if the two given array are equal

@function isArrayEqual
@param {Array} arr1
@param {Array} arr2
*/
const isArrayEqual = (arr1, arr2) => arr1.length === arr2.length
  && arr1.every((item, index) => item === arr2[index])


/**
Test if given argument is a non-null object

@function isNonNullObject
@param {*} arg
*/
const isNonNullObject = arg => typeof arg === 'object' && arg !== null

/**
Test if given argument is a non-empty string

@function isNonEmptyString
@param {*} str
*/
const isNonEmptyString = arg => typeof arg === 'string' && arg.length > 0

/**
Union two array as if they are sets

@function unionArray
@param {Array} a
@param {Array} b
@returns {Array} union array (a new array), which contains only distinct items.
*/
const unionArray = (a, b) => Array.from(new Set([...a, ...b]))

/**
Complement two arrays as if they are sets (a - b)

@function complementArray
@param {Array} a
@param {Array} b
*/
const complementArray = (a, b) => a.reduce((acc, c) => b.includes(c) ? acc : [...acc, c], [])

/**
Validate object props (structure)

@function validateProps
@param {Object} obj - object to be validated
@param {string[]} mandatory - an array contains names of mandatory prop
@param {string[]} [optional=[]] - an array contains names of optional prop
@throws Throw error if any argument or object structure invalid
*/
const validateProps = (obj, mandatory, optional = []) => {
  //
  if (typeof obj !== 'object') throw new Error('obj is not an object')
  if (obj === null) throw new Error('obj is null')
  if (!Array.isArray(mandatory)) throw new Error('mandatory is not an array')
  if (!Array.isArray(optional)) throw new Error('optiional is not an array')

  if (complementArray(mandatory, Object.keys(obj)).length !== 0)
    throw new Error('some mandatory props not defined in object')

  if (complementArray(Object.keys(obj), [...mandatory, ...optional]).length !== 0)
    throw new Error('object has props that are neither mandatory nor optional')
}

const isNormalizedAbsolutePath = abspath => 
  typeof abspath === 'string' && path.isAbsolute(abspath) && path.normalize(abspath) === abspath

const isCIDR = str => {

  if (typeof str !== 'string') return false

  let split = str.split('/')  
  if (split.length !== 2) return false
  if (!validator.isIP(split[0], 4)) return false
  
  let num = parseInt(split[1])
  return Number.isInteger(num) && num >= 0 && num <= 32 && ('' + num === split[1])
}

module.exports = {
  assert,
  validateProps,
  isUUID,
  isSHA256,
  isNonNullObject,
  isNonEmptyString,
  isNormalizedAbsolutePath,
  isCIDR,
  complementArray
}

