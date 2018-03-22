const Promise = require('bluebird')
const router = require('express').Router()
const uuid = require('uuid')
const jwt = require('jwt-simple')
const formidable = require('formidable')
const path = require('path')
const UUID = require('uuid')
const fs = require('fs')
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const Dicer = require('dicer')
const sanitize = require('sanitize-filename')
const crypto = require('crypto')

const btrfs = require('../lib/btrfs')
const secret = require('../config/passportJwt')
const Fingerprint = require('../lib/fingerprint2')
const { isSHA256 } = require('../lib/assertion')
const getFruit = require('../fruitmix')

const debug = require('debug')('boxes:router')

const EUnavail = Object.assign(new Error('fruitmix unavailable'), { status: 503 })
const fruitless = (req, res, next) => getFruit() ? next() : next(EUnavail)
const SIZE_1G = 1024 * 1024 * 1024

/**
This auth requires client providing:
1. both local user token AND wechat token
2. only wechat token (guest mode)

returns 401 if failed
*/
// user contains local user and wechat guest
const auth = (req, res, next) => {

  let text = req.get('Authorization')
  if (typeof text !== 'string') 
    return res.status(401).end()

  let split = text.split(' ')
  // console.log(split)

  if (split.length < 2 || split.length > 3 || split[0] !== 'JWT')
    return res.status(401).end()

  let cloud
  // ensure token is valid(length)
  try {
    cloud = jwt.decode(split[1], secret) 
  } catch(e) {
    e.status = 401
    return next(e)
  }

  // ensure this is a real cloud token
  if(!cloud.hasOwnProperty('deadline')) {
    console.log('invalid cloud token')
    return res.status(401).end()
  }

  if (cloud.deadline < new Date().getTime()) {
    console.log('overdue')
    return res.status(401).end()
  }
  if (split.length === 2) {
    req.user = {
      global: cloud.global
    }
    return next()
  }

  let local
  try {
    local = jwt.decode(split[2], secret)
  } catch(e) {
    e.status = 401
    return next(e)
  }
  let user = getFruit().findUserByUUID(local.uuid)
  if (!user || user.global.id !== cloud.global.id)
    return res.status(401).end()
  req.user = user
  next()
}

router.get('/', fruitless, auth, (req, res, next) => {
  try {
    let docList = getFruit().getAllBoxes(req.user)
    res.status(200).json(docList)
  } catch(e) {
    console.log(e)
    next(e)
  } 
})

router.post('/', fruitless, auth, (req, res, next) => {
  getFruit().createBoxAsync(req.user, req.body)
    .then(doc => res.status(200).json(doc))
    .catch(err => {
      console.log(err)
      next(err)
    })
})

router.get('/:boxUUID', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID
  try {
    let doc = getFruit().getBox(req.user, boxUUID)
    res.status(200).json(doc)
  } catch(e) {
    next(e)
  }
})

router.get('/:boxUUID/files/:blobUUID', fruitless,auth, (req, res, next) => {
  let user = req.user
  let boxUUID = req.params.boxUUID
  let blobUUID = req.params.blobUUID
  try {
    let fPath = getFruit().getBoxFilepath(user, boxUUID, blobUUID)
    return res.status(200).sendFile(fPath)
  } catch(e) {
    next(e)
  }
})

// FIXME: permission: who can patch the box ?
// here only box owner is allowed
router.patch('/:boxUUID', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID
  getFruit().updateBoxAsync(req.user, boxUUID, req.body)
    .then(newDoc => res.status(200).json(newDoc))
    .catch(next)
})

router.delete('/:boxUUID', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID
  getFruit().deleteBoxAsync(req.user, boxUUID)
    .then(() => res.status(200).end())
    .catch(next)
})

router.get('/:boxUUID/branches', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID
  getFruit().getAllBranchesAsync(req.user, boxUUID)
    .then(branches => res.status(200).json(branches))
    .catch(next)
})

