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
const HashStream = require('../lib/hash-stream')
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
  }

  let h = { name, fromName, toName, filename, opts }
  return h 
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

  const regex = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i
  const m = regex.exec(req.headers['content-type'])

  /**

  parts (new) -> parser (field) -> parsers_ ------------------------> ops

        (new) -> fopen -> pipe -> streamers -> streamers_ ----------> ops
              \                                            
              (fork) -> _dryrun -> dryrun -> dryrun_ (join)
  **/
  const parts = []
  const parsers = []
  const parsers_ = []

  const fopen = []
  const pipe = []
  const streamers = []
  const streamers_ = []

  const _dryrun = []
  const dryrun = []
  const dryrun_ = []

  const ops = []

  const results = []

  // for debug
  const print = x => {
    console.log(`---- ${x} ----`) 
    console.log('parts, parsers_', parts, parsers, parsers_)
    console.log('fopen, streamers_', fopen, streamers, streamers_)
    console.log('_dryrun_', _dryrun, dryrun, dryrun_)
    console.log('ops, results', ops, results)
  }

  const success = (number, data) => {
    results[number] = { data }
    res.status(200).json(results) 
  }

  const destroyed = false
  const destroy = () => {
  }

  const error = (number, err) => {
    if (!destroyed) {
      destroy()
    }
 
  }

  const blocked = number => {
    let running = results
      .slice(0, number)
      .filter(x => !x.hasOwnProperty('data') && !x.hasOwnProperty('error'))

    return !!running.find(x => x.toName === results[number].fromName)
  }

  const execute = x => {
    if (x.opts) { // file
      if (x.opts.append) {

      } else {

      }
    } else { // field
    }
  }

  // parsers_ -> ops
  // _dryrun -> dryrun
  // dryrun_ && streamers_ -> ops 
  const schedule = () => {

    while (true) {
      let index = _dryrun.findIndex(n => !blocked(n))
      if (index === -1) break

      let num = _dryrun.splice(index, 1).pop()
      dryrun.push(num)
    
      setTimeout(() => {
        dryrun.splice(dryrun.indexOf(num), 1)
        dryrun_.push(num)
      })
    }

    while (true) {
      let x = streamers_.find(x => !blocked(x.number) && dryrun_.includes(x.number)) 
      if (!x) break

      streamers_.splice(streamers_.indexOf(x), 1)
      dryrun_.splice(dryrun_.indexOf(x.number), 1)

      execute(x)
    }
  }

  const handleFirstError = err => console.log('first error', err)

  let dicer = new Dicer({ boundary: m[1] || m[2] })

  let count = 0
  dicer.on('part', part => {
    print('on part') 
    results.push({})

    let x = { number: count++, part }
    parts.push(x)
    part.on('error', handleFirstError)
    part.on('header', header => {
      print('on header')

      let props
      try {
        props = parseHeader(header)
      } catch (e) {
        handleFirstError(e)
        return
      }
      
      Object.assign(results[x.number], {
        fromName: props.fromName,
        toName: props.toName
      })

      // remove out of parts
      parts.splice(parts.indexOf(x), 1)

      Object.assign(x, props)
      if (x.filename) {
        fopen.push(x) 
        x.tmp = path.join(getFruit().getTmpDir(), UUID.v4())
        fs.open(x.tmp, 'a+', (err, fd) => {
          print('on open')

          if (err) {
            error(x.number, err)
          } else {
            fopen.splice(fopen.indexOf(x), 1) 
            streamers.push(x)

            x.ws = fs.createWriteStream(null, { fd })
            x.hs = new HashStream(fd)

            x.ws.on('error', err => error(x.number, err)) 
            x.ws.on('finish', () => {
              x.hs.end(x.ws.bytesWritten)
              delete x.ws
            })

            x.hs.on('error', err => error(x.number, err))
            x.hs.on('data', data => {
              print('on stream end')
              
              streamers.splice(streamers.indexOf(x), 1)
              delete x.part              
              delete x.ws
              delete x.hs
              x.digest = data
              
              streamers_.push(x)

              print('before schedule')
              schedule()
              print('after schedule')
            })

            x.part.pipe(x.ws)
          }
        })
        
        _dryrun.push(x.number)
        schedule()

      } else {
        // push into parsers
        parsers.push(x)
        x.buffers = []

        // error handler already hooked
        part.on('data', data => x.buffers.push(data))
        part.on('end', () => {

          try {
            Object.assign(x, JSON.parse(Buffer.concat(x.buffers)))
          } catch (e) {
            handlFirstError(e)  
            return
          }

          delete x.buffers
          delete x.part
          parsers.splice(parsers.indexOf(x), 1)

          // push into ops, or do ops
          ops.push(x)           
          getFruit().mkdirp(user, driveUUID, dirUUID, x.toName, (err, xstat) => {
            success(x.number, xstat)
          })
        })
      }

    }) 
  })

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

