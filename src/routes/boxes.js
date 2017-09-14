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
const secret = require('../config/passportJwt')

// const User = require('../models/user')
// const boxData = require('../box/boxData')
const { isSHA256 } = require('../lib/assertion')
const getFruit = require('../fruitmix')

const EUnavail = Object.assign(new Error('fruitmix unavailable'), { status: 503 })
const fruitless = (req, res, next) => getFruit() ? next() : next(EUnavail)

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

  let cloud = jwt.decode(split[1], secret) 
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

  let local = jwt.decode(split[2], secret)
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
    next(e)
  } 
})

router.post('/', fruitless, auth, (req, res, next) => {
  getFruit().createBoxAsync(req.user, req.body)
    .then(doc => res.status(200).json(doc))
    .catch(next)
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

router.post('/:boxUUID/tweets', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID

  if (req.is('multipart/form-data')) {
    // UPLOAD
    let form = new formidable.IncomingForm()
    form.hash = 'sha256'
    let sha256, comment, type, size, error, data, arr, obj
    let urls = []
    let finished = false, formFinished = false, fileFinished = false

    const finalize = () => {
      if (finished) return
      if (formFinished) {
        finished = true
        if (error)
          return res.status(500).json({ code: error.code, message: error.message })
        else 
          return res.status(200).json(data)
      }
    }

    const check = (size, sha256, file) => {
      if (!Number.isInteger(size) || size !== file.size) 
        return finished = true && res.status(409).end()

      if (file.hash !== sha256) {
        return rimraf(file.path, err => {
          if (err) return finished = true && res.status(500).json({ code: err.code, message: err.message})
          return finished = true && res.status(409).end()
        })
      }
    }

    form.on('field', (name, value) => {
      if (finished) return

      if (name === 'blob' || name === 'list') {
        obj = JSON.parse(value)

        if (typeof obj.comment === 'string') comment = obj.comment
        if (obj.type) type = obj.type

        if (type === 'blob') {
          if (Number.isInteger(obj.size)) size = obj.size
          if (isSHA256(obj.sha256)) sha256 = obj.sha256
        }

        if (type === 'list') arr = obj.list
          // {
          //   size,
          //   sha256,
          //   filename, (optional, for file)
          //   id (uuid, identifier)
          // }
      }
    })

    form.on('fileBegin', (name, file) => {
      if (finished) return
      let tmpdir = getFruit().getTmpDir()
      file.path = path.join(tmpdir, UUID.v4())
    })

    form.on('file', (name, file) => {
      if (finished) return
      if (type === 'blob') {
        check(size, sha256, file)
        urls.push({sha256, filepath: file.path})
      }

      if (type === 'list') {
        // let id = JSON.parse(file.name).id
        // let index = arr.findIndex(i => i.id === id)
        let index = arr.findIndex(i => i.sha256 === file.hash)

        if (index !== -1) {
          check(arr[index].size, arr[index].sha256, file)          
          urls.push({sha256: file.hash, filepath: file.path})
          arr[index].finish = true
        } else {
          rimraf(file.path, () => {})
        }
      }
    })

    form.on('error', err => {
      if (finished) return
      return finished = true && res.status(500).json({ code: err.code, message: err.message })
    })
    
    form.on('aborted', () => {
      if (finished) return
      return finished = true && res.status(500).json({
        code: 'EABORTED',
        message: 'aborted'
      })
    })

    form.on('end', () => {
      formFinished = true

      if (type === 'blob' || arr.every(i => i.finish)) {
        let props
        if(type === 'blob') props = { comment, type, id: sha256, src: urls}
        else {
          let list = obj.list.map(i => { return {sha256: i.sha256, filename: i.filename} })
          props = {comment, type, list, src: urls}
        }

        getFruit().createTweetAsync(req.user, boxUUID, props)
          .then(result => {
            data = result
            finalize()
          })
          .catch(err => {
            error = err
            finalize()
          }) 
      } else {
        return finished = true && res.status(404).json({ 
          code: 'EFILE',
          message: 'necessary file not uploaded'
        })
      }
    })

    form.parse(req)

  } else if (req.is('application/json')) {
    getFruit().createTweetAsync(req.user, boxUUID, req.body)
      .then(tweet => res.status(200).json(tweet))
      .catch(next)
  } else
    return res.status(415).end()
})

router.get('/:boxUUID/tweets', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID
  let { first, last, count, segments } = req.query
  let props = { first, last, count, segments }
  
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

router.get('/commits/:commitHash', fruitless, auth, (req, res, next) => {
  let commitHash = req.params.commitHash

})

router.post('/:boxUUID/commits', fruitless, auth, (req, res, next) => {
  let boxUUID = req.params.boxUUID

  if (req.is('multipart/form-data')) {
    let error, obj, uploaded = []
    let form = new formidable.IncomingForm()
    // form.hash = 'sha256'
    let finished = false, formFinished = false

    const finalize = () => {
      if (finished) return
      if (formFinished) {
        finished = true
        if (error)
          return res.status(500).json({ code: error.code, message: error.message})
        else
          return res.status(200).json(data)
      }
    }

    form.on('field', (name, value) => {
      if (finished) return
      if (name === 'commit') {
        /*
          obj: {
            root: xxxxxx,       // hash string of a tree obj
            parent: xxxxxx,     // commit ID
            branch: xxxxxx,     // branch ID
            toUpload:[]        // file should upload
          }
        */
        obj = JSON.parse(value)
      }
    })

    form.on('fileBegin', (name, file) => {
      if (finished) return
      let tmpdir = getFruit().getTmpDir()
      file.path = path.join(tmpdir, file.name) // file.name should be hash string 
    })

    form.on('file', (name, file) => {
      if (finished) return
      uploaded.push(file.name)
    })

    form.on('error', err => {
      if (finished) return
      return finished = true && res.status(500).json({ code: err.code, message: err.message})
    })

    form.on('aborted', () => {
      if (finished) return
      let err = new Error('aborted')
      return finished = true && res.status(500).json(err)
    })

    form.on('end', () => {
      formFinished = true
      obj.uploaded = uploaded
      getFruit().createCommitAsync(req.user, boxUUID, obj)
        .then(result => {
          data = result
          finalize()
        })
        .catch(err => {
          error = err
          finalize()
        })
    })

    form.parse(req)
  } else if (req.is('application/json')) {
    getFruit().createCommitAsync(req.user, boxUUID, req.body)
  }
})

module.exports = router
