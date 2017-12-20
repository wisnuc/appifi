const Dir = require('./dir-base')
const FileMove = require('./file-move')

/**
`Working` state for DirMove sub-task

The destination directory (`dst`) should be created in this state.

@memberof XCopy.DirCopy
@extends XCopy.State
*/
class Working extends Dir.prototype.Working {

  mkdir (policy, callback) {
    let src = { dir: this.ctx.src.uuid }
    let dst = { dir: this.ctx.parent.dst.uuid }   
    this.ctx.ctx.mvdir(src, dst, policy, (err, xstat, resolved) => {
      // if (err) {
      //   callback(err)
      // } else {
      //   let dst = { uuid: xstat.uuid, name: xstat.name }
      //   callback(null, dst, resolved)
      // }

      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        this.setState('Finished')
      }
    })
  }
}

/**
@memberof XCopy
@extends XCopy.Dir
*/
class DirMove extends Dir { }

DirMove.prototype.Working = Working
DirMove.File = FileMove

module.exports = DirMove


