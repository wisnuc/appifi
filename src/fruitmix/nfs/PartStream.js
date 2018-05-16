const path = require('path')
const fs = require('fs')
const stream = require('stream')
const mkdirp = require('mkdirp')
const sanitize = require('sanitize-filename')

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
    this.index = this.handlePrelude ? -1 : 0
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
      if (name !== 'file') throw new Error('invalid name')
      if (x[2].length <= 'filename=""'.length) throw new Error('invalid filename field')
      if (!x[2].startsWith('filename="') || !x[2].endsWith('"')) throw new Error('invalid filename field')

      filename = x[2].slice(10, -1)
      if (sanitize(filename) !== filename) throw new Error('invalid filename')
    }
    return { name, filename }
  }

  _write (part, _, _callback) {
    part.index = this.index++
    if (this.error) return _callback(this.error)

    let name, filename, buffers, ws

    const callback = err => {
      if (err) this.error = err
      _callback(err)
    }

    const error = err => {
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

    part.on('error', error)

    part.on('header', header => {
      try {
        let h = this.parseHeader(header)
        name = h.name
        filename = h.filename

        if (part.index === -1 && name !== 'prelude') throw new Error('prelude expected')

        if (name === 'prelude' || name === 'directory') {
          buffers = []
        } else if (name === 'file') {
          ws = fs.createWriteStream(path.join(this.dirPath, filename))
          ws.on('error', error)
          ws.on('finish', () => callback())
        }
      } catch (err) {
        err.index = part.index
        err.status = 400
        return error(err)
      }
    })

    part.on('data', data => {
      if (name === 'prelude' || name === 'directory') {
        buffers.push(data)
      } else if (name === 'file') {
        ws.write(data)
      } else {
        error(new Error('internal error, unexpected name'))
      }
    })

    part.on('end', () => {
      if (name === 'prelude') {
        let prelude
        try {
          prelude = JSON.parse(Buffer.concat(buffers))
        } catch (err) {
          return error(err)
        }

        this.handlePrelude(prelude, (err, dirPath) => {
          if (err) return error(err)
          this.dirPath = dirPath
        })
      } else if (name === 'directory') {
        let dirname = Buffer.concat(buffers).toString()
        if (sanitize(dirname) !== dirname) {
          let err = new Error('invalid dir name')
          err.status = 400
          error(err)
        } else {
          mkdirp(path.join(this.dirPath, dirname), err => err ? error(err) : callback())
        }
      } else if (name === 'file') {
        ws.end()
      } else {
        error(new Error('internal error, unexpected name'))
      }
    })
  }
}

module.exports = PartStream
