const Promise = require('bluebird')
const path = require('path')
const http = require('http')
const querystring = require('querystring')
const formidable = require('formidable')
const UUID = require('uuid')


/**

*/
const formdata = (req, res, next) => {

  if (!req.is('multipart/form-data'))
    return res.status(403).json({ message: 'this api accepts only formdata' })

  if (!req.formdata || !req.formdata.filePath) 
    return res.status(500).json({ message: 'formdata or formdata.filePath unset' })

  let finished
  let fileName, size, sha256
  let form = new formidable.IncomingForm()

  form.on('field', (key, value) => {

    switch (key) {
    case 'size':
      size = parseInt(value) // TODO
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

    if (!size) {
    }

    if (!sha256) {
    }
      
    const options = { 
      hostname: '127.0.0.1',
      port: 4005,
      path: '/upload?' + querystring.stringify({ path: req.formdata.filePath }), 
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

        let data
        try {
          data = JSON.parse(text) 
        }
        catch (e) {
          return res.status(500).json({ message: 'sidekick response parse error' })
        }

        if (data.size !== size) 
          return res.status(402).json({ message: 'size does not match' })

        if (data.sha256 !== sha256)
          return res.status(400).json({ message: 'hash does not match' })

        req.formdata.fileName = part.filename
        req.formdata.size = size
        req.formdata.sha256 = sha256

        next()
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
      console.log('formdata part error', err)
    })
  }

  form.parse(req) 
}

module.exports = formdata
