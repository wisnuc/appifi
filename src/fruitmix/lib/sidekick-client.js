const Promise = require('bluebird')
const path = require('path')
const http = require('http')
const querystring = require('querystring')
const debug = require('debug')('sidekick-client')

/**
This is the sidekick client.

@module sidekickClient
*/

/**
This callback is displayed as part of the Requester class.

```
// http code -> error code
// 200  ->  no error
// 400  ->  EINVAL
// 409  ->  EMISMATCH
// 500  ->  no special error code
```

@callback uploadCallback
@param {object} err
@param {err.code} - translated http error code.
@param {object} body - res.body.
*/

/**
callback returns error or status code.

It provides `abort` method. When aborted, the callback receives an error with `EABORT` error code.

@param {object} query
@param {string} query.path - must be an absolute path
@param {number} query.size - expected size
@param {string} [query.sha256] - if provided, the sha256 will checked.
@param {number} [query.offset] - if provided, it is uploading a file chunk.
@param {module:sidekickClient~uploadCallback} callback - `(err, obj) => {}`
*/
const upload = (query, callback) => {

  debug('sidekick query', query)

  let finished = false

  const options = {

    hostname: '127.0.0.1',
    port: 4005,
    path: '/upload?' + querystring.stringify(query),
    method: 'PUT'
  }

  const request = http.request(options, response => {

    debug(`sidekick response statusCode ${response.statusCode}`, finished)

    if (finished) return
    finished = true

    return callback(null, response.statusCode)
  })

  request.on('error', err => {

    debug('sidekick request abort', finished)
   
    if (finished) return
    finished = true
    callback(err)
  })

  request.on('abort', () => {

    debug('sidekick request abort', finished)

    if (finished) return
    finished = true

    let err = new Error('aborted')
    err.code = 'EABORT'
    callback(err)
  })

  return request
}

module.exports = {
  upload,
  uploadAsync: Promise.promisify(upload)
}

