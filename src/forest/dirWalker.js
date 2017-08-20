const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

class DirWalker extends EventEmitter {

  constructor(rootPath) {
    super()
    this.error = undefined
    this.aborted = false
    this.rootPath = rootPath

    this.count = 0

    this.readdirAsync('')
      .then(() => {})
      .catch(e => this.emit('error', e))
      .then(() => this.emit('finish'))
  }

  async readdirAsync (relPath) {
    let dirs = []
    let files = []
    let absPath = path.join(this.rootPath, relPath)
    let entries = await fs.readdirAsync(absPath)
    if (this.error) throw this.error

    // settle
    ;(await Promise.map(entries, 
      async entry => {
        try {
          return [await fs.lstatAsync(path.join(absPath, entry)), entry]
        } catch (e) {
          return
        }
      }))
      .filter(x => !!x)
      .forEach(x => {
        if (x[0].isFile()) {
          files.push({ name: x[1], size: x[0].size, mtime: x[0].mtime.getTime() })
        } else if (x[0].isDirectory()) {
          dirs.push(x[1]) 
        }
      })
    if (this.error) throw this.error

    this.count++
    this.emit('data', { relPath, files })
    dirs.sort()
    
    // recursive
    for (let i = 0; i < dirs.length; i++) {
      await this.readdirAsync(path.join(relPath, dirs[i]))
      if (this.error) throw this.error
    }
  }
}

module.exports = DirWalker

/**
const x = new DirWalker(path.join(process.cwd(), 'src'))
x.on('data', data => console.log('dir ----', data))
x.on('error', error => console.log(error))
x.on('finish', () => console.log('finished', x.count))
**/
