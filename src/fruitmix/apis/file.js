class FileApi {

  constructor (vfs) {
    this.vfs = vfs
  }

  LIST (user, props, callback) {
    process.nextTick(() => callback(new Error('not implemented yet'))) 
  }
}


module.exports = FileApi
