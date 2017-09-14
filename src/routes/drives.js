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
const TailHash = require('../lib/hash-stream')
const Writedir = require('../tasks/writedir2')

const f = af => (req, res, next) => af(req, res).then(x => x, next)

const EFruitUnavail = Object.assign(new Error('fruitmix unavailable'), { status: 503 })
const fruitless = (req, res, next) => getFruit() ? next() : next(EFruitUnavail) 

/**
Get a fruitmix drive
*/
router.get('/', fruitless, auth.jwt(), (req, res) => 
  res.status(200).json(getFruit().getDrives(req.user)))

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

    return { type: 'file', fromName, toName, opts }
  } else {
    return { type: 'field', fromName, toName }
  }
}

/**
both dicer and part emit error
**/

/**
router.post('/:driveUUID/dirs/:dirUUID/entries', fruitless, auth.jwt(), (req, res, next) => {

  const user = req.user
  const { driveUUID, dirUUID } = req.params

  const regex = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i
  const m = regex.exec(req.headers['content-type'])

  let writedir = new Writedir({ user, driveUUID, dirUUID })
  let dicer = new Dicer({ boundary: m[1] || m[2] }) 

  writedir.once('error', err => {
    if (!dicer) return
    req.unpipe()
    dicer.removeAllListeners('error')
    dicer.end()
  })

  writedir.on('finish', () => {
    res.status(200).json(writedir.queue)
  })

  dicer.on('part', part => {
    part.on('header', header => {
      try {
        let props = parseHeader(header)
        writedir.push(part, props)

        if (props.filename) {
            
        } else {
          
        }

      } catch (e) {
        if (e) {
          part.removeAllListeners()
          dicer.removeAllListeners()
          req.unpipe()
          next(e)
        } 
      }

    })
  })

  dicer.once('error', err => {
    writedir.removeAllListeners('error') 
    req.unpipe()
    dicer.end()
  }) 

  dicer.on('finish', () => {
    writedir.end()
    dicer = null
  })

  req.pipe(dicer)
})
**/

