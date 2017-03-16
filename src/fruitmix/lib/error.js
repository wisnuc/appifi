const E = {}

const EClass = (code, message) => 
  class extends Error {
    constructor(m = message) {
      super(m)
      this.code = code
    }
  }

const define = (code, message) => 
  (E[code] = EClass(code, message))

define('EINVAL', 'invalid parameters')
define('EFORMAT', 'bad format')
define('EABORT', 'aborted')
define('ENOTDIR', 'not a directory')
define('ENOTFILE', 'not a regular file')
define('ENOTDIRFILE', 'not a directory or a regular file')
define('EINSTANCE', 'instance changed')
define('ETIMESTAMP', 'timestamp changed during operation')
define('EEXITCODE', 'exit with error code')
define('EEXITSIGNAL', 'exit with signal')
define('ELOCK', 'lock error');

module.exports = Object.freeze(E)

