const EventEmitter = require('events')

const debug = require('debug')('direntry')

const IncomingForm = require('./IncomingForm')

class DirEntryApi {
  constructor (vfs) {
    this.vfs = vfs
    this.posts = []
  }

  mkdir (user, dirProps, dataProps, callback) {
    let props = Object.assign({}, dataProps, dirProps)
    this.vfs.MKDIR(user, props, callback) 
  }

  remove (user, dirProps, dataProps, callback) {
    let props = Object.assign({}, dataProps, dirProps)
    this.vfs.REMOVE(user, props, callback)
  }

  rename (user, dirProps, dataProps, callback) {
    let props = Object.assign({}, dataProps, dirProps)
    this.vfs.RENAME(user, props, callback)
  }

  newfile (user, dirProps, dataProps, callback) {
    let props = Object.assign({}, dataProps, dirProps)
    this.vfs.NEWFILE(user, props, callback)
  }

  append (user, dirProps, dataProps, callback) {
    let props = Object.assign({}, dataProps, dirProps) 
    this.vfs.APPEND(user, props, callback)
  }

  addTags (user, dirProps, dataProps, callback) {
    let props = Object.assign({}, dataProps, dirProps)
    this.vfs.ADDTAGS(user, props, callback)
  }

  removeTags(user, dirProps, dataProps, callback) {
    let props = Object.assign({}, dataProps, dirProps)
    this.vfs.REMOVETAGS(user, props, callback)
  }

  bindApis (user, dirProps) {
    return {
      tmpfile: this.vfs.TMPFILE.bind(this.vfs),
      mkdir: this.mkdir.bind(this, user, dirProps),
      remove: this.remove.bind(this, user, dirProps),
      rename: this.rename.bind(this, user, dirProps),
      newfile: this.newfile.bind(this, user, dirProps),
      append: this.append.bind(this, user, dirProps),
      addTags: this.addTags.bind(this, user, dirProps),
      removeTags: this.removeTags.bind(this, user, dirProps)
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
      form.once('finish', () => {
        let err = form.error 
          ? { 
              code: form.error.code,
              message: form.error.message,
              status: form.error.status
            }
          : null

        debug('form finished', err, form.result)
        this.vfs.tryDirRead (dirUUID, () => callback(form.error, form.result))
      })
    }) 
  }

  GET (user, props, callback) {
    this.vfs.DIRENTRY_GET(user, props, callback)
  }

}

module.exports = DirEntryApi
