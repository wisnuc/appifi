const EventEmitter = require('events')
const UUID = require('uuid')
const debug = require('debug')('xsink')

class XRemove extends EventEmitter {

  constructor (vfs, nfs, user, props) {
    super()
    if (!vfs) throw new Error('vfs is not provided')
    if (!nfs) throw new Error('nfs is not provided')

    this.vfs = vfs
    this.nfs = nfs

    this.type = props.type
    this.user = user
    this.uuid = UUID.v4() 

    this.autoClean = props.autoClean
    this.entries = props.entries
    this.allFinished = false

    this.next()
  }

  next () {
    if (this.entries.length === 0) {
      this.allFinished = true
      this.emit('finish')
      return
    }

    let { drive, dir, name } = this.entries.shift()
    if (this.type === 'remove') {
      this.vfs.REMOVE(this.user, { driveUUID: drive, dirUUID: dir, name }, err => this.next())
    } else if (this.type === 'nremove') {
      this.nfs.REMOVE(this.user, { drive, dir, name }, err => this.next())
    } else {
      this.process.nextTick(() => this.next()) 
    }
  }

  view () {
    return {
      uuid: this.uuid,
      batch: true,
      type: this.type,
      entries: this.entries,
      allFinished: this.allFinished
    }
  }

  destroy () {
    this.entries = []
  }
} 

module.exports = XRemove