router.post('/:boxUUID/branches', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID

  getFruit().createBranchAsync(req.user, boxUUID, req.body)
    .then(branch => res.status(200).json(branch))
    .catch(next)
})

router.get('/:boxUUID/branches/:branchUUID', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID
  let branchUUID = req.params.branchUUID
  
  getFruit().getBranchAsync(req.user, boxUUID, branchUUID)
    .then(branch => res.status(200).json(branch))
    .catch(err => {
      if (err.code === 'ENOENT') res.status(404).end()
      else next(err)
    })
})

router.patch('/:boxUUID/branches/:branchUUID', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID
  let branchUUID = req.params.branchUUID

  getFruit().updateBranchAsync(req.user, boxUUID, branchUUID, req.body)
    .then(updated => res.status(200).json(updated))
    .catch(err => {
      if (err.code === 'ENOENT') res.status(404).end()
      else next(err)
    })
})

// FIXME: who can delete branch ?
router.delete('/:boxUUID/branches/:branchUUID', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID
  let branchUUID = req.params.branchUUID
  
  getFruit().deleteBranchAsync(req.user, boxUUID, branchUUID)
    .then(() => res.status(200).end())
    .catch(next)
})

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
    let { size, sha256 } = JSON.parse(filename)
    return { type: 'file', name, fromName, toName, size, sha256 }
  } else {
    return { type: 'field', name }
  } 
}

const errorHandler = (dicer, req) => {
  if(dicer) {
    dicer.removeAllListeners()
    dicer.on('error', () => {})
    req.unpipe(dicer)
    dicer.end()
    dicer = null
  }
}

// validate size and sha256
const validate = (props) => {
  try {
    if (!Number.isInteger(props.size))
      throw new Error('size must be an integer')

    if (!isSHA256(props.sha256))
      throw new Error('invalid sha256')
  } catch(e) {
    e.status = 400
    throw e
  }
}

// obj contains the properties to be checked
const check = (size, sha256, obj) => {
  if (size !== obj.total) {
    let e = new Error('size mismatch')
    e.status = 409
    throw e
  }

  if (sha256 !== obj.fingerprint) {
    let e = new Error('sha256 mismatch')
    e.status = 409
    throw e
  }
}

const dataHandler = (rs, callback) => {
  let tmpdir = getFruit().getTmpDir()
  let tmpPath = path.join(tmpdir, UUID.v4())
  let ws = fs.createWriteStream(tmpPath)
  let hashMaker = crypto.createHash('sha256')
  let hashArr = [], fingerprint
  let lenWritten = 0     // total length is 1G
  let total = 0

  // calculate hash of each segment(1G)
  rs.on('data', data => {
    let chunk = Buffer.from(data)

    if (lenWritten + chunk.length > SIZE_1G) {
      // write data to full, update hash
      let len = SIZE_1G - lenWritten
      hashMaker.update(chunk.slice(0, len))
      hashArr.push(hashMaker.digest())

      // write the rest of data
      lenWritten = chunk.slice(len).length
      hashMaker = crypto.createHash('sha256')
      hashMaker.update(chunk.slice(len))

      // ws.write(chunk)
      if (ws.write(chunk) === false) rs.pause()
      // total += chunk.length
    } else {
      lenWritten += chunk.length
      hashMaker.update(chunk)
      if (ws.write(chunk) === false) rs.pause()
      // ws.write(chunk)
      // total += chunk.length
    }
    total += chunk.length
  })

  rs.on('end', () => {
    ws.end()
    // calculate fingerprint
    hashArr.push(hashMaker.digest())
    if (hashArr.length === 1) fingerprint = hashArr[0].toString('hex')
    else {
      hashMaker = crypto.createHash('sha256')
      hashMaker.update(hashArr[0])
      for(let i = 1; i < hashArr.length; i++) {
        hashMaker.update(hashArr[i])
        let digest = hashMaker.digest()
        if (i === hashArr.length - 1) fingerprint = digest.toString('hex')
        else {
          hashMaker = crypto.createHash('sha256')
          hashMaker.update(digest)
        }
      }
    }
    let received = { total, fingerprint, tmpPath }
    callback(received)
  })

  ws.on('drain', () => {
    rs.resume()
  })
}

