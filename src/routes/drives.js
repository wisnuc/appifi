const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')
const stream = require('stream')
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

const f = af => (req, res, next) => af(req, res).then(x => x, next)

const EFruitUnavail = Object.assign(new Error('fruitmix unavailable'), { status: 503 })
const fruitless = (req, res, next) => getFruit() ? next() : next(EFruitUnavail) 

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

  let name, filename, fromName, toName, opts
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

    if (!Number.isInteger(size)) 
      throw new Error('size must be a integer')

    if (size > 1024 * 1024 * 1024 || size < (append ? 1 : 0)) 
      throw new Error('size out of range')

    if (!isSHA256(sha256)) {
      if (size === 0) {
        sha256 = EMPTY_SHA256_HEX 
      } else {
        throw new Error('invalid sha256')
      }
    }

    if (overwrite !== undefined && !isUUID(overwrite)) 
      throw new Error('overwrite is not a valid uuid string')

    if (append !== undefined && !isSHA256(append))
      throw new Error('append is not a valid fingerprint string')

    opts = { size, sha256, append, overwrite }

    return { type: 'file', name, fromName, toName, opts }
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
    console.log(x) 
    console.log('  parts', num(parts))
    console.log('  parsers_', num(parsers), num(parsers_))
    console.log('  pipes, drains_', num(pipes), num(drains), num(drains_))
    console.log('  _dryrun_', _dryrun, dryrun, dryrun_)
    console.log('  executions', num(executions))
    console.log('  r', num(r))
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
    if (x.hasOwnProperty('data')) {
      return { 
        number: x.number,
        name: x.name,
        data: x.data 
      }
    } else {
      let { status, errno, code, syscall, path, dest, message } = x.error
      return { 
        number: x.number,
        name: x.name,
        error: { status, message, code, errno, syscall, path, dest } 
      }
    } 
  })

  const predecessorErrored = x => !!r
    .slice(0, x.number)
    .find(y => y.toName === x.fromName && y.error)

  const setError = (number, error) => r[number].error = r[number].error || error

  const error = (y, err) => {

    console.log('======== error begin ========')
    console.log('error', y.number, err)
    print()

    setError(y.number, err)

    // clear parts
    parts.forEach(x => {
      x.part.removeAllListeners()
      x.part.on('error', () => {})
      setError(x.number, EDestroyed)
    })
    parts.splice(0, -1)

    // clear pipes
    pipes.forEach(x => {
      x.destroyPipe()
      rimraf(x.tmp, () => {})
      setError(x.number, EDestroyed)
    })
    pipes.splice(0, -1)

    parsers.forEach(x => {
      x.part.removeAllListeners()
      x.part.on('error', () => {})
      setError(x.number, EDestroyed)
    })
    parsers.splice(0, -1)

    // for drains and drains_, the remaining job must NOT have errored predecessor
    while (true) {
      let index = drains.findIndex(predecessorErrored)
      if (index !== -1) {
        let x = drains[index]
        x.destroyDrain()
        drains.splice(index, 1)
        setError(x.number, EDestroyed)
      } else {
        index = drains_.findIndex(predecessorErrored)
        if (index !== -1) {
          let x = drains_[index]
          drains_.splice(index, 1)
          setError(x.number, EDestroyed)
        } else {
          index = parsers_.findIndex(predecessorErrored) 
          if (index !== -1) {
            let x = parsers_[index]
            parsers_.splice(index, 1)
            setError(x.number, EDestroyed)
          } else {
            break
          }
        }
      }
    }

    // clear (orphan) dryrun
    const remaining = [...drains, ...drains_].map(x => x.number)
    let i
    while (i = _dryrun.findIndex(x => remaining.includes(x.number)), i !== -1) _dryrun.splice(i, 1) 
    while (i = dryrun.findIndex(x => remaining.includes(x.number)), i !== -1) dryrun.splice(i, 1) 
    while (i = dryrun_.findIndex(x => remaining.includes(x.number)), i !== -1) dryrun_.splice(i, 1)

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
    Object.assign(r[x.number], { data })
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

  let count = 0
  const onPart = part => { 
    let x = { number: count++, part }
    parts.push(x)
    part.on('error', err => {
      parts.splice(parts.indexOf(x), 1)
      x.part.removeAllListeners()
      x.part.on('error', () => {})
      error(x.number, err)
    })

    part.on('header', guard('on header', header => {
      parts.splice(parts.indexOf(x), 1)
      x.part.removeAllListeners()

      let props
      try {
        props = parseHeader(header)
      } catch (e) {
        x.part.on('error', () => {})
        error(x.number, e)
        return
      }

      Object.assign(x, props)
      r[x.number] = { 
        number: x.number,
        name: props.name,
        fromName: props.fromName, 
        toName: props.toName 
      }
      x.opts ?  onFile(x) : onField(x)
    }))
  }

  const onFile = x => {
    pipes.push(x) 
    x.tmp = path.join(getFruit().getTmpDir(), UUID.v4())
    x.destroyPipe = pipeHash(x.part, x.tmp, (err, { hash, bytesWritten }) => {
      delete x.part
      delete x.destroyPipe
      pipes.splice(pipes.indexOf(x), 1) 

      if (err) return error(x.number, err) 
      if (bytesWritten !== x.opts.size) {
        hash.on('error', () => {})
        hash.kill()
        return error(x.number, new Error('size mismatch'))   
      }

      drains.push(x) 
      x.destroyDrain = drainHash(hash, bytesWritten, (err, digest) => {
        delete x.destroyDrain
        drains.splice(drains.indexOf(x), 1)

        if (err) return error(x.number, err)
        if (digest !== x.opts.sha256) return error(x.number, new Error('hash mismatch'))
  
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
        delete x.buffers
      } catch (e) {
        return error(x.number, e)
      }

      // push into executions, or do executions
      parsers_.push(x)
      schedule()
    }))
  }

  const execute = x => {
    executions.push(x)

    if (x.opts) { // file
      if (x.opts.append) {
          
      } else {
        getFruit().createNewFile(user, driveUUID, dirUUID, x.toName, x.tmp, x.digest, x.opts.overwrite, 
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
      getFruit().mkdirp(user, driveUUID, dirUUID, x.toName, (err, xstat) => {
        executions.splice(executions.indexOf(x), 1)
        if (err) {
          error(x, err)
        } else {
          success(x, xstat)
        }
      })
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
  dicer.on('part', guard('on part', onPart))
  dicer.on('finish', () => {
    // FIXME dicer finished twice, observed in test ba4bf055 (mkdir)
    console.log('dicer finished ====================================================== ')
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

