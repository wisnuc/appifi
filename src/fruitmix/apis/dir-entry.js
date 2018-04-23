const EventEmitter = require('events')

class FormData extends EventEmitter {

  constructor () {
    super()
  }
}

class DirEntryApi {
  
  constructor(vfs) {
    this.vfs = vfs
  }

  /**
  @param {object} user
  @param {object} props
  @param {string} [props.driveUUID]
  @param {string} props.dirUUID
  @param {string} boundary
  @param {number} length
  @param {Readable} formdata
  */
  POSTFORM (user, props, callback) { 
    let form = new Form()
    form.on('something', () => {
    })

    form.on('error', () => {
    })

    props.form.pipe(form)
  }

  GET (user, props, callback) {
    this.vfs.dirEntryGET(user, props, callback)
  }
}
