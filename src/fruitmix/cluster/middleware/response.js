/**
 * Created by jianjin.wu on 2017/3/22.
 *
 */

const DEFAULT_SUCCESS_STATUS = 200
const DEFAULT_ERROR_STATUS = 500

//http code
const httpCode = {
  400: 'EINVAL',
  404: 'ENOENT'
}

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
        code = httpCode[status]

      }
    }
    status = status || DEFAULT_ERROR_STATUS

    return res.status(status).json({
      code: code || 'no httpCode',
      message: message || 'system error',
      stack: stack
    })
  }

  next()
}