const copyDriveFile = (filePath, tmpPath, callback) => {
  fs.lstat(filePath, err => {
    if(err) return callback(err)
    //TODO: read xstat
    fs.copyFile(filePath, tmpPath, err => {
      if(err) return callback(err)
      let fp = new Fingerprint(filePath)
      fp.on('error', err => {
        return callback(err)
      })

      fp.on('data', fingerprint => {
        callback(null, fingerprint)
      })
    })
  })
}
/**
 * field : {
 *    
 * }
 */

router.post('/:boxUUID/tweets', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID
  if (req.is('multipart/form-data')) {
    const regex = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i
    const m = regex.exec(req.headers['content-type'])
    let obj, comment, parent, type, size, sha256, arr = [], indrive = [], dicerFinished, error
    let urls = []

    dicer = new Dicer({ boundary: m[1] || m[2] })
    let filecount = 0
    let partFinish = (noCount) => {
      if(!noCount) filecount--
      if(filecount !== 0) return
      if(!dicerFinished) return
      if (arr.every(i => i.finish) && indrive.every(i => i.finish)) {
        let props
        if (type === 'list' ) {
          let list =  arr.map(i => { return { sha256: i.sha256, filename: i.filename } })
          let ins = indrive.map(l => { return { sha256:l.sha256, filename:l.filename }})
          props = { parent, comment, type, list:[...list, ...ins], src: urls}
        }

        getFruit().createTweetAsync(req.user, boxUUID, props)
          .then(tweet => res.status(200).json(tweet))
          .catch(next) 
      } else {
        let e = new Error('necessary file not uploaded')
        e.status = 404
        return errorComplete(e)
      }
    } 

    let errorComplete = err => {
      if(error) return
      error = err
      debug(err)
      errorHandler(dicer, req)
      return next(err)
    }

    const onField = rs => {
      let fieldBuffers = []
      rs.on('data', data => {
        fieldBuffers.push(data)
      })
      rs.on('end', () => {
        let obj
        try {
          obj = JSON.parse(Buffer.concat(fieldBuffers))
        } catch (e) {
          e.status = 400
          return errorComplete(e)
        }
        if (typeof obj.comment === 'string') comment = obj.comment
        if (obj.parent) parent = obj.parent
        if (obj.type) type = obj.type
        if (type === 'list'&& obj.list) arr = obj.list
        //TODO: schedule
        if (obj.indrive) {
          indrive = obj.indrive
          filecount += indrive.length
          let user = getFruit().findUserByGUID(req.user.global.id)
          if(!user) return errorComplete(new Error('user not found in drive'))
          let tmpdir = getFruit().getTmpDir()
          indrive.forEach(l => {
            if(error) return
            let tmpPath = path.join(tmpdir, UUID.v4())
            if(l.type === 'media') {
              let files = getFruit().getFilesByFingerprint(user, l.sha256)
              if(files.length) {
                let mediaPath = files[0]
                // TODO: check file xstat
                fs.copyFile(mediaPath, tmpPath, err => {
                  if(error) return
                  if(err) return errorComplete(err)
                  l.finish = true
                  urls.push({sha256: l.sha256, filepath: tmpPath})
                  return partFinish()
                })
              } else return errorComplete(new Error(`media ${ l.hash } not found`))
            } else if(l.type === 'file') {
              let { filename, dirUUID, driveUUID } = l
              if(!filename || !dirUUID || !driveUUID || !filename.length || !dirUUID.length || !driveUUID.length) 
                return errorComplete(new Error('filename , dirUUID or driveUUID error'))
              let dirPath = getFruit().getDriveDirPath(user, driveUUID, dirUUID)
              let filePath = path.join(dirPath, filename)
              copyDriveFile(filePath, tmpPath, (err, fingerprint) => {
                if(error) return
                if(err) return errorComplete(err)
                l.sha256 = fingerprint
                l.finish = true
                urls.push({sha256: l.sha256, filepath: tmpPath})
                return partFinish()
              })
            } else return errorComplete(new Error('list item error'))
          })
        }
      })
    }

    const onFile = (rs, props) => {
      filecount ++
      try {
        validate(props)
      } catch(e) {
        return errorComplete(e)
      }
      dataHandler(rs, received => {
        check(props.size, props.sha256, received)
        if (type === 'list') {
          let index = arr.findIndex(i => i.sha256 === received.fingerprint)
          if (index !== -1) {
            check(arr[index].size, arr[index].sha256, received)
            urls.push({sha256: arr[index].sha256, filepath: received.tmpPath})
            arr[index].finish = true
          } else {
            rimraf(tmpPath, () => {})
          }
        }
        partFinish()
      })
    }

    dicer.on('part', part => {
      part.on('error', err => {
        part.removeAllListeners()
        part.on('error', () => {})
        return errorComplete(err)
      })

      part.on('header', header => {
        let props
        try {
          props = parseHeader(header)
        } catch(e) {
          part.on('error', () => {})
          e.status = 400
          return errorComplete(e)
        }

        if (props.type === 'field') {
          onField(part)
        } else {
          onFile(part, props)
        }
      })
    })
    
    dicer.on('finish', () => { 
      dicerFinished = true
      partFinish(true)
    })

    req.pipe(dicer)

  } else if (req.is('application/json')) {
    if(req.body.type) return next(Object.assign(new Error('request type error'), { status: 400 }))
    getFruit().createTweetAsync(req.user, boxUUID, req.body)
      .then(tweet => res.status(200).json(tweet))
      .catch(next)
  } else
    return res.status(415).end()
})

