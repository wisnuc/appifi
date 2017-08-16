const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const UUID = require('uuid')

const { forceXstat } = require('../lib/xstat')
const Transform = require('../lib/transform')
const fileCopy = require('../forest/filecopy')

const getFruit = require('../fruitmix')

// given xstat, with timestamp
// dup to tmp file
// if hash, read timestamp again, if match forceXstat
// fslink to target path
const fileDup = (src, tmp, dst, xstat, callback) => {


  
}

const fileDupAsync = async (src, tmp, dst, xstat) => {
  await btrfsCloneAsync(tmp, src)
  try {
    if (xstat.hash) {
      let stat = fs.lstatAsync(src)
      if (stat.mtime.getTime() === xstat.mtime) {
        await forceXstatAsync(src, { hash: xstat.hash })
      }
    }
    await fs.linkAsync(tmp, dst)
  } finally {
    fs.unlink(tmp, () => {})
  }
}

/**
  1. user
  2. srcDriveUUID
  3. srcDirUUID
  4. dstDriveUUID
  5. dstDirUUID
*/
class CopyTask extends EventEmitter {

  constructor (user, props) {
    super()
    this.uuid = UUID.v4()
    this.user = user
    this.userUUID = user.uuid

    this.src = props.src
    this.dst = props.dst
    this.entries = props.entries
    
    // dirwalk consumes a 
    let dirwalk = new Transform({
      spawn: {
        name: 'dirwalk-fruit',

        /**
        This function is the equivalent of readdir and lstat that operating on
        a fruitmix file system
        */
        transform: function (x, callback) {
          
        }
      }
    })

    // generate dir uuid
    let mkFruitDir = new Transform({
    })

    let fileDup = new Transform({
      name: 'filedup',
      transform: (x, callback) => {
      }
    }) 

    dirwalk.pipe(mkFruitDir).pipe(fileDup)
    dirwalk.on('data', data => {})
    dirwalk.on('step', () => {
      if (dirwalk.isStopped()) {
        this.emit('stopped')
      }
    })
  }

  view() {
    return {
      uuid: this.uuid,
      user: this.user.uuid,
      type: 'copy',
      src: this.src,
      dst: this.dst,
      entries: this.entries
    }
  }
}

module.exports = CopyTask


