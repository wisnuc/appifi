
class DirApi {

  constructor(vfs) {
    this.vfs = vfs
  }

  LIST(user, props, callback) {
    let err = new Error('not implemented yet')
    err.status = 500
    process.nextTick(() => callback(err))
  }

  GET(user, props, callback) {
    this.vfs.dirGET(user, props, callback)
  }
}

module.exports = DirApi
