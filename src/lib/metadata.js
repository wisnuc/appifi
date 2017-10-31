const spawn = require('child_process').spawn

const identify = require('./identify2')
const ExifTool = require('./exiftool')
const { readXstat } = require('./xstat')

const extractMetadata = (filePath, magic, hash, uuid, callback) => {
  if (magic === 'JPEG') {
    identify(filePath, hash, uuid, callback)
  } else {
    process.nextTick(() => callback('unsupported magic type'))
  }
}

// module.exports = extractMetadata

const magicIsMedia = magic => 
  magic === 'JPEG' ||
  magic === 'PNG' ||
  magic === 'GIF' ||
  magic === '3GP' ||
  magic === 'MP4' ||
  magic === 'MOV'

const xtractMetadata = (filePath, magic, hash, uuid, callback) => {

  let et
  let destroyed = false

  if (!magicIsMedia(magic)) {
    return process.nextTick(() => callback(new Error('magic is not a supported media type')))
  }

  readXstat(filePath, (err, xstat) => {
    if (destroyed) return
    if (err) return callback(err)
    if (xstat.type !== 'file') return callback(new Error('not a file'))
    if (xstat.uuid !== uuid) return callback(new Error('uuid mismatch'))
    if (xstat.hash !== hash) return callback(new Error('fingerprint mismatch'))

    et = new ExifTool(filePath, magic)
    et.on('finish', err => {
      let metadata = et.metadata
      et = null
      callback(err, metadata)
    })
  })

  return {
    destroy: function () {
      if (destroyed) return
      destroyed = true
      if (et) {
        et.destroy()
        et = null
      }
    }
  }
}

module.exports = xtractMetadata
