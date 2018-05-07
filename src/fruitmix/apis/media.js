class MediaApi {

  constructor (vfs, thumbnail) {
    this.vfs = vfs
    this.thumbnail = thumbnail
  }

  LIST (user, props, callback) {
    this.vfs.visitFiles(user, { media: true }, callback)
  }

  GET (user, props, callback) {
    let { fingerprint, alt } = props 

    if (alt === undefined || alt === 'metadata') {
      this.vfs.getMedia(user, { fingerprint }, callback)
    } else if (alt === 'data') {
      this.vfs.getMedia(user, { fingerprint, file: true }, callback) 
    } else if (alt === 'thumbnail') {
      let q  = {}
      if (props.width) q.width = props.width 
      if (props.height) q.height = props.height
      if (props.modifiers) q.modifiers = props.modifiers
      if (props.autoOrient) q.autoOrient = props.autoOrient
      
      this.vfs.getMedia(user, { fingerprint, file: true }, (err, fpath) => {
        if (err) return callback(err)  
        let tps = this.thumbnail.genProps(fingerprint, q)
        fs.lstat(tps.path, (err, stat) => {
          if (err && err.code === 'ENOENT') {
            this.thumbnail.convert(tps, fpath, callback)
          } else if (err) {
            callback(err)
          } else {
            callback(null, fpath)
          }
        })
      })  
    }
  } 

}

module.exports = MediaApi