/**
 *  req body
 * {
 *    list: [{
 *       type: 'media' or 'file'
 *       sha256: 'xxxx' opt, if media require
 *       driveUUID:
 *       dirUUID:
 *       filename: 'xxx' 
 *    }],
 *    comment:
 *    type:
 * }
 */
/*
router.post('/:boxUUID/tweets/indrive', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID
  let { list, comment, type, parent } = req.body
  // props = {comment, type, list, src: urls}
  if(!list || !list.length ) return res.status(400).json({ message: 'list error'})
  if(type !== 'list') return res.status(400).json({ message: 'type error' })
  let error, count = list.length
  let user = getFruit().findUserByGUID(req.user.global.id)
  if(!user) return res.status(400).json('local user not found')
  let src = []
  let finishHandle = (sha256, filepath) => {
    if(error) return
    src.push({ sha256, filepath })
    if(list.every(i => i.finished && (src.findIndex(s => s.sha256 === i.sha256)!== -1))) {
      let ls = list.map(l => { 
        return { sha256:l.sha256, filename:l.filename }
      })
      let props = { list:ls, src, comment, type, parent }
      getFruit().createTweetAsync(req.user, boxUUID, props)
        .then(tweet => res.status(200).json(tweet))
        .catch(next)
    }
  }

  let errorHandler = err => {
    if(error) return
    error = err
    return next(err)
  }
  list.forEach(l => {
    if(error) return
    let tmpdir = getFruit().getTmpDir()
    let tmpPath = path.join(tmpdir, UUID.v4())
    if(l.type === 'media') {
      let files = getFruit().getFilesByFingerprint(user, l.sha256)
      if(files.length) {
        let mediaPath = files[0]
        // TODO: check file xstat
        fs.copyFile(mediaPath, tmpPath, err => {
          if(error) return
          if(err) return errorHandler(err)
          l.finished = true
          return finishHandle(l.sha256, tmpPath)
        })
      } else 
        errorHandler(new Error(`media ${ l.hash } not found`))
    } else if(l.type === 'file') {
      let { filename, dirUUID, driveUUID } = l
      if(!filename || !dirUUID || !driveUUID || !filename.length || !dirUUID.length || !driveUUID.length) 
        return errorHandler(new Error('filename , dirUUID or driveUUID error'))
      let dirPath = getFruit().getDriveDirPath(user, driveUUID, dirUUID)
      let filePath = path.join(dirPath, filename)
      fs.lstat(filePath, err => {
        if(error) return
        if(err) return errorHandler(err)
        //TODO: read xstat
        fs.copyFile(filePath, tmpPath, err => {
          if(error) return
          if(err) return errorHandler(err)
          fingerprintSimple(tmpPath, (err, fingerprint) => {
            if(error) return
            if(err) return errorHandler(err)
            l.sha256 = fingerprint
            l.finished = true
            return finishHandle(l.sha256, tmpPath)
          }) 
        })
      })
    } else 
      errorHandler(new Error('list item error'))
  })
})
*/

