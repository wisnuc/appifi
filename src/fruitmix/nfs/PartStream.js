const path = require('path')
const fs = require('fs')
const stream = require('stream')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const sanitize = require('sanitize-filename')

const debug = require('debug')('PartStream')

const EUnsupported = stat => {
  let err = new Error('target is not a regular file or directory')

  /** from nodejs 8.x LTS doc
  stats.isFile()
  stats.isDirectory()
  stats.isBlockDevice()
  stats.isCharacterDevice()
  stats.isSymbolicLink() (only valid with fs.lstat())
  stats.isFIFO()
  stats.isSocket()
  */
  if (stat.isBlockDevice()) {
    err.code = 'EISBLOCKDEV'
  } else if (stat.isCharacterDevice()) {
    err.code = 'EISCHARDEV'
  } else if (stat.isSymbolicLink()) {
    err.code = 'EISSYMLINK'
  } else if (stat.isFIFO()) {
    err.code = 'EISFIFO'
  } else if (stat.isSocket()) {
    err.code = 'EISSOCKET'
  } else {
    err.code = 'EISUNKNOWN'
  }

  err.xcode = 'EUNSUPPORTED'
  return err
}


/**
In a simple test, _write is called one after another, and _final is called
after the last _write finished. Well sequentialized.
*/

class PartStream extends stream.Writable {
  /**
  @param {object} opts
  @param {string} opts.dirPath
  @param {function} opts.handlePrelude
  */
  constructor (opts) {
    super({ objectMode: true })

    this.dirPath = opts.dirPath
    this.handlePrelude = opts.handlePrelude
    this.error = null
  }

  parseHeader (header) {
    let name, filename
    // fix %22
    // let x = header['content-disposition'][0].split('; ')
    let x = Buffer.from(header['content-disposition'][0], 'binary')
      .toString('utf8')
      .replace(/%22/g, '"')
      .split('; ')

    if (x.length < 2 || x.length > 3) throw new Error('invalid header')
    if (x[0] !== 'form-data') throw new Error('invalid header')
    if (x[1].length <= 'name=""'.length) throw new Error('invalid name field')
    if (!x[1].startsWith('name="') || !x[1].endsWith('"')) throw new Error('invalid name field')

    name = x[1].slice(6, -1)
    if (x.length === 2) {
      if (name !== 'directory' && name !== 'prelude') throw new Error('invalid name')
    } else {
      if (name === 'file' || name === 'remove') {
        if (x[2].length <= 'filename=""'.length) throw new Error('invalid filename field')
        if (!x[2].startsWith('filename="') || !x[2].endsWith('"')) throw new Error('invalid filename field')
        filename = x[2].slice(10, -1)
        if (sanitize(filename) !== filename) throw new Error('invalid filename')
      } else {
        throw new Error('invalid name')      
      }
    }
    return { name, filename }

  }

  _write (part, _, _callback) {
    if (this.error) return _callback(this.error)

    let name, filename, buffers, ws

    const callback = err => {
      if (err) this.error = err
      _callback(err)
    }

    const handleError = err => {
      debug('handleError', err.code, err.message)
      err.index = part.index
      part.removeAllListeners()
      part.on('error', () => {})
      if (ws) {
        ws.removeAllListeners()
        ws.on('error', () => {})
        ws.destroy()
      }
      callback(err)
    }

    const handlePartData = data => {
      debug('handlePartData', part.index)
      if (name === 'prelude' || name === 'directory') {
        buffers.push(data)
//      } else if (name === 'file') {
//        ws.write(data)
      } else {
        handleError(new Error(`internal error, part on data, unexpected name: ${name}`))
      }
    }

    const handlePartEnd = () => {
      debug('handlePartEnd', part.index)

      if (name === 'prelude') {
        let prelude
        try {
          prelude = JSON.parse(Buffer.concat(buffers))
        } catch (err) {
          err.status = 400
          return handleError(err)
        }

        this.handlePrelude(prelude, (err, dirPath) => {
          if (err) return handleError(err)
          this.dirPath = dirPath
          callback()
        })
      } else if (name === 'directory') {
        let dirname = Buffer.concat(buffers).toString()
        if (sanitize(dirname) !== dirname) {
          let err = new Error('invalid dir name')
          err.status = 400
          handleError(err)
        } else {
          let dirPath = path.join(this.dirPath, dirname)

          fs.lstat(dirPath, (err, stats) => {
            if (err) {
              if (err.code === 'ENOENT') {
                mkdirp(dirPath, err => err ? handleError(err) : callback())
              } else {
                handleError(err)
              }
            } else {
              let err
              if (stats.isDirectory()) {
                callback()
              } else if (stats.isFile()) {
                let err = new Error('target is a file')
                err.code = 'EISFILE'
                err.status = 403
                handleError(err)
              } else {
                let err = EUnsupported(stats)
                err.status = 403
                handleError(err)
              }
            }
          })

        }
      } else if (name === 'file') {
        // ws.end()
      } else if (name === 'remove') {
        let target = path.join(this.dirPath, filename) 
        rimraf(target, err => err ? handleError(err) : callback())
      } else {
        handleError(new Error(`internal error, part on end, unexpected name: ${name}`))
      }
    }

    const handlePartHeader = header => {
      debug('handlePartHeader', part.index)

      try {
        let h = this.parseHeader(header)
        name = h.name
        filename = h.filename

        if (part.index === -1 && name !== 'prelude') throw new Error('prelude expected')
        if (name === 'prelude' && part.index !== -1) throw new Error('prelude twice')
        if (name === 'prelude' || name === 'directory') {
          buffers = []
          part.on('data', handlePartData)
          part.on('end', handlePartEnd)
        } else if (name === 'remove') {
          part.on('data', () => {}) 
          part.on('end', handlePartEnd) 
        } else {
          let filePath = path.join(this.dirPath, filename)
          fs.lstat(filePath, (err, stats) => {
            if (err) {
              if (err.code !== 'ENOENT') return handleError(err)
            } else {
              let err
              if (stats.isFile()) {
                err = new Error('target exists')
                err.code = 'EEXIST'
              } else if (stats.isDirectory()) {
                err = new Error('target is a directory')
                err.code = 'EISDIR'
              } else {
                err = EUnsupported(stats)
              }
              err.status = 403
              return handleError(err)
            }

            ws = fs.createWriteStream(path.join(this.dirPath, filename))
            ws.on('error', handleError)
            ws.on('finish', () => callback())
            // part.on('data', handlePartData)
            // part.on('end', handlePartEnd)
            part.pipe(ws) 
          })
        }
      } catch (err) {
        err.index = part.index
        err.status = 400
        return handleError(err)
      }
    }

    part.on('error', handleError)

    if (part.header) {
      handlePartHeader(part.header, false)
    } else {
      part.removeAllListeners('header')
      part.on('header', header => handlePartHeader(header, true))
    }

  }
}

module.exports = PartStream
