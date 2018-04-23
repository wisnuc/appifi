const Promise = require('bluebird')
const path = require('path')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const sanitize = require('sanitize-filename')
const UUID = require('uuid')
const { isSHA256, isUUID } = require('../lib/assertion')
const Dicer = require('dicer')
const HashStream = require('../lib/hash-stream')

const Debug = require('debug')
const debug = Debug('writedir')

const EMPTY_SHA256_HEX = crypto.createHash('sha256').digest('hex')

const EDestroyed = Object.assign(new Error('destroyed'), {
  code: 'EDESTROYED',
  status: 403
})

/**
030 POST dir entries
*/
const parseHeader = header => {

  let name, filename, fromName, toName
  // let x = header['content-disposition'][0].split('; ')
  let x = Buffer.from(header['content-disposition'][0], 'binary').toString('utf8').replace(/%22/g, '"').split('; ')
  //fix %22

  if (x[0] !== 'form-data') throw new Error('not form-data')
  if (!x[1].startsWith('name="') || !x[1].endsWith('"')) throw new Error('invalid name')
  name = x[1].slice(6, -1)

  // validate name and generate part.fromName and .toName
  let split = name.split('|')
  if (split.length === 0 || split.length > 2) throw new Error('invalid name')
  if (!split.every(name => name === sanitize(name))) throw new Error('invalid name')
  fromName = split.shift()
  toName = split.shift() || fromName

  if (x.length > 2) {
    if (!x[2].startsWith('filename="') || !x[2].endsWith('"')) throw new Error('invalid filename')
    filename = x[2].slice(10, -1)

    // validate part.filename and generate part.opts
    let { size, sha256, append, overwrite } = JSON.parse(filename)
    let op = append ? 'append' : 'newfile'
    return { type: 'file', op, name, fromName, toName, size, sha256, append, overwrite }
  } else {
    return { type: 'field', name, fromName, toName }
  }
}

// for debug
const print = x => {
  debug(x)
  debug('  parts', num(parts))
  debug('  parsers_', num(parsers), num(parsers_))
  debug('  pipes, pipes_', num(pipes), num(pipes_))
  debug('  _dryrun', _dryrun)
  debug('  dryrun', dryrun)
  debug('  dryrun_', dryrun_)
  debug('  executions', num(executions))
  debug('  r', num(r))
}

const print2 = x => {
  try {
    console.log(x)
    console.log('  parts', num(parts))
    console.log('  parsers_', num(parsers), num(parsers_))
    console.log('  pipes, pipes_', num(pipes), num(pipes_))
    console.log('  _dryrun', _dryrun)
    console.log('  dryrun', dryrun)
    console.log('  dryrun_', dryrun_)
    console.log('  executions', num(executions))
    console.log('  r', num(r))
  } catch (e) {
    console.log(e)
  }
}


/**
  const assertNoDup = () => {
    const all = [
      ...num(parts),
      ...num(parsers),
      ...num(parsers_),
      ...num(pipes),
      ...num(pipes_),
      ...num(executions)
    ]

    let set = new Set(all)
    if (set.size !== all.length) throw new Error('duplicate found')
  }
**/

const guard = (message, f) => ((...args) => {
  // print(`--------------------- ${message} >>>> begin`)
  try {
    f(...args)
  } catch (e) {
    console.log(e)
  }
  // print(`--------------------- ${message} <<<< end`)
})

