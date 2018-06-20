const fs = require('fs')
const crypto = require('crypto')

const debug = require('debug')('media-api')

const algo = 'aes-128-cbc'
const pass = 'phicommIsAwesome'

class MediaApi {

  constructor (vfs, thumbnail) {
    this.vfs = vfs
    this.thumbnail = thumbnail
  }

  LIST (user, props, callback) {
    this.vfs.visitFiles(user, { media: true }, callback)
  }

  GET (user, props, callback) {
    debug('get', props)

    if (!user) {
      let fingerprint
      try {
        let decipher = crypto.createDecipher(algo, pass)
        fingerprint = decipher.update(props.fingerprint, 'hex', 'utf8') + decipher.final('utf8')
      } catch (e) {
        let err = new Error('not found')
        err.status = 404
        return process.nextTick(() => callback(err))
      }

      this.vfs.getMedia(null, { fingerprint, file: true }, callback)
    } else {
      let { fingerprint, alt } = props 

      if (alt === undefined || alt === 'metadata') {
        this.vfs.getMedia(user, { fingerprint }, callback) 
      } else if (alt === 'random') {
        this.vfs.getMedia(user, { fingerprint }, err => {
          if (err) return callback(err)
          let cipher = crypto.createCipher(algo, pass)
          let random = cipher.update(fingerprint, 'utf8', 'hex') + cipher.final('hex')
          callback(null, { random })
        })
      } else if (alt === 'data') {
        this.vfs.getMedia(user, { fingerprint, file: true }, callback) 
      } else if (alt === 'thumbnail') {
        let q  = {}
        if (props.width) q.width = props.width 
        if (props.height) q.height = props.height
        if (props.modifiers) q.modifiers = props.modifiers
        if (props.autoOrient) q.autoOrient = props.autoOrient
        
        this.vfs.getMedia(user, { fingerprint, both: true }, (err, both) => {
          if (err) return callback(err)  

          /**
          This list must be kept in sync with video format defined in lib/file-meta
          */
          const isVideo = ['RM', 'RMVB', 'WMV', 'AVI', 'MPEG', 'MP4', '3GP', 'MOV', 'FLV', 'MKV']
            .includes(both.metadata.type)

          /** workaround, drop auto-orient option for video **/
          if (isVideo) q.autoOrient = undefined
          let tps = this.thumbnail.genProps(fingerprint, q)

          fs.lstat(tps.path, (err, stat) => {
            if (err && err.code === 'ENOENT') {
              this.thumbnail.convert(tps, both.path, both.metadata, callback)
            } else if (err) {
              callback(err)
            } else {
              if (isVideo && props.vthumb === 'true') {
                callback(null, tps.path + '-v')
              } else {
                callback(null, tps.path)
              }
            }
          })
        })  
      }
    }
  } 

}

module.exports = MediaApi
