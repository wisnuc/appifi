const File = require('./file-base')

class Working extends File.Working {

  enter () {
    super.enter()

    let tmpPath = this.ctx.ctx.genTmpPath()  
    fs.open(this.ctx.srcPath, 'r', (err, fd) => {
      if (err) {
        // TODO
      } else {
        this.rs = fs.createReadStream(null, { fd })
        this.ws = fs.createWriteStream(tmpPath)
        this.rs.pipe(this.ws)
        this.ws.on('finish', () => {
       
          let tmp = { path: tmpPath }
          let dst = { 
            dir: this.ctx.parent.dstUUID,
            name: this.ctx.srcName
          }

          let policy = this.ctx.getPolicy()

          this.ctx.ctx.mkfile(tmp, dst, policy, (err, xstat, resolved) => {
            if (err && err.code === 'EEXIST') {
              this.setState('Conflict', err, policy)
            } else if (err) {
              this.setState('Failed', err)
            } else {
              rimraf(tmpPath, () => {})
              this.setState('Finished')
            }
          })
        })
      }
    })
  }
}


/**
@extends XCopy.File
@memberof XCopy
*/
class FileImport extends File {

  constructor(ctx, parent, srcPath) {
    super(ctx, parent)
    this.srcPath = srcPath
    this.srcName = path.basename(srcPath)
    this.state = new Pending(this)
  }

}

FileImport.prototype.Working = Working

module.exports = FileImport