const upload = (fruit, driveUUID, dirUUID, req, callback) => {
  // set dicer to null to indicate all parts have been generated. 
  let dicer

  /**
  parts (new) -> [ parser | parsers_ ) -> execute
        (new) -> | -> ( pipes  | pipes_ )  -> | -> execute
                 | -> ( _dryrun | dryrun  | dryrun_ ) -> |
  **/


  // enter: x { number, part }
  // do: part on ['error', 'header']
  // exit: x { number, part } 
  const parts = []

  // x { number, type, name, fromName, toName, part, buffers  }
  const parsers = []
  const parsers_ = []

  // file
  // x { number, type, name, fromName, toName, opts, part, tmp, destroyPipe }
  const pipes = []
  const pipes_ = []

  // x { number }
  let _dryrun = []
  let dryrun = []
  let dryrun_ = []

  /**
  file { number, ..., tmp, bytesWritten, digest }
  field { number, ..., ??? }
  **/
  const executions = []

  const r = []
  const num = arr => arr.map(x => x.number)

  const isFinished = x => x.hasOwnProperty('data') || x.hasOwnProperty('error')
  const settled = () => dicer === null && r.every(isFinished)

  const statusCode = () => {
    let xs = r.filter(x => x.hasOwnProperty('error'))
    if (xs.length === 0) return 200
    if (xs.find(x => x.error.status === 400)) return 400
    return 403
  }

  const response = () => {
    let body = r
      .map(x => {
        let obj = {
          number: x.number,
          op: x.op,
          name: x.name,
        }

        if (x.type === 'file') {
          obj.size = x.size
          obj.sha256 = x.sha256
          obj.append = x.append
          obj.overwrite = x.overwrite
        } else {
          obj.parents = x.parents
          obj.uuid = x.uuid
          obj.overwrite = x.overwrite
        }

        if (x.hasOwnProperty('data')) {
          obj.data = x.data
        } else {
          let { status, errno, code, syscall, path, dest, message } = x.error
          obj.error = { status, message, code, errno, syscall, path, dest }
        }

        return obj
      })

    // res.status(statusCode()).json(body)
    callback(statusCode(), body)
  }

  const predecessorErrored = x => !!r
    .slice(0, x.number)
    .find(y => y.toName === x.fromName && y.error)

  const error = (y, err) => {
    if (process.env.NODE_PATH === undefined) {
      console.log('======== error begin ========')
      console.log('job', y)
      console.log('error', err)
      print2()
    }

    let { size, sha256, append, overwrite, op, parents, uuid } = y

    y.error = y.error || err

    // clear parts
    parts.forEach(x => {
      x.part.removeAllListeners()
      x.part.on('error', () => { })
      x.error = x.error || EDestroyed
    })
    parts.splice(0)

    // clear streaming hash stream
    while (true) {
      let index = pipes.findIndex(x => !!x.hs.rs)
      if (index !== -1) {
        let x = pipes[index]
        x.hs.destroy()
        x.hs = null
        // rimraf(x.tmp, () => {}) TODO do this? or hash-stream will do it?
        pipes.splice(index, 1)
        x.error = x.error || EDestroyed
      } else {
        break
      }
    }

    parsers.forEach(x => {
      x.part.removeAllListeners()
      x.part.on('error', () => { })
      x.error = x.error || EDestroyed
    })
    parsers.splice(0)

    while (true) {
      let index = pipes.findIndex(predecessorErrored)
      if (index !== -1) {
        let x = pipes[index]
        x.hs.destroy()
        // rimraf(x.tmp, () => {}) TODO ???
        pipes.splice(index, 1)
        x.error = x.error || EDestroyed
      } else {
        index = pipes_.findIndex(predecessorErrored)
        if (index !== -1) {
          let x = pipes_[index]
          rimraf(x.tmp, () => { })
          pipes_.splice(index, 1)
          x.error = x.error || EDestroyed
        } else {
          index = parsers_.findIndex(predecessorErrored)
          if (index !== -1) {
            let x = parsers_[index]
            parsers_.splice(index, 1)
            x.error = x.error || EDestroyed
          } else {
            break
          }
        }
      }
    }

    // clear (orphan) dryrun
    const remaining = [...pipes, ...pipes_].map(x => x.number)

    _dryrun = _dryrun.filter(y => remaining.includes(y.number))
    dryrun = dryrun.filter(y => remaining.includes(y.number))
    dryrun_ = dryrun_.filter(y => remaining.includes(y.number))

    if (dicer) {
      dicer.removeAllListeners()
      dicer.on('error', () => { })
      req.unpipe(dicer)
      dicer.end()
      dicer = null
    }

    if (settled()) {
      // res.status(statusCode()).json(response())
      response()
    } else {
      // if there is no concurrency control, then no need to schedule
      // for no job would be started when something errored
    }

    if (process.env.NODE_PATH === undefined) {
      print2('====== error end ======')
    }
  }

  const success = (x, data) => {
    x.data = data
    if (settled()) {
      // res.status(statusCode()).json(response()) 
      response()
    } else {
      schedule()
    }
  }

  const blocked = number => !!r
    .slice(0, number)
    .filter(x => !x.hasOwnProperty('data') && !x.hasOwnProperty('error'))
    .find(x => x.toName === r[number].fromName)

  const dicerOnError = err => {

  }

  let count = 0
  const dicerOnPart = guard('on part', part => {
    let x = { number: count++, part }
    r.push(x)

    parts.push(x)
    part.on('error', err => {
      parts.splice(parts.indexOf(x), 1)
      x.part.removeAllListeners()
      x.part.on('error', () => { })
      delete x.part
      error(x, err)
    })

    part.on('header', guard('on header', header => {
      parts.splice(parts.indexOf(x), 1)
      x.part.removeAllListeners()

      let props
      try {
        props = parseHeader(header)
      } catch (e) {
        x.part.on('error', () => { })
        e.status = 400
        return error(x, e)
      }

      Object.assign(x, props)
      if (x.type === 'file') {
        onFile(x)
      } else {
        onField(x)
      }
    }))
  })

  const onFile = x => {
    // validate
    try {
      if (x.append !== undefined && !isSHA256(x.append))
        throw new Error('append is not a valid fingerprint string')

      if (x.overwrite !== undefined && !isUUID(x.overwrite))
        throw new Error('overwrite is not a valid uuid string')

      if (!Number.isInteger(x.size))
        throw new Error('size must be an integer')

      if (x.size > 1024 * 1024 * 1024)
        throw new Error('size must be less than or equal to 1G')

      if (x.op === 'append') {
        if (x.size < 1)
          throw new Error(`data size must be a positive integer, got ${x.size}`)
      } else {
        if (x.size < 0)
          throw new Error(`data size must be a non-negative integer, got ${x.size}`)
      }

      if (x.size === 0) {
        // forcefully do this, even if wrong value provided
        x.sha256 = EMPTY_SHA256_HEX
      } else {
        if (!isSHA256(x.sha256)) throw new Error('invalid sha256')
      }
    } catch (e) {
      e.status = 400
      return error(x, e)
    }

    pipes.push(x)
    x.tmp = path.join(fruit.getTmpDir(), UUID.v4())

    let aggressive = !(req.socket.bytesRead + x.size > parseInt(req.header('content-length')))
    x.hs = HashStream.createStream(x.part, x.tmp, x.size, x.sha256, aggressive)
    x.hs.on('finish', err => {
      let digest = x.hs.digest
      delete x.part
      delete x.hs
      pipes.splice(pipes.indexOf(x), 1)

      if (err) {
        if (err.code === 'EOVERSIZE' ||
          err.code === 'EUNDERSIZE' ||
          err.code === 'ESHA256MISMATCH') {
          err.status = 400
        } else {
          console.log('hash stream error code', err.code, x.hs)
        }
        error(x, err)
      } else {
        x.digest = digest
        pipes_.push(x)
        schedule()
      }
    })

    _dryrun.push({ number: x.number })
    try {
      schedule()
    } catch (e) {
      console.log(e)
    }
  }

  const onField = x => {
    parsers.push(x)
    x.buffers = []
    x.part.on('data', data => x.buffers.push(data))
    x.part.on('end', guard('on part end', () => {
      parsers.splice(parsers.indexOf(x), 1)
      delete x.part

      try {
        Object.assign(x, JSON.parse(Buffer.concat(x.buffers)))
      } catch (e) {
        e.status = 400
        return error(x, e)
      }

      delete x.buffers

      try {
        switch (x.op) {
          case 'mkdir':
            if (x.hasOwnProperty('parents') && x.parents !== true)
              throw new Error('parents must be true if provided')
            break

          case 'dup':
            if (x.fromName === x.toName)
              throw new Error('dup requires two distinct names')
            if (x.hasOwnProperty('overwrite') && !isUUID(x.overwrite))
              throw new Error('overwrite must be valid uuid if provided')
            break

          case 'rename':
            if (x.fromName === x.toName)
              throw new Error('rename requires two distinct names')
            if (x.hasOwnProperty('overwrite') && !isUUID(x.overwrite))
              throw new Error('overwrite must be valid uuid if provided')
            break

          case 'remove':
            if (!isUUID(x.uuid)) throw new Error('invalid uuid')
            break

          case 'addTags':
            if (!Array.isArray(x.tags) || x.tags.every(t => isUUID(t))) throw new Error('invalid tagId')
            break

          case 'removeTags':
            if (!Array.isArray(x.tags) || x.tags.every(t => isUUID(t))) throw new Error('invalid tagId')
            break

          case 'setTags':
            if (!Array.isArray(x.tags) || x.tags.every(t => isUUID(t))) throw new Error('invalid tagId')
            break

          case 'resetTags':
            break
          default:
            throw new Error('invalid op')
            break
        }
      } catch (e) {
        e.status = 400
        return error(x, e)
      }

      // push into executions, or do executions
      parsers_.push(x)
      schedule()
    }))
  }

  const execute = x => {
    executions.push(x)
    if (x.type === 'file') { // file
      if (x.append) {
        let tmp = { path: x.tmp, size: x.size, sha256: x.sha256 }
        fruit.appendFile(user, driveUUID, dirUUID, x.toName, x.append, tmp, (err, xstat) => {
          executions.splice(executions.indexOf(x), 1)
          rimraf(x.tmp, () => { })
          if (err) {
            error(x, err)
          } else {
            success(x, xstat)
          }
        })
      } else {
        fruit.createNewFile(user, driveUUID, dirUUID, x.toName, x.tmp, x.digest, x.overwrite,
          guard('on new file return', (err, xstat) => {
            executions.splice(executions.indexOf(x), 1)
            rimraf(x.tmp, () => { })
            if (err) {
              error(x, err)
            } else {
              success(x, xstat)
            }
          }))
      }
    } else { // field
      switch (x.op) {
        case 'mkdir':
          fruit.mkdirp(user, driveUUID, dirUUID, x.toName, (err, xstat) => {
            executions.splice(executions.indexOf(x), 1)
            if (err) {
              error(x, err)
            } else {
              success(x, xstat)
            }
          })
          break
        case 'remove':
          fruit.rimraf(user, driveUUID, dirUUID, x.toName, x.uuid, err => {
            executions.splice(executions.indexOf(x), 1)
            if (err) {
              error(x, err)
            } else {
              success(x, null)
            }
          })
          break
        case 'rename':
          fruit.rename(user, driveUUID, dirUUID, x.fromName, x.toName, x.overwrite, (err, xstat) => {
            executions.splice(executions.indexOf(x), 1)
            if (err) {
              error(x, err)
            } else {
              success(x, xstat)
            }
          })
          break
        case 'dup':
          fruit.dup(user, driveUUID, dirUUID, x.fromName, x.toName, x.overwrite, (err, xstat) => {
            executions.splice(executions.indexOf(x), 1)
            if (err) {
              error(x, err)
            } else {
              success(x, xstat)
            }
          })
          break
        case 'addTags':
          fruit.fileAddTags(user, driveUUID, dirUUID, x.fromName, x.tags.map(t => parseInt(t)), (err, xstat) => {
            executions.splice(executions.indexOf(x), 1)
            if (err) {
              error(x, err)
            } else {
              success(x, xstat)
            }
          })
          break
        case 'removeTags':
          fruit.fileRemoveTags(user, driveUUID, dirUUID, x.fromName, x.tags.map(t => parseInt(t)), (err, xstat) => {
            executions.splice(executions.indexOf(x), 1)
            if (err) {
              error(x, err)
            } else {
              success(x, xstat)
            }
          })
          break
        case 'resetTags':
          fruit.fileResetTags(user, driveUUID, dirUUID, x.fromName, (err, xstat) => {
            executions.splice(executions.indexOf(x), 1)
            if (err) {
              error(x, err)
            } else {
              success(x, xstat)
            }
          })
          break
        case 'setTags':
          fruit.fileSetTags(user, driveUUID, dirUUID, x.fromName, x.tags.map(t => parseInt(t)), (err, xstat) => {
            executions.splice(executions.indexOf(x), 1)
            if (err) {
              error(x, err)
            } else {
              success(x, xstat)
            }
          })
          break
        default:
          break
      }
    }
  }

  const schedule = () => {
    // dryrun
    while (true) {
      let y = _dryrun.find(y => !blocked(y.number))
      if (!y) break
      _dryrun.splice(_dryrun.indexOf(y), 1)
      dryrun.push(y)
      setTimeout(() => {
        dryrun.splice(dryrun.indexOf(y), 1)
        dryrun_.push(y)
        schedule()
      }, 0)
    }

    // parser_
    while (true) {
      let x = parsers_.find(x => !blocked(x.number))
      if (!x) break
      parsers_.splice(parsers_.indexOf(x), 1)
      execute(x)
    }

    // pipes_ && dryrun_ join
    while (true) {
      let x = pipes_.find(x => !blocked(x.number) && !!dryrun_.find(y => y.number === x.number))
      if (!x) break
      pipes_.splice(pipes_.indexOf(x), 1)
      let y = dryrun_.find(y => y.number === x.number)
      dryrun_.splice(dryrun_.indexOf(y), 1)
      execute(x)
    }
  }

  const regex = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i
  const m = regex.exec(req.headers['content-type'])

  dicer = new Dicer({ boundary: m[1] || m[2] })
  dicer.on('part', dicerOnPart)
  dicer.on('finish', () => {
    dicer = null
  })

  req.pipe(dicer)
}

module.exports = upload
