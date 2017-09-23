const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')
const stream = require('stream')
const crypto = require('crypto')
const router = require('express').Router()
const auth = require('../middleware/auth')
const sanitize = require('sanitize-filename')
const UUID = require('uuid')
const { isSHA256, isUUID } = require('../lib/assertion')
const Dicer = require('dicer')
const getFruit = require('../fruitmix')
const { pipeHash, drainHash } = require('../lib/tailhash')
const TailHash = require('../lib/hash-stream')
const Writedir = require('../tasks/writedir2')

const Debug = require('debug')

const debug = Debug('writedir')

const f = af => (req, res, next) => af(req, res).then(x => x, next)

const EFruitUnavail = Object.assign(new Error('fruitmix unavailable'), { status: 503 })
const fruitless = (req, res, next) => getFruit() ? next() : next(EFruitUnavail) 

const EMPTY_SHA256_HEX = crypto.createHash('sha256').digest('hex')

/**
Get a fruitmix drive
*/
router.get('/', fruitless, auth.jwt(), (req, res) => 
  res.status(200).json(getFruit().getDriveList(req.user)))

/**
Create a fruitmix drive
*/
router.post('/', fruitless, auth.jwt(), (req, res, next) => 
  getFruit().createPublicDriveAsync(req.user, req.body)
    .then(drive => res.status(200).json(drive))
    .catch(next))

/**
Get single drive
*/
router.get('/:driveUUID', fruitless, auth.jwt(), (req, res, next) => 
  res.status(200).json(getFruit().getDrive(req.user, req.params.driveUUID)))

/**
Patch a drive, only public drive is allowed
*/
router.patch('/:driveUUID', fruitless, auth.jwt(), (req, res, next) => {
  let user = req.user
  let driveUUID = req.params.driveUUID
  getFruit().updatePublicDriveAsync(user, driveUUID, req.body)
    .then(drive => res.status(200).json(drive))
    .catch(next)
})

/**
Delete a public drive
*/
router.delete('/:driveUUID', fruitless, auth.jwt(), (req, res, next) => {
  res.status(403).json({ message: 'not implemented yet' })
})

/**
010 GET dirs
*/
router.get('/:driveUUID/dirs', fruitless, auth.jwt(), (req, res, next) => {

/**
  let { driveUUID } = req.params
  if (!Forest.roots.has(driveUUID)) { return res.status(404).end() }
  res.status(200).json(Forest.getDriveDirs(driveUUID))
**/

  try {
    let dirs = getFruit().getDriveDirs(req.user, req.params.driveUUID)

    res.status(200).json(dirs)
  } catch (e) {
    next(e)
  }
})

/**
020 GET single dir
*/
router.get('/:driveUUID/dirs/:dirUUID', fruitless, auth.jwt(), f(async(req, res) => {
  let user = req.user
  let { driveUUID, dirUUID } = req.params
  let metadata = req.query.metadata === 'true' ? true : false
  let r = await getFruit().getDriveDirAsync(user, driveUUID, dirUUID, metadata)
  res.status(200).json(r)
}))

/**
030 POST dir entries
*/

