const spawn = require('child_process').spawn

const Magic = require('./magic')
// const ExifTool = require('./exiftool')
const exiftool = require('./exiftool2')
const { readXstat } = require('./xstat')

const extract = (filePath, magic, hash, uuid, callback) => {

  let destroy = null
  let destroyed = false

  if (!Magic.isMedia(magic)) {
    return process.nextTick(() => callback(new Error('magic is not a supported media type')))
  }

  readXstat(filePath, (err, xstat) => {
    if (destroyed) return
    if (err) return callback(err)
    if (xstat.type !== 'file') return callback(new Error('not a file'))
    if (xstat.uuid !== uuid) return callback(new Error('uuid mismatch'))
    if (xstat.hash !== hash) return callback(new Error('fingerprint mismatch'))

/**
    et = new ExifTool(filePath, magic)

    et.on('finish', err => {
      if (destroyed) return 
      let metadata = et.metadata
      et = null
      callback(err, metadata)
    })
**/
    destroy = exiftool(filePath, magic, (err, metadata) => (destroy = null, callback(err, metadata)))

  })

  return {
    destroy: function () {
      if (destroyed) return
      destroyed = true
      if (destroy) {
        destroy()
        destroy = null
      }
/**
      if (et) {
        et.destroy()
        et = null
      }
**/
    }
  }
}

module.exports = extract
