class FileApi {

  constructor (vfs) {
    this.vfs = vfs
  }

  LIST (user, props, callback) {
    this.vfs.visitFiles(user, props, callback)
  }
}


module.exports = FileApi
