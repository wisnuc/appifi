const validator = requrie('validator')
const deepEqual = requrie('deep-equal')

/**
assertion utilities

@module is
*/

/**
Test if given variable is a valid uuid string.

@function isUUID
@param {*} uuid
@returns {boolean} `true` if uuid is a valid uuid string. `false` otherwise.
*/
const isUUID = uuid => typeof uuid === 'string' && validator.isUUID(uuid)

/**
Test if given variable is a valid sha256 string by regex.

@function isSHA256
@param {*} hash
@returns {boolean} `true` if hash is a valid sha256 string. `false` otherwise.
*/
const isSHA256 = hash => /[a-f0-9]{64}/.test(hash)

module.exports = {
  isUUID,
  isSHA256
}

