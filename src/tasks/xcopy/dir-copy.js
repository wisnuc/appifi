const Dir = require('./dir-base')
const FileCopy = require('./file-copy')

/**
`Working` state for DirCopy sub-task

The destination directory (`dst`) should be created in this state.

@memberof XCopy.DirCopy
@extends XCopy.State
*/
class Working extends Dir.prototype.Working {

  mkdir (policy, callback) {
    let src = { dir: this.ctx.src.uuid }
    let dst = { dir: this.ctx.parent.dst.uuid }
    this.ctx.ctx.cpdir(src, dst, policy, (err, xstat, resolved) => {
      if (err) {
        callback(err)
      } else {
        if (!xstat) return callback(null, null, resolved)
        let dst2 = { uuid: xstat.uuid, name: xstat.name }
        callback(null, dst2, resolved)
      }
      // if (err && err.code === 'EEXIST') {
      //   this.setState('Conflict', err, policy)
      // } else if (err) {
      //   this.setState('Failed', err)
      // } else {
      //   this.setState('Finished')
      // }
    })
  }

}

/**

@memberof XCopy
@extends XCopy.Dir
*/
class DirCopy extends Dir { }

DirCopy.prototype.Working = Working
DirCopy.File = FileCopy

module.exports = DirCopy


