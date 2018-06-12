class FileApi {

  constructor (vfs) {
    this.vfs = vfs
  }

  LIST (user, props, callback) {
    this.vfs.QUERY(user, props, callback)
  }
 
  GET (user, props, callback) {
    
  } 
}


module.exports = FileApi
