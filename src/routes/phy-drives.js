const path = require('path')
const fs = require('fs')
const stream = require('stream')
const express = require('express')

const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const sanitize = require('sanitize-filename')
const Dicer = require('dicer')

/**

@module PhyDriveRouter
*/

/**
A writable stream for multipart/form-data upload (and mkdir)

*/
class Upload extends stream.Writable {
  /**
  @param {object} opts
  */
  constructor (opts) {
    super({ objectMode: true })
    this.dir = opts.dir
  }

  _write (part, encoding, callback) {
    let name, filename, ws, error

    part.on('header', header => {
      /**
      This code are from IncomingForm

      TODO full test and extract
      */
      let x = Buffer.from(header['content-disposition'][0], 'binary')
        .toString('utf8')
        .replace(/%22/g, '"')
        .split('; ')

      if (x[0] !== 'form-data' ||
        (!x[1].startsWith('name="') || !x[1].endsWith('"')) ||
        (x.length > 2 && (!x[2].startsWith('filename="') || !x[2].endsWith('"')))) {
        error = new Error('invalid header')
        error.code = 'EINVAL'
        error.status = 400
        return callback(error)
      }

      name = x[1].slice(6, -1)
      filename = x[2] && x[2].slice(10, -1)

      if (filename) {
        if (filename !== sanitize(filename)) {
          error = new Error('invalid filename')
          error.code = 'EINVAL'
          error.status = 400
          return callback(error)
        }
      } else {
        if (name !== sanitize(name)) {
          error = new Error('invalid (dir) name')
          error.code = 'EINVAL'
          error.status = 400
          return callback(error)
        }
      }

      if (filename) {
        ws = fs.createWriteStream(path.join(this.dir, filename))
        ws.on('error', err => {
          ws.removeAllListeners()
          ws.on('error', () => {})
          error = err
          callback(err)
        })

        ws.on('finish', () => callback())
      } else {
        let dirPath = path.join(this.dir, name)
        mkdirp(dirPath, err => {
          if (err) {
            error = err
            callback(err)
          } else {
            callback()
          }
        })
      }
    })

    part.on('data', data => !error && filename && ws.write(data))
    part.on('end', () => !error && filename && ws.end())
  }

  _final (callback) {
    // FIXME should block until clean up
    callback()
  }
}

