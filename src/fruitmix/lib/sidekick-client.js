const Promise = require('bluebird')
const path = require('path')
const http = require('http')
const querystring = require('querystring')
const debug = require('debug')('sidekick-client')

/**
This is the sidekick client.

@module sidekick-client
*/

/**
callback returns error or status code.

It provides `abort` method. When aborted, the callback receives an error with `EABORT` error code.

@param {object} query
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
  upload
}

