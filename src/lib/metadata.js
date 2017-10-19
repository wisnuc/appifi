const identify = require('./identify2')

const extractMetadata = (filePath, magic, hash, uuid, callback) => {

  console.log('extractMetadata', filePath, magic, hash, uuid)

  if (magic === 'JPEG') {
    identify(filePath, hash, uuid, callback)
  } else {
    process.nextTick(() => callback('unsupported magic type'))
  }
}

module.exports = extractMetadata
