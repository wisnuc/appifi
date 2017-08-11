const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')

const { forceXstat } = require('../lib/xstat')
const Transform = require('../lib/transform')
const fileCopy = require('../forest/filecopy')
const Forest = require('../forest/forest')

class DirImport extends EventEmitter {

  constructor (options) {
    super()

    Object.assign(this, options)

    let { src, tmp, dst } = this

    let dirwalk = new Transform({
      spawn: {
        name: 'dirwalk',
        transform: function (y, callback) {
          fs.readdir(path.join(src, y.path), (err, entries) => {
            if (err || entries.length === 0) {
              if (err) {
                callback(err)
              } else {
                callback(null, { path: y.path, files: [] })
              }
            } else {
              let count = entries.length
              let files = []
              entries.forEach(entry => {
                fs.lstat(path.join(src, y.path, entry), (err, stat) => {
                  if (err) {
                    // TODO
                  } else {
                    if (stat.isDirectory()) {
                      this.unshift({ path: path.join(y.path, entry) })
                    } else if (stat.isFile()) {
                      files.push(entry)
                    } else {
                      // TODO 
                    }
                  } 

                  if (!--count) callback(null, { path: y.path, files })
                }) 
              })
            }
          })
        } 
      }
    })
    
    // x untouched
    let mkTmpDir = new Transform({
      name: 'mktmpdir',
      transform: (x, callback) => 
        mkdirp(path.join(tmp, x.path), err => err ? callback(err) : callback(null, x))
    }) 
   
    // x untouched 
    let mkDstDir = new Transform({
      name: 'mkdstdir',
      transform: (x, callback) => 
        mkdirp(path.join(dst, x.path), err => err ? callback(err) : callback(null, x))
    })

    // x { path, files [] }
    let dircopy = new Transform({
      name: 'dircopy',
      concurrency: 2,
      push: function(x) { 
        // remove empty dir
        if (!x.files.length) return
        this.pending.push(x)
        this.schedule()
      },
      spawn: [ // spawn a pipe
        {
          name: 'copy',
          concurrency: 4,
          push: function (x) {
            // split dir to files
            x.files.forEach(name => {
              this.pending.push({ 
                name,
                src: path.join(src, x.path, name),
                tmp: path.join(tmp, x.path, name),
                dst: path.join(dst, x.path, name)
              })
            })  
            this.schedule()
          },
          transform: (x, callback) =>
            (x.abort = fileCopy(x.src, x.tmp, (err, fingerprint) => {
              delete x.abort
              if (err) {
                callback(err)
              } else {
                callback(null, (x.fingerprint = fingerprint, x))
              }
            }))
        }, {
          name: 'stamp',
          transform: (x, cb) =>
            forceXstat(x.tmp, { hash: x.fingerprint }, (err, xstat) => {
              if (err) {
                cb(err)
              } else {
                cb(null, (x.uuid = xstat.uuid, x))
              }
            })
        }, {
          name: 'move',
          transform: (x, cb) => fs.link(x.tmp, x.dst, err => err ? cb(err) : cb(null, x))
        }, {
          name: 'remove',
          transform: (x, cb) => rimraf(x.tmp, () => cb(null, x))
        }
      ] 
    })

    dirwalk.pipe(mkTmpDir).pipe(mkDstDir).pipe(dircopy)

    let count = this.files.length
    let dirs = []
    let files = []
    this.files.forEach(name => fs.lstat(path.join(src, name), (err, stat) => {
      if (err) {
        // TODO
      } else {
        if (stat.isDirectory()) {
          dirs.push({ path: name })
        } else if (stat.isFile()) {
          files.push(name)
        } else {
          // TODO
        }
      }

      if (!--count) {
        dircopy.push({ path: '', files })
        dirs.forEach(dir => dirwalk.push(dir))
      }
    }))

    // drain data
    dirwalk.on('data', data => {})
    dirwalk.on('step', () => {
      if (dirwalk.isStopped()) {
        this.emit('stopped')
      }
    })

  } 

}

module.exports = DirImport

