const identify = require('./identify2')

const extractMetadata = (filePath, magic, hash, uuid, callback) => {
  if (magic === 'JPEG') {
    identify(filePath, hash, uuid, callback)
  } else {
    process.nextTick(() => callback('unsupported magic type'))
  }
}

module.exports = extractMetadata
