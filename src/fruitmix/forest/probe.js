const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const E = require('../lib/error')
const Worker = require('../worker/worker')
const { readXstat, readXstatAsync } = require('../file/xstat')

/**
@event Readdir#error
@type {error}
@property {string} code, `ENOTDIR`, `EINSTANCE`, or other node fs api errors, including `ENOTDIR` and `ENOENT`.
*/

/**
@event Readdir#finish
@type {object}
@property {xstat[]} xstats - an array of xstats for all entries (only regular files and directories included)
@property {number} mtime - mtime of parent directory
@property {boolean} transient - whether the timestamps of parent directory matches before and after reading entries.
*/


/**
Readdir is a worker class similar to unix `readdir`. It returns xstats for all entries, the timestamp of the directories, and whether the timestamp changed before and after reading entries.

It emits `error` and `finish` events. See below.
*/
class Readdir extends Worker {

  /**
  @param {string} dpath - directory path
  @param {string} uuid - directory uuid
  @param {number} mtime - expected time stamp
  */
  constructor(dpath, uuid, mtime) {

    super()
    this.dpath = dpath
    this.uuid = uuid
    this.mtime = mtime
  }

  /**
  internal functions to read xstats for all entries.
  @param {function} callback
  */
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

  /**
  Implement Worker class virtual method. The corresponding external method is `start`.

  @fires Readdir#error
  @fires Readdir#finish
  */
  run() {
  
    readXstat(this.dpath, (err, xstat1) =>                                    // read xstat first 
      this.finished ? undefined
      : err ? this.error(err)
      : xstat1.type !== 'directory' ? this.error(new E.ENOTDIR())
      : xstat1.uuid !== this.uuid ? this.error(new E.EINSTANCE())             // uuid mismatch
      : this.readXstats((err, xstats) => 
          this.finished ? undefined
          : err ? this.error(err) 
          : readXstat(this.dpath, (err, xstat2) =>                            // read xstat second 
              this.finished ? undefined
              : err ? this.error(err)
              : xstat2.type !== 'directory' ? this.error(new E.ENOTDIR())
              : xstat2.uuid !== this.uuid ? this.error(new E.EINSTANCE())     // uuid mismatch
              : this.finish({ 
                  xstats,
                  mtime: xstat2.mtime, 
                  transient: xstat2.mtime !== xstat1.mtime
                }))))
  }
}

module.exports = (dpath, uuid, mtime) => new Readdir(dpath, uuid, mtime)

