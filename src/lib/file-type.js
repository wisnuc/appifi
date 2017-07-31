const fs = require('fs')
const readChunk = require('read-chunk')
const fileType = require('file-type')

module.exports = (fpath, callback) => 
  readChunk(fpath, 0, 4100)
    .then(buf => callback(null, fileType(buf)))
    .catch(e => callback(e))