/**
router.post('/:driveUUID/dirs/:dirUUID/entries', fruitless, auth.jwt(), 
  (req, res, next) => {
    if (!req.is('multipart/form-data')) {
      return res.status(415).json({ message: 'must be multipart/form-data' })
    }
    
    if(!getFruit().userCanWrite(req.user, req.params.driveUUID)) throw Object.assign(new Error('Permission Denied'), { status: 401})
    
    let writer = new Writedir(req)
    writer.on('finish', () => {
      if (writer.error) {
        next(writer.error)
      } else {
        next()
      }
    })
  },
  f(async (req, res) => {
    let user = req.user
    let { driveUUID, dirUUID } = req.params
    let r = await getFruit().getDriveDirAsync(user, driveUUID, dirUUID)
    res.status(200).json(r)
  }))
**/
const parseHeader = header => {

  let name, filename, fromName, toName
  let x = header['content-disposition'][0].split('; ')
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

router.post('/:driveUUID/dirs/:dirUUID/entries', fruitless, auth.jwt(), (req, res, next) => {

  const EDestroyed = Object.assign(new Error('destroyed'), { 
    code: 'EDESTROYED',
    status: 403
  })

  const user = req.user
  const { driveUUID, dirUUID } = req.params

  // set dicer to null to indicate all parts have been generated. 
  let dicer

  /**
  parts (new) -> [ parser | parsers_ ) -> execute
        (new) -> | -> [  pipes  | drains | drains_ ) -> | -> execute
                 | -> ( _dryrun | dryrun | dryrun_ ) -> |
  **/

  // enter: x { number, part }
  // do: part on ['error', 'header']
  // exit: x { number, part } 
  const parts = []

  // x { number, type, name, fromName, toName, part, buffers  }
  const parsers = []
  // x { number, type, name, fromName, toName, ...props } 
  const parsers_ = []

  // file
  // x { number, type, name, fromName, toName, opts, part, tmp, destroyPipe }
  const pipes = []
  // x { number, type, name, fromName, toName, opts, part, tmp, destroyDrain }
  const drains = []
  // x { number, type, name, fromName, toName, opts, tmp, digest }
  const drains_ = []

  // x { number }
  const _dryrun = []
  // x { number }
  const dryrun = []
  // x { number }
  const dryrun_ = []

  /**
  file { number, ..., tmp, bytesWritten, digest }
  field { number, ..., ??? }
  **/
  const executions = []

  const r = []
  const num = arr => arr.map(x => x.number)

  // for debug
  const print = x => {
    debug(x) 
    debug('  parts', num(parts))
    debug('  parsers_', num(parsers), num(parsers_))
    debug('  pipes, drains_', num(pipes), num(drains), num(drains_))
    debug('  _dryrun_', _dryrun, dryrun, dryrun_)
    debug('  executions', num(executions))
    debug('  r', num(r))
  }

  const assertNoDup = () => {
    const all = [
      ...num(parts),
      ...num(parsers),
      ...num(parsers_),
      ...num(pipes),
      ...num(drains),
      ...num(drains_),
      ...num(executions)
    ]

    let set = new Set(all)
    if (set.size !== all.length) throw new Error('duplicate found')
  }

  const guard = (message, f) => ((...args) => {
    // print(`--------------------- ${message} >>>> begin`)
    try {
      f(...args)
    } catch (e) {
      console.log(e)
    }
    // print(`--------------------- ${message} <<<< end`)
  })

  const pluck = (arr, x) => {
    let index = arr.indexOf(x)
    arr.splice(index, 1)
  }

  const isFinished = x => x.hasOwnProperty('data') || x.hasOwnProperty('error') 
  const settled = () => dicer === null && r.every(isFinished) 

  const statusCode = () => {
    let xs = r.filter(x => x.hasOwnProperty('error'))
    if (xs.length === 0) return 200   
    if (xs.find(x => x.error.status === 400)) return 400
    return 403
  }

  const response = () => r.map(x => {

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

  const predecessorErrored = x => !!r
    .slice(0, x.number)
    .find(y => y.toName === x.fromName && y.error)

  const error = (y, err) => {

    let { size, sha256, append, overwrite, op, parents, uuid } = y

    debug('======== error begin ========')
    debug('error', y.number, err)
    print()

    y.error = y.error || err

    // clear parts
    parts.forEach(x => {
      x.part.removeAllListeners()
      x.part.on('error', () => {})
      x.error = x.error || EDestroyed
    })
    parts.splice(0, -1)

    // clear pipes
    pipes.forEach(x => {
      x.destroyPipe()
      rimraf(x.tmp, () => {})
      x.errror = x.error || EDestroyed
    })
    pipes.splice(0, -1)

    parsers.forEach(x => {
      x.part.removeAllListeners()
      x.part.on('error', () => {})
      x.error = x.error || EDestroyed
    })
    parsers.splice(0, -1)

    // for drains and drains_, the remaining job must NOT have errored predecessor
    while (true) {
      let index = drains.findIndex(predecessorErrored)
      if (index !== -1) {
        let x = drains[index]
        x.destroyDrain()
        drains.splice(index, 1)
        x.error = x.error || EDestroyed
      } else {
        index = drains_.findIndex(predecessorErrored)
        if (index !== -1) {
          let x = drains_[index]
          drains_.splice(index, 1)
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
    const remaining = [...drains, ...drains_].map(x => x.number)
    let i
    while (i = _dryrun.findIndex(x => remaining.includes(x.number)), i !== -1) 
      _dryrun.splice(i, 1) 
    while (i = dryrun.findIndex(x => remaining.includes(x.number)), i !== -1) 
      dryrun.splice(i, 1) 
    while (i = dryrun_.findIndex(x => remaining.includes(x.number)), i !== -1) 
      dryrun_.splice(i, 1)

    if (dicer) {
      dicer.removeAllListeners()
      dicer.on('error', () => {})
      req.unpipe(dicer)
      dicer.end()
      dicer = null
    }

    if (settled()) {
      res.status(statusCode()).json(response())
    } else {
      // if there is no concurrency control, then no need to schedule
      // for no job would be started when something errored
    }

    print('====== error end ======')
  }

  const success = (x, data) => {
    x.data = data
    if (settled()) {
      res.status(statusCode()).json(response()) 
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
      x.part.on('error', () => {})
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
        x.part.on('error', () => {})
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
    x.tmp = path.join(getFruit().getTmpDir(), UUID.v4())
    x.destroyPipe = pipeHash(x.part, x.tmp, (err, { hash, bytesWritten }) => {
      delete x.part
      delete x.destroyPipe
      pipes.splice(pipes.indexOf(x), 1) 

      if (err) return error(x.number, err) 
      if (bytesWritten !== x.size) {
        hash.on('error', () => {})
        hash.kill()
        let e = new Error(`size mismatch, actual: ${bytesWritten}`)
        e.status = 400
        return error(x, e)
      }

      drains.push(x) 
      x.destroyDrain = drainHash(hash, bytesWritten, (err, digest) => {
        delete x.destroyDrain
        drains.splice(drains.indexOf(x), 1)

        if (err) return error(x, err)
        if (digest !== x.sha256) {
          let e = new Error(`sha256 mismatch, actual: ${digest}`)
          e.status = 400
          return error(x, e)
        }
  
        x.digest = digest
        drains_.push(x)
        schedule()
      })
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
              throw new Error('dup requires two distinct file name')
            if (x.hasOwnProperty('overwrite') && !isUUID(x.overwrite))
              throw new Error('overwrite must be valid uuid if provided')
            break

          case 'rename':
            if (x.fromName === x.toName)
              throw new Error('rename requires two distinct name')
            if (x.hasOwnProperty('overwrite') && isUUID(x.overwrite))
              throw new Error('overwrite must be valid uuid if provided')
            break

          case 'remove':
            if (!isUUID(x.uuid)) throw new Error('invalid uuid')
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
        let tmp = {
          path: x.tmp,
          size: x.size,
          sha256: x.sha256
        }

        console.log('append ===============================')
        console.log(x)
        console.log('append ===============================')

        getFruit().appendFile(user, driveUUID, dirUUID, x.toName, x.append, tmp, (err, xstat) => {
          if (err) {
            error(x, err)
          } else {
            success(x, xstat)
          }
        })
      } else {
        getFruit().createNewFile(user, driveUUID, dirUUID, x.toName, x.tmp, x.digest, x.overwrite, 
          guard('on new file return', (err, xstat) => {
            executions.splice(executions.indexOf(x), 1)
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
          getFruit().mkdirp(user, driveUUID, dirUUID, x.toName, (err, xstat) => {
            executions.splice(executions.indexOf(x), 1)
            if (err) {
              error(x, err)
            } else {
              success(x, xstat)
            }
          })
          break
        case 'remove':
          getFruit().rimraf(user, driveUUID, dirUUID, x.toName, x.uuid, err => {
            executions.splice(executions.indexOf(x), 1)
            if (err) {
              error(x, err)
            } else {
              success(x, null)
            }
          })
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
        pluck(dryrun, y)
        dryrun_.push(y)
        schedule()
      }, 50)
    }

    // parser_
    while (true) {
      let x = parsers_.find(x => !blocked(x.number))
      if (!x) break
      parsers_.splice(parsers_.indexOf(x), 1)
      execute(x)
    }

    // drains_ && dryrun_ join
    while (true) {
      let x = drains_.find(x => !blocked(x.number) && !!dryrun_.find(y => y.number === x.number)) 
      if (!x) break
      drains_.splice(drains_.indexOf(x), 1)
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
})

/**
040 GET a single entry (download a file)
*/
router.get('/:driveUUID/dirs/:dirUUID/entries/:entryUUID', fruitless, auth.jwt(), 
  (req, res) => {
    let user = req.user
    let { driveUUID, dirUUID } = req.params
    let { name } = req.query
    // let dir = Forest.getDriveDir(driveUUID, dirUUID)
    let dirPath = getFruit().getDriveDirPath(user, driveUUID, dirUUID)
    let filePath = path.join(dirPath, name)

    // let xstat = await readXstatAsync(filePath)
    // confirm fileUUID TODO
    // move to fruitmix TODO

    res.status(200).sendFile(filePath)
  })

module.exports = router

