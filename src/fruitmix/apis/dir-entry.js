const EventEmitter = require('events')

const IncomingForm = require('./IncomingForm')

class DirEntryApi {
  
  constructor(vfs) {
    this.vfs = vfs
    this.posts = []
  }

  createFile (props, callback) {
  }

  appendFile (props, callback) {
  }

  /**
  
  */
  mkdir (user, dirProps, formProps, callback) {
    let props = Object.assign({}, formProps, dirProps)
    this.vfs.MKDIR(user, props, callback) 
  }

  bindApis (user, dirProps) {
    return {
      mkdir: this.mkdir.bind(this, user, dirProps),
    }
  }

  /**
  @param {object} user
  @param {object} props
  @param {string} [props.driveUUID]
  @param {string} props.dirUUID
  @param {string} props.boundary
  @param {number} props.length
  @param {formdata} props.formdata - formdata is a readable stream
  */
  POSTFORM (user, props, callback) { 
    let { driveUUID, dirUUID, boundary, length, formdata } = props
    let dirProps = { driveUUID, dirUUID }

    this.vfs.DIR(user, dirProps, err => {
      if (err) return callback(err)

      let opts = { boundary, length, formdata }
      let form = new IncomingForm(opts, this.bindApis(user, dirProps)) 

      form.once('finish', () => 
        this.vfs.tryDirRead (dirUUID, () => callback(form.error, form.result)))
    }) 
  }

  GET (user, props, callback) {
    this.vfs.dirEntryGET(user, props, callback)
  }

}

module.exports = DirEntryApi