module.exports = (auth, NFS) => {
  const f = (res, next) => (err, data) =>
    err ? next(err) : data ? res.status(200).json(data) : res.status(200).end()

  /**
  This middleware will generate req.abspath and req.relpath
  */
  const checkPath = (req, res, next) =>
    NFS.GET(req.user, { id: req.params.id }, (err, drive) => {
      if (err) {
        next(err)
      } else {
        let mp = drive.mountpoint
        let rawpath = path.join(mp, req.query.path || '')

        // resolve removes trailing slash
        let abspath = path.resolve(path.normalize(rawpath))
        if (!abspath.startsWith(mp)) {
          res.status(400).json({ message: 'invalid path' })
        } else {
          req.abspath = abspath
          req.relpath = abspath.slice(mp.length)
          next()
        }
      }
    })

  let router = express.Router()

  router.get('/', auth.jwt(), (req, res, next) => NFS.LIST(req.user, {}, f(res, next)))

  router.get('/:id', auth.jwt(), checkPath, (req, res, next) => {
    let target = req.abspath
    fs.lstat(target, (err, stat) => {
      if (err) {
        if (err.code === 'ENOENT' || err.code === 'ENOTDIR') err.status = 404
        next(err)
      } else if (stat.isDirectory()) {
        fs.readdir(target, (err, entries) => {
          if (err) return next(err)
          if (entries.length === 0) return res.status(200).json([])
          let count = entries.length
          let arr = []
          entries.forEach(entry => {
            fs.lstat(path.join(target, entry), (err, stat) => {
              if (!err) {
                arr.push({
                  name: entry,
                  type: stat.isFile() ? 'file'
                    : stat.isDirectory() ? 'directory'
                      : stat.isSymbolicLink() ? 'link'
                        : stat.isSocket() ? 'socket'
                          : stat.isFIFO() ? 'fifo'
                            : stat.isCharacterDevice() ? 'char'
                              : stat.isBlockDevice() ? 'block' : 'unknown',
                  size: stat.size,
                  ctime: stat.ctime.getTime()
                })
              }
              if (!--count) res.status(200).json(arr) // TODO sort
            })
          })
        })
      } else if (stat.isFile()) {
        res.status(200).sendFile(target)
      } else {
        let err = new Error('target is not a regular file or directory')
        err.status = 403
        next(err)
      }
    })
  })

  // not implemented yet (could be a
  router.post('/:id', auth.jwt(), checkPath, (req, res, next) => {
    fs.lstat(req.abspath, (err, stat) => {
      if (err) {
        if (err.code === 'ENOENT' || err.code === 'ENOTDIR') err.status = 404
        next(err)
      } else if (!stat.isDirectory()) {
        let err = new Error('target not a dir')
        err.code = 'ENOTDIR'
        err.status = 400
        next(err)
      } else {
        if (req.is('multipart/form-data')) {
          const regex = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i
          const m = regex.exec(req.headers['content-type'])
          let boundary = m[1] || m[2]
          let dicer = new Dicer({ boundary })
          let nu = new Upload({ dir: req.abspath })

          const onError = err => {
            dicer.removeAllListeners()
            dicer.on('error', () => {})
            nu.removeAllListeners()
            nu.on('error', () => {})
            nu.destroy()
            nu.end()
            req.unpipe()
            next(err)
          }

          dicer.on('part', part => nu.write(part, () => {}))
          dicer.on('error', err => onError(err))
          nu.on('error', err => onError(err))
          nu.on('finish', () => res.status(200).end())
          req.pipe(dicer)
        } else {
          res.status(415).end()
        }
      }
    })
  })

  // rename a file or directory. Given path must be a directory
  router.patch('/:id', auth.jwt(), checkPath, (req, res, next) => {
    let { oldName, newName } = req.body

    if (typeof oldName !== 'string' || sanitize(oldName) !== oldName) {
      let err = new Error('invalid old name')
      err.code = 'EINVAL'
      err.status = 400
      return next(err)
    }

    if (typeof newName !== 'string' || sanitize(newName) !== newName) {
      let err = new Error('invalid new name')
      err.code = 'EINVAL'
      err.status = 400
      return next(err)
    }

    let oldPath = path.join(req.abspath, oldName)
    if (oldPath ||
      oldPath !== path.resolve(path.normalize(oldPath))) {
      let err = new Error('invalid old name')
      err.code = 'EINVAL'
      err.status = 400
      return next(err)
    }

    let newPath = path.join(req.abspath, newName)
    if (newPath !== path.resolve(path.normalize(newPath))) {
      let err = new Error('invalid new name')
      err.code = 'EINVAL'
      err.status = 400
      return next(err)
    }

    fs.rename(oldPath, newPath, err => err ? next(err) : res.status(200).end())
  })

  // overwrite a file
  router.put('/:id', auth.jwt(), checkPath, (req, res, next) => {
    let abspath = req.abspath
    fs.lstat(abspath, (err, stat) => {
      if (err) {
        if (err.code === 'ENOENT' || err.code === 'ENOTDIR') err.status = 404
        next(err)
      } else if (!stat.isFile()) {
        let err = new Error('target not a file')
        err.code = 'ENOTFILE'
        err.status = 403
        next(err)
      } else {
        let ws = fs.createWriteStream(abspath)
        ws.on('error', err => {
          ws.removeAllListeners()
          ws.on('error', () => {}) // mute
          req.unpipe()
          next(err)
        })
        ws.on('close', () => res.status(200).end())
        req.pipe(ws)
      }
    })
  })

  /**
  rimraf a file or directory
  */
  router.delete('/:id', auth.jwt(), checkPath, (req, res, next) => {
    if (req.relpath === '') {
      let err = new Error('root cannot be deleted')
      err.status = 400
      next(err)
    } else {
      rimraf(req.abspath, err => err ? next(err) : res.status(200).end())
    }
  })

  return router
}
