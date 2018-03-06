const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const UUID = require('uuid')

const { forceXstatAsync } = require('../lib/xstat')
const Transform = require('../lib/transform')
const { btrfsCloneAsync } = require('../utils/btrfs')

class MoveTask extends EventEmitter {

  constructor(ctx, user, props) {
    super()

    this.ctx = ctx
    this.uuid = UUID.v4()

    this.user = user
    this.type = props.type

    this.topEntries = props.entries
    this.srcdrv = props.src.drive
    this.dstdrv = props.dst.drive
    this.srcStats = { dirs: 0, files: 0, size: 0 }
    this.dstStats = { dirs: 0, files: 0, size: 0 }


    // x { srcDirUUID, name, dstDirUUID }
    this.mvdirs = []
    this.mvdirs_ = []

    // x { srcDirUUID, fileUUID, name, dstDirUUID }
    this.mvfiles = []
    this.mvfiles_ = []

    this.topEntries.forEach(entry => {
      if (entry.type === 'directory') {

        let x = {
          srcDirUUID: entry.uuid,
          name: entry.name,
          dstDirUUID: props.dst.dir
        }

        this.mvdirs.push(x)
        this.ctx.mvdir(user,
          this.srcdrv, x.srcDirUUID, x.name,
          this.dstdrv, x.dstDirUUID, err => {

          this.mvdirs.splice(this.mvdirs.indexOf(x), 1)
          if (err) {
 
            return
          } 
          
        })

      } else {
        let x = {
          srcDirUUID: props.src.dir,
          fileUUID: entry.uuid,
          name: entry.name,
          dstDirUUID: props.dst.dir
        }
        
        this.mvfiles.push(x)
        this.ctx.mvfile(user, 
          this.srcdrv, x.srcDirUUID, x.fileUUID, x.name, 
          this.dstdrv, x.dstDirUUID, err => {

          this.mvfiles.splice(this.mvfiles.indexOf(x), 1)
          if (err) {
            let { status, errno, code, syscall, path, dest, message } = err
            x.error = { status, errno, code, syscall, path, dest, message }
            this.mvfiles.push(x)
          } else {
             
          }
        })
      }
    })
 
    this.view = function () {
      return {
        uuid: this.uuid,
        type: this.type,
        src: props.src,
        dst: props.dst,
        entries: props.entries,
        srcStats: this.srcStats,
        dstStats: this.dstStats,
        isStopped: this.mvdirs.length === 0 && this.mvfiles.length === 0
      }
    } 
  }
}

module.exports = MoveTask
