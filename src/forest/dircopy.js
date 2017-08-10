const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const debug = require('debug')('dircopy')
const rimraf = require('rimraf')

const Transform = require('../lib/transform')
const { forceXstat } = require('../lib/xstat')
const fileCopy = require('./filecopy')

class DirCopy extends EventEmitter {

  constructor (src, tmp, files, getDirPath) {
    super()

    let dst = getDirPath()
    let pipe = new Transform({
      name: 'copy',
      concurrency: 4,
      transform: (x, callback) =>
        (x.abort = fileCopy(path.join(src, x.name), path.join(tmp, x.name),
          (err, fingerprint) => {
            delete x.abort
            if (err) {
              callback(err)
            } else {
              callback(null, (x.fingerprint = fingerprint, x))
            }
          }))
    }).pipe(new Transform({
      name: 'stamp',
      transform: (x, callback) =>
        forceXstat(path.join(tmp, x.name), { hash: x.fingerprint },
          (err, xstat) => err
            ? callback(err)
            : callback(null, (x.uuid = xstat.uuid, x)))
    })).pipe(new Transform({
      name: 'move',
      transform: (x, callback) =>
        fs.link(path.join(tmp, x.name), path.join(dst, x.name), err => err
          ? callback(err)
          : callback(null, x))
    })).pipe(new Transform({
      name: 'remove',
      transform: (x, callback) => rimraf(path.join(tmp, x.name), () => callback(null))
    })).root()

    let count = 0

    // drain data
    pipe.on('data', data => this.emit('data', data))
    pipe.on('step', (tname, xname) => {
      debug('------------------------------------------')
      debug(`step ${count++}`, tname, xname)
      pipe.print()
      if (pipe.isStopped()) this.emit('stopped')
    })

    files.forEach(name => pipe.push({ name }))
    pipe.print()
    this.pipe = pipe
  }

}

module.exports = DirCopy