router.get('/:boxUUID/tweets', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID
  let metadata = req.query.metadata === 'true' ? true : false
  let { first, last, count, segments } = req.query
  let props = { first, last, count, segments, metadata }
  
  getFruit().getTweetsAsync(req.user, boxUUID, props)
    .then(data => res.status(200).json(data))
    .catch(next)
})

router.delete('/:boxUUID/tweets', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID
  let indexArr = req.body.indexArr

  getFruit().deleteTweetsAsync(req.user, boxUUID, indexArr)
    .then(() => res.status(200).end())
    .catch(next)
})

router.get('/:boxUUID/commits/:commitHash', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID
  let commitHash = req.params.commitHash

  getFruit().getCommitAsync(req.user, boxUUID, commitHash)
    .then(data => res.status(200).json(data))
    .catch(next)
})

router.get('/:boxUUID/trees/:treeHash', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID
  let treeHash = req.params.treeHash
  getFruit().getTreeListAsync(req.user, boxUUID, treeHash)
    .then(data => res.status(200).json(data))
    .catch(next)
})

router.post('/:boxUUID/commits', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID

  if (req.is('multipart/form-data')) {
    const regex = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i
    const m = regex.exec(req.headers['content-type'])
    let obj, uploaded = new Set()

    // obj: {root, toUpload, parent, branch}
    // root is required the others are optional
    const onField = rs => {
      rs.on('data', data => {
        obj = JSON.parse(data)
      })
    }

    // props: {type: 'file', name, fromName, toName, size, sha256}
    // properties of file uploaded, given in header
    const onFile = (rs, props) => {
      try {
        validate(props)
      } catch(e) {
        errorHandler()
        return res.status(e.status).json(e)
      }

      dataHandler(rs, received => {
        check(props.size, props.sha256, received)
        fs.renameSync(received.tmpPath, path.join(getFruit().getTmpDir(), received.fingerprint))
        uploaded.add(received.fingerprint)
      })
    }

    dicer = new Dicer({ boundary: m[1] || m[2] })

    dicer.on('part', part => {
      part.on('error', err => {
        part.removeAllListeners()
        part.on('error', () => {})
        errorHandler(dicer, req)
        return res.status(err.status).json(err)
      })

      part.on('header', header => {
        let props
        try {
          props = parseHeader(header)
        } catch(e) {
          part.on('error', () => {})
          e.status = 400
          errorHandler(dicer, req)
          return res.status(e.status).json(e)
        }

        if (props.type === 'field') {
          onField(part)
        } else {
          onFile(part, props)
        }
      })
    })

    dicer.on('finish', () => {
      if (uploaded.size !== 0) obj.uploaded = [...uploaded]
      getFruit().createCommitAsync(req.user, boxUUID, obj)
        .then(commit => res.status(200).json(commit))
        .catch(e => {
          console.log(e)
        }) 
    })

    req.pipe(dicer)

  } else if (req.is('application/json')) {
    getFruit().createCommitAsync(req.user, boxUUID, req.body)
      .then(commit => res.status(200).json(commit))
      .catch(next) 
  } else {
    return res.status(415).end()
  }
})

module.exports = router
