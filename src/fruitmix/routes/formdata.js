const Promise = require('bluebird')
const path = require('path')
const http = require('http')
const querystring = require('querystring')
const formidable = require('formidable')
const UUID = require('uuid')

const formdata = (req, callback) => {

  let finished
  let filename, size, sha256
  let form = new formidable.IncomingForm()

  form.on('field', (key, value) => {

    switch (key) {
    case 'size':
      size = value // TODO FIXME
      break
    case 'sha256':
      sha256 = value
      break
    default:
      // TODO log
      break
    }
  })

  form.onPart = function(part) {

    // let formidable handle all non-file parts
    if (!part.filename) return form.handlePart(part)

    filename = part.filename

    const options = { 
      hostname: '127.0.0.1',
      port: 4005,
      path: '/upload?' + querystring.stringify({ path: `/home/wisnuc/appifi/tmptest/${UUID.v4()}` }), 
      method: 'PUT',
    }

    const request = http.request(options, response => {

      console.log(`STATUS: ${response.statusCode}`)

      let text = ''

      response.setEncoding('utf8')
      response.on('data', chunk => {
        text += chunk
      })  
      response.on('end', () => {
        try {
          callback(null, JSON.parse(text)) 
        }
        catch (e) {
          callback(e)
        }
      })  
    })

    request.on('error', (e) => {
      console.error(`problem with request: ${e.message}`)
    })

    part.on('data', function(data) {
      request.write(data)
    })

    part.on('end', function() {
      request.end()
    })

    part.on('error', function(err) {

    })

  }

  form.parse(req) 
}

module.exports = formdata
