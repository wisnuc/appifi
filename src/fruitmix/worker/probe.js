const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const E = require('../lib/error')
const Worker = require('./worker')
const { readXstat, readXstatAsync } = require('../models/xstat')

// the reason to prefer emitter version over closure one is:
// 1. easier to test
// 2. explicit state
// 3. can emit again (state) when error
class Probe extends Worker {

  constructor(dpath, uuid, mtime, delay) {
    super()
    this.dpath = dpath
    this.uuid = uuid
    this.mtime = mtime
    this.delay = delay

    // this.finished = false
    this.again = false
    this.timer = undefined
  }

  cleanUp() {
    clearTimeout(this.timer)
    this.timer = null
  }

  readXstats(callback) {
    let count, xstats = []
    fs.readdir(this.dpath, (err, entries) => 
      this.finished ? undefined
        : err ? callback(err)
          : (count = entries.length) === 0 ? callback(null, [])     
            : entries.forEach(ent => 
                readXstat(path.join(this.dpath, ent), (err, xstat) => {
                  if (this.finished) return
                  if (!err) xstats.push(xstat)
                  if (!--count) callback(null, xstats.sort((a,b) => a.name.localeCompare(b.name)))
                })))
  }

  run() {
  
    this.timer = setTimeout(() => 
      readXstat(this.dpath, (err, xstat) => 
        this.finished ? undefined
        : err ? this.error(err, this.again)
        : xstat.type !== 'directory' ? this.error(new E.ENOTDIR(), this.again)
        : xstat.uuid !== this.uuid ? this.error(new E.EINSTANCE(), this.again)
        : xstat.mtime === this.mtime ? this.finish(null, this.again)  // early finish
        : this.readXstats((err, xstats) => 
            this.finished ? undefined
            : err ? this.error(err, this.again) 
            : readXstat(this.dpath, (err, xstat2) => 
                this.finished ? undefined
                : err ? this.error(err, this.again)
                : xstat2.type !== 'directory' ? this.error(new E.ENOTDIR(), this.again)
                : xstat2.uuid !== this.uuid ? this.error(new E.EINSTANCE(), this.again)
                : xstat2.mtime !== xstat.mtime ? this.error(new E.ETIMESTAMP(), this.again)
                : this.finish({ mtime: xstat.mtime, xstats }, this.again)))), this.delay) // final finish
  }

  request() {
    if (this.finished) throw new Error('probe worker already finished')
    if (this.timer) this.again = true
  }
}

module.exports = (dpath, uuid, mtime, delay) => new Probe(dpath, uuid, mtime, delay)


