const path = require('path')
const fs = require('fs')

const UUID = require('uuid')

const FileImport = require('./file-import')
const Dir = require('./dir-base')

class Working extends Dir.prototype.Working {

  enter () {
    super.enter()

    let dst = {
      dir: this.ctx.parent.dst.uuid,
      name: this.ctx.src.name,
    }

    let policy = this.ctx.getPolicy()
   
    this.ctx.ctx.mkdir(dst, policy, (err, xstat, resolved) => {
      if (err && err.code === 'EEXIST') {
        this.setState('Conflict', err, policy)
      } else if (err) {
        this.setState('Failed', err)
      } else {
        this.ctx.dst = {
          uuid: xstat.uuid,
          name: xstat.name 
        }

        this.setState('Reading')
      }
    })
  }

}

// Native Reading
class Reading extends Dir.prototype.Reading {

  enter () {
    super.enter()

    let srcPath = this.ctx.src.path
    fs.readdir(srcPath, (err, files) => {
      if (err) {
        this.setState('Failed', err)
      } else if (files.length === 0) {
          this.setState('Read', [])
      } else {
        let count = files.length
        let stats = []
        files.forEach(file => {
          fs.lstat(path.join(srcPath, file), (err, stat) => {
            if (!err && (stat.isDirectory() || stat.isFile())) {
              let x = { 
                type: stat.isDirectory() ? 'directory' : 'file',
                name: file
              }

              if (x.type === 'file') {
                x.size = stat.size
                x.mtime = stat.mtime.getTime()
              }
              
              stats.push(x)
            } 

            if (!--count) {
              this.setState('Read', stats)
            }
          })
        })
      }
    })
  }

}


class Read extends Dir.prototype.Read {

  next () {
    if (this.ctx.fstats.length) {
      let fstat = this.ctx.fstats.shift()
      let src = {
        uuid: UUID.v4(),
        name: fstat.name,
        path: path.join(this.ctx.src.path, fstat.name)
      }

      let file = new FileImport(this.ctx.ctx, this.ctx, src)

      file.on('error', err => { 
        // TODO
        console.log(err)
        this.next()
      })

      file.on('finish', () => {
        file.destroy(true)
        this.next()
      })

      return
    }

    if (this.ctx.dstats.length) {
      let dstat = this.ctx.dstats.shift()

      let src = {
        uuid: UUID.v4(),
        name: dstat.name,
        path: path.join(this.ctx.src.path, dstat.name)
      }

      let dir = new DirImport(this.ctx.ctx, this.ctx, src)

      dir.on('error', err => {
        // TODO
        this.next()
      })

      dir.on('finish', () => (dir.destroy(true), this.next()))
      return
    } 

    if (this.ctx.children.length === 0) {
      this.setState('Finished')
    }
  }

}

class DirImport extends Dir { }

DirImport.prototype.Working = Working
DirImport.prototype.Reading = Reading
DirImport.prototype.Read = Read

module.exports = DirImport

