const path = require('path')
const fs = require('fs')

class NDirStats {

  constructor (root) {
    this.root = root
    this.dirCount = 0
    this.fileCount = 0
    this.total = 0

    this.destroyed = false

    this.running = 0
    this.queue = []
  }

  schedule () {
    if (this.destroyed) return
    while (this.queue.length && this.running <= 2) {
      this.probe(this.queue.shift())
    }
  }

  probe (dirpath) {
    fs.readdir(dirpath, (err, entries) => {
      if (this.destroyed) return
      if (err) return      
      if (entries.length === 0) return

      let count = entries.length
      entries.forEach(entry => 
        fs.lstat(path.join(dirpath, entry), (err, stats) => {
          if (this.destroyed) return
          if (!err) {
            if (stats.isDirectory) {
              this.dirCount++
              this.queue.push(path.join(dirpath, entry))
            } else if (stats.isFile()) {
              this.fileCount++ 
              this.totalSize += stats.size
            } 
          }

          if (!--count) this.schedule()
        }))
    }) 
  }
}

module.exports = NDirStats