router.post('/:driveUUID/dirs/:dirUUID/entries', fruitless, auth.jwt(), (req, res, next) => {

  const user = req.user
  const { driveUUID, dirUUID } = req.params
  let dicer

  /**

  parts (new) -> [ parser | parsers_ ) -> execute

        (new) -> | -> [ fopen | pipes | hashers | hashers_ ) -> |
                 |                                              | -> execute
                 | -----> ( _dryrun | dryrun | dryrun_ ) -----> |
  **/

  // x { number, part }
  const parts = []

  /**
  **/
  const parsers = []

  /**
  **/
  const parsers_ = []

  // x { number, ..., part, tmp }
  const fopen = []

  /**
  x { number, ..., part, tmp, fd, ws, hs }
  **/
  const pipes = []

  /**
  x { number, ..., tmp, bytesWritten, hs }
  */
  const hashers = []

  /**
  x { number, ..., tmp, bytesWritten, digest }
  **/
  const hashers_ = []

  const _dryrun = []
  const dryrun = []
  const dryrun_ = []

  /**
  file { number, ..., tmp, bytesWritten, digest }
  field { number, ..., ??? }
  **/
  const executions = []

  const r = []

  // for debug
  const print = x => {
    console.log(x) 
    console.log('  parts', parts.map(p => p.number))
    console.log('  parsers_', parsers, parsers_)
    console.log('  fopen', fopen.map(x => x.tmp))
    console.log('  pipes', pipes.map(x => x.number))
    console.log('  hashers_', hashers.map(x => x.number), hashers_.map(x => x.number))
    console.log('  _dryrun_', _dryrun, dryrun, dryrun_)
    console.log('  executions', executions.map(x => x.number))
    console.log('  r', r)
  }

  const guard = (message, f) => {
    return (...args) => {
      print(`--------------------- ${message} >>>> begin`)
      f(...args)
      print(`--------------------- ${message} <<<< end`)
    }
  }

  const pluck = (arr, x) => {
    let index = arr.indexOf(x)
    arr.splice(index, 1)
  }

  const error = (y, err) => {

    r[y.number].error = err

    parts.forEach(x => {
      x.part.removeAllListeners('error')
      x.part.on('error', () => {})
      x.part.removeAllListeners('header')

      if (x.number !== y.number) r[x.number].error = new Error('destroyed')
    })
    parts.splice(0, -1)

    fopen.forEach(x => {
      x.part.removeAllListeners('error')
      x.part.on('error', () => {})

      if (x.number !== y.number) r[x.number].error = new Error('destroyed')
    }) 

    fopen.splice(0, -1)

    pipes.forEach(x => {
      x.part.removeAllListeners('error')
      x.part.on('error', () => {})
      x.ws.removeAllListeners('error')
      x.ws.on('error', () => {})
      x.ws.removeAllListeners('finish')
      x.hs.removeAllListeners('error')
      x.hs.on('error', () => {})
      x.hs.removeAllListeners('data')
      x.part.unpipe()
      x.ws.destroy()
      x.hs.destroy()
      rimraf(x.tmp, () => {})

      if (x.number !== y.number) r[x.number].error = new Error('destroyed')
    })
    pipes.splice(0, -1)

    hashers.forEach(x => {
      x.hs.removeAllListners('error')  
      x.hs.on('error', () => {})
      x.hs.removeAllListners('data')
      x.hs.destroy()
      rimraf(x.tmp, () => {})

      if (x.number !== y.number) r[x.number].error = new Error('destroyed')
    }) 
    hashers.splice(0, -1)

    hashers_.forEach(x => {
      rimraf(x.tmp, () => {})
      if (x.number !== y.number) r[x.number].error = new Error('destroyed')
    })
    hashers_.splice(0, -1)

    _dryrun.splice(0, -1)
    dryrun.splice(0, -1)
    dryrun_.splice(0, -1)

    if (dicer) {
      dicer.removeAllListeners('part')
      req.unpipe(dicer)
      dicer.end()
      dicer = null
    }

    if (r.every(x => x.hasOwnProperty('data') || x.hasOwnProperty('error')))
      res.status(200).json(r)
  }

  const success = (x, data) => {
    r[x.number] = { data }
    if (r.every(x => x.hasOwnProperty('data') || x.hasOwnProperty('error'))) {
      res.status(200).json(r) 
    } else {
      schedule()
    }
  }

  const blocked = number => {
    let running = r
      .slice(0, number)
      .filter(x => !x.hasOwnProperty('data') && !x.hasOwnProperty('error'))

    return !!running.find(x => x.toName === r[number].fromName)
  }

  let count = 0
  const startPart = part => { 
    part.on('error', err => error(x.number, err))
    part.on('header', guard('on header', header => {
      let props
      try {
        props = parseHeader(header)
      } catch (e) {
        return error(x.number, e)
      }

      pluck(parts, x)
      Object.assign(r[x.number], { fromName: props.fromName, toName: props.toName })
      Object.assign(x, props)
      if (x.opts) {
        startFile(x)
      } else {
        startField(x)
      }
    }))

    let x = { number: count++, part }
    parts.push(x)
    r.push({})
  }

  const startField = x => {
    // push into parsers
    parsers.push(x)
    x.buffers = []

    // error handler already hooked
    x.part.on('data', data => x.buffers.push(data))
    x.part.on('end', () => {

      try {
        Object.assign(x, JSON.parse(Buffer.concat(x.buffers)))
      } catch (e) {
        return error(x, e)
      }

      delete x.buffers
      delete x.part
      pluck(parsers, x)

      // push into executions, or do executions
      executions.push(x)           
      getFruit().mkdirp(user, driveUUID, dirUUID, x.toName, (err, xstat) => {
        success(x, xstat)
      })
    })
  }

  const startFile = x => {
    fopen.push(x) 
    x.tmp = path.join(getFruit().getTmpDir(), UUID.v4())
    fs.open(x.tmp, 'a+', guard('on open', (err, fd) => {
      if (err) {
        error(x.number, err)
      } else {
        pluck(fopen, x) 
        x.fd = fd
        startPipe(x)
      }
    }))
    
    let y = { number: x.number }
    _dryrun.push(y)
    try {
      schedule()
    } catch (e) {
      console.log(e)
    }
  }

  const startPipe = x => {
    x.ws = fs.createWriteStream(null, { fd: x.fd })
    x.ws.on('error', err => error(x.number, err)) 
    x.ws.on('finish', guard('on pipe finish', () => {
      x.bytesWritten = x.ws.bytesWritten
      delete x.fd
      delete x.part 
      delete x.ws

      if (x.bytesWritten !== x.opts.size) {
        x.hs.removeListener('error', error) 
        x.hs.on('error', () => {})
        x.hs.destroy()

        let err = new Error('size mismatch')
        err.status = 403
        error(x.number, err)
      } else {
        pipes.splice(pipes.indexOf(x), 1)
        waitHash(x)
      }
    }))

    x.hs = new TailHash(x.fd)
    x.hs.on('error', err => error(x.number, err))
    x.part.pipe(x.ws)

    pipes.push(x)
  }

  const waitHash = x => {
    hashers.push(x)
    x.hs.end(x.bytesWritten)
    x.hs.on('data', guard('on hash finish', data => {
      hashers.splice(hashers.indexOf(x), 1)
      if (data !== x.opts.sha256) {
        let err = new Error('size mismatch')
        err.status = 403
        error(x.number, err)
      } else {
        x.digest = data
        hashers_.push(x)
        schedule()
      }
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
      
    }
  }

  // parsers_ -> executions
  // _dryrun -> dryrun
  // dryrun_ && hashers_ -> executions 
  const schedule = () => {

    while (true) {
      let y = _dryrun.find(y => !blocked(y.number))
      if (!y) break

      pluck(_dryrun, y)
      dryrun.push(y)
   
      // FIXME 
      setTimeout(() => {
        pluck(dryrun, y)
        delete y.timer
        dryrun_.push(y)
        schedule()
      }, 500)
    }

    // hashers_ && dryrun_ join
    while (true) {
      let x = hashers_.find(x => !blocked(x.number) && !!dryrun_.find(y => y.number === x.number)) 
      if (!x) break
      hashers_.splice(hashers_.indexOf(x), 1)
      let y = dryrun_.find(y => y.number === x.number)
      dryrun_.splice(dryrun_.indexOf(y), 1)
      execute(x)
    }
  }

  const regex = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i
  const m = regex.exec(req.headers['content-type'])

  dicer = new Dicer({ boundary: m[1] || m[2] })
  dicer.on('part', guard('on part', startPart))
  req.pipe(dicer)
})

/**
040 GET a single entry (download a file)
*/
router.get('/:driveUUID/dirs/:dirUUID/entries/:entryUUID', fruitless, auth.jwt(), 
  f(async (req, res) => {
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
  }))

module.exports = router

