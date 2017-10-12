const E = {}

/** This is ES6 version 
babel does not properly implement instanceof, though node without babel works
now using ES5 as workaround
*/
const EClass = (code, message) => {
  return class extends Error {
    constructor(m = message) {
      super(m)
      this.code = code
    }
  }
}

/*
// This is ES5 version
const EClass = (code, message) => {

  let f = function (m = message) {
    this.code = code
  }

  f.prototype = Object.create(Error.prototype)
  f.prototype.constructor = f

  return f
}
*/

const define = (code, message) => (E[code] = EClass(code, message))

define('EINVAL', 'invalid parameters')
define('EACCESS', 'access denied')
define('EFORMAT', 'bad format')
define('EABORT', 'aborted')
define('ENOTDIR', 'not a directory')
define('ENOTFILE', 'not a regular file')
define('ENOTDIRFILE', 'not a directory or a regular file')
define('EINSTANCE', 'instance changed')
define('ECONTENT', 'content changed (digest mismatch)')
define('ETIMESTAMP', 'timestamp changed during operation')
define('EEXITCODE', 'exit with error code')
define('EEXITSIGNAL', 'exit with signal')
define('EEXIST', 'exit with exist')
define('ENOENT', 'no entry')
define('ELOCK', 'lock error')
define('EPARSE', 'parse error')
define('EHEAD', 'head mismatch')

define('ENODENOTFOUND', 'node not found')     // be different from ENOENT, which is easily confused with fs error, TODO not sure if this is the right design
define('ENODEDETACHED', 'node is detached')   // 

module.exports = Object.freeze(E)

