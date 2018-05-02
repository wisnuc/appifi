
class MediaApi {

  constructor (opts, user, drive) {
    this.user = user
  }

  getMetadata (user, fingerprint) {
    
  }

  LIST (user, props) {
     
  }

  GET (user, props, callback) {
    let { fingerprint, query } = props 

    if (query.alt === undefined || query.alt === 'metadata') {
      let metadata = 
    } else if (query.alt === 'data') {
       
    } else if (query.alt === 'thumbnail') {
    }
  }    
}

module.exports = MediaApi
