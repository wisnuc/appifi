const Promise = require('bluebird')
const path = require('path')
const http = require('http')
const querystring = require('querystring')
const formidable = require('formidable')
const UUID = require('uuid')

const { isSHA256, isUUID, isNonNullObject, isNormalizedAbsolutePath } = require('../lib/assertion')
const sidekick = require('../lib/sidekick-client')

/**
This middleware accepts incoming multipart/form-data and saves data as a whole file or as a chunk in file.

This middleware requires pre-defined `req.formdata` to work. It must contain the following properties:

+ `path`: mandatory, a normalized absolute path
+ `offset`: optional, if provided, incoming data is saved as file chunk.

The incoming data must contain the following fields:

+ `size`: data size
+ `sha256`: data hash
+ `filename`: it seems that form-data always has this field for a file part. It is just recorded and not used.

During transmission, both size and sha256 are validated. The middleware succeed if and only if there's no any error and both value match.

If succeeded, the middleware updates `req.formdata` to the following format:

```
{
  path: '/absolute/file/path',        // predefined
  offset: 123456,                     // predefined, start position in byte, optional

  size: 1234,                         // file or file chunk size in byte
  sha256: 'hash string',              // file or file chunk hash, in lowercase
  filename: 'posted file name',       // just recorded, no promise
}
```

WARNING: formidable does not deal with request abort specially.

IncomingForm throws error when request aborted, so there is no need to do it ourselves.

IncomingForm is a super state resource and part is a sub state one. 

Ideally, form layer should trigger part layer's exit (by emitting error) and have no knowledge about the part layer resource, when exiting.

However, formidable is not designed this way. So we can only think both form and part are in the same layer, and sidekick request is the resource in this layer.

The good news is Node/Express response can be called harmlessly AFTER request is aborted. This is easier for programmer but not a clear way.
*/
const formdata = (req, res, next) => {

  if (!req.is('multipart/form-data'))
    return res.status(403).json({ message: 'this api accepts only formdata' })

  if (!isNonNullObject(req.formdata))
    return res.status(500).json({ message: 'formdata is not a non-null object' })

  if (!isNormalizedAbsolutePath(req.formdata.path)) 
    return res.status(500).json({ message: 'formdata.path is not a normalized absolute path' })

  let offset

  if (req.formdata.hasOwnProperty('offset')) {

    offset = req.formdata.offset
    if (!Number.isInteger(offset) || offset < 0 || offset > 1024 * 1024 * 1024 * 1024) 
      return res.status(500).json({ message: 'formdata offset invalid' })
  }
  
  let finished

  let filename, size, sha256, upload
  let form = new formidable.IncomingForm()

  let error = err => {
    
    if (finished) return
    finished = true

    if (upload) upload.abort()
    res.status(500).json({ code: err.code, message: err.message })
  }

  form.on('field', (key, value) => {

    if (finished) return

    switch (key) {
    case 'size':

      size = parseInt(value)

      if (!Number.isInteger(size) || size < 1 || size > 1024 * 1024 * 1024 * 1024) {
        finished = true 
        return res.status(400).json({ message: 'invalid size' })        
      }

      break

    case 'sha256':

      sha256 = value

      if (!isSHA256(value)) {
        finished = true
        return res.status(400).json({ message: 'invalid sha256' })
      }

      break

    default:

      console.log('formdata, unexpected key value', key, value)
      break
    }
  })

  form.onPart = function(part) {

    if (finished === true) return

    // let formidable handle all non-file parts
    if (!part.filename) return form.handlePart(part)

    if (!size  || !sha256) {

      finished = true
      return res.status(400).json({ message: 'size and sha256 must be provided before uploading file data' })
    }

    let opts = { path: formdata.path, size, sha256 }

    if (offset !== undefined) opts.offset = offset   
 
    upload = sidekick.upload(opts, (err, status) => {
      
      if (finished) return 
      finished = true

      if (!err && status >= 200 && status < 300) {

        req.formdata.size = size  
        req.formdata.sha256 = sha256
        req.formdata.filename = filename 

        if (offset) req.formdata.offset = offset 

        next()
      }
      else if (!err && status >= 400 && status < 500) {
        res.status(status).end()
      }
      else {
        res.status(500).end()
      }
    })

    part.on('data', function(data) {

      if (finished) return
      upload.write(data)
    })

    part.on('end', function() {

      if (finished) return
      upload.end()
    })

    part.on('error', error)
  }

  form.on('error', error)
  form.parse(req) 
}

module.exports = formdata

