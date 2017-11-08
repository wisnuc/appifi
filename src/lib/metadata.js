const spawn = require('child_process').spawn

const Magic = require('./magic')
const ExifTool = require('./exiftool')
const { readXstat } = require('./xstat')

const xtractMetadata = (filePath, magic, hash, uuid, callback) => {

  let et
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

    et = new ExifTool(filePath, magic)

    et.on('finish', err => {
      if (destroyed) return 
      let metadata = et.metadata
      et = null
      callback(err, metadata)
    })
  })

  return {
    destroy: function () {

      let err = new Error('why xtractMetadata destroyed')
      console.log(err)

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
