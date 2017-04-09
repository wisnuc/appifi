/**
 * Created by jianjin.wu on 2017/3/22.
 *
 */

const DEFAULT_SUCCESS_STATUS = 200
const DEFAULT_ERROR_STATUS = 500

//http code
const httpCode = {
  400: 'EINVAL',// invalid parameters
  404: 'ENOTFOUND',// not found
  500: 'ESYSER' // system error
}

// define('EINVAL', 'invalid parameters')
// define('EACCESS', 'access denied')
// define('EFORMAT', 'bad format')
// define('EABORT', 'aborted')
// define('ENOTDIR', 'not a directory')
// define('ENOTFILE', 'not a regular file')
// define('ENOTDIRFILE', 'not a directory or a regular file')
// define('EINSTANCE', 'instance changed')
// define('ECONTENT', 'content changed (digest mismatch)')
// define('ETIMESTAMP', 'timestamp changed during operation')
// define('EEXITCODE', 'exit with error code')
// define('EEXITSIGNAL', 'exit with signal')
// define('ENOENT', 'no entry')
// define('ELOCK', 'lock error')

// define('ENODENOTFOUND', 'node not found')     // be different from ENOENT, which is easily confused with fs error, TODO not sure if this is the right design
// define('ENODEDETACHED', 'node is detached')

export default (req, res, next) => {

  /**
   * add res.success()
   * @param data
   * @param status no required
   */
  res.success = (data, status) => {
    data = data || null
    status = status || DEFAULT_SUCCESS_STATUS
    return res.status(status).json(data)
  }

  /**
   * add res.error()
   * @param err {Error} or {String}
   * @param status no required
   */
  res.error = (err, status) => {

    let code, message, stack

    if (err) {

      if (err instanceof Error) {

        status = status || err.status
        code = err.code
        message = err.message
        stack = err.stack

      } else if (typeof err === 'string') {

        message = err
      }
    }
    
    status = status || DEFAULT_ERROR_STATUS
    code = httpCode[status]

    return res.status(status).json({
      code: code || 'no httpCode',
      message: message || 'system error',
      stack: stack
    })
  }

  next()
}