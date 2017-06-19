const Promise = require('bluebird')
const path = require('path')
const http = require('http')
const querystring = require('querystring')

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

  let finished = false

  const options = {

    hostname: '127.0.0.1',
    port: 4005,
    path: '/upload?' + quertystring.stringify(query),
    method: 'PUT'
  }

  const request = http.request(options, response => {

    if (finished) return

    response.setEncoding('utf8')

    response.on('error', err => { 

      if (finished) return
      finished = true

      // this is a transmission error or malformatted response
      // pretending that we do not have statusCode
      callback(err)
    })

    response.on('end', () => {

      if (finished) return
      finished = true    
  
      callback(null, response.statusCode)
    })
  })

  request.on('error', err => {
    
    if (finished) return
    finished = true

    callback(err)
  })

  request.on('abort', () => {

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

