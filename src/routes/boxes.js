const Promise = require('bluebird')
const router = require('express').Router()
const uuid = require('uuid')
const jwt = require('jwt-simple')
const formidable = require('formidable')
const path = require('path')
const UUID = require('uuid')
const fs = require('fs')
const secret = require('../config/passportJwt')

const User = require('../models/user')
const boxData = require('../fruitmix/box/box')
const { isSHA256 } = require('../lib/assertion')

/**
This auth requires client providing:
1. both local user token AND wechat token
2. only wechat token (guest mode)

returns 401 if failed
*/
const auth = (req, res, next) => {

  let text = req.get('Authorization')
  if (typeof text !== 'string') 
    return res.status(401).end()

  let split = text.split(' ')

  if (split.length < 2 || split.length > 3 || split[0] !== 'JWT')
    return res.status(401).end()

  let cloud = jwt.decode(split[1], secret) 
  if (cloud.deadline < new Date().getTime()) {
    console.log('overdue')
    return res.status(401).end()
  }

  if (split.length === 2) {
    req.guest = {
      global: cloud.global
    }
    return next()
  }

  let local = jwt.decode(split[2], secret)
  let user = User.users.find(u => u.uuid === local.uuid)
  if (!user || user.global !== cloud.global)
    return res.status(401).end()
  req.user = User.stripUser(user)
  next()
}

const boxAuth = (req, res, next) => {
  let boxUUID = req.params.boxUUID
  let box = boxData.getBox(boxUUID)
  if(!box) return res.status(404).end()

  let global
  if(req.user) global = req.user.global
  else global = req.guest.global

  if(box.doc.owner !== global && !box.doc.users.includes(global)) 
    return res.status(403).end()
  
  req.box = box
  next()
}

router.get('/', auth, (req, res) => {

  // console.log('auth', req.user, req.guest)
  let global
  if(req.user) global = req.user.global
  else global = req.guest.global

  let docList = boxData.getAllBoxes(global)
  res.status(200).json(docList)
})

router.post('/', auth, (req, res, next) => {

  if (!req.user) return res.status(403).end()

  let props = Object.assign({}, req.body, { owner: req.user.global })

  boxData.createBoxAsync(props)
    .then(doc => res.status(200).json(doc))
    .catch(next)
})

router.get('/:boxUUID', auth, (req, res) => {
  let boxUUID = req.params.boxUUID

  let box = boxData.getBox(boxUUID)
  if(!box) return res.status(404).end()

  let global
  if(req.user) global = req.user.global
  else global = req.guest.global

  let doc = box.doc
  if (doc.owner !== global && !doc.users.includes(global)) return res.status(403).end()

  res.status(200).json(doc)
})

// FIXME: permission: who can patch the box ?
// here only box owner is allowed
router.patch('/:boxUUID', auth, (req, res, next) => {

  if(!req.user) return res.status(403).end()

  let boxUUID = req.params.boxUUID

  let box = boxData.getBox(boxUUID)
  if(!box) return res.status(404).end()
  if(box.doc.owner !== req.user.global) return res.status(403).end()

  boxData.updateBoxAsync(req.body, box)
    .then(newDoc => res.status(200).json(newDoc))
    .catch(next)
})

router.delete('/:boxUUID', auth, (req, res, next) => {
  if(!req.user) return res.status(403).end()

  let boxUUID = req.params.boxUUID

  let box = boxData.getBox(boxUUID)
  if(!box) return res.status(404).end()
  if(box.doc.owner !== req.user.global) return res.status(403).end()
  boxData.deleteBoxAsync(boxUUID)
    .then(() => res.status(200).end())
    .catch(next)
})

router.get('/:boxUUID/branches', auth, boxAuth, (req, res) => {
  let box = req.box
  
  box.retrieveAllAsync('branches')
    .then(branches => res.status(200).json(branches))
    .catch(err => {
      if(err.code === 'ENOENT') 
        return res.status(404).end()
      else return res.status(500).end()
    })
})

router.post('/:boxUUID/branches', auth, boxAuth, (req, res, next) => {
  let box = req.box

  box.createBranchAsync(req.body)
    .then(branch => res.status(200).json(branch))
    .catch(next)
})

router.get('/:boxUUID/branches/:branchUUID', auth, boxAuth, (req, res) => {
  let branchUUID = req.params.branchUUID
  let box = req.box
  
  box.retrieveAsync('branches', branchUUID)
    .then(branch => res.status(200).json(branch))
    .catch(err => {
      if(err.code === 'ENOENT') 
        return res.status(404).end()
      else return res.status(500).end()
    })
})

router.patch('/:boxUUID/branches/:branchUUID', auth, boxAuth, (req, res) => {
  let branchUUID = req.params.branchUUID
  let box = req.box

  box.updateBranchAsync(branchUUID, req.body)
    .then(updated => res.status(200).json(updated))
    .catch(e => {
      if(e.code === 'ENOENT') return res.status(404).end()
      else if(e.code === 'ECONTENT') return res.status(400).end()
      else return res.status(500).end()
    })
})

// FIXME: who can delete branch ?
router.delete('/:boxUUID/branches/:branchUUID', auth, boxAuth, (req, res, next) => {
  let branchUUID = req.params.branchUUID
  let box = req.box
  
  box.deleteBranchAsync(branchUUID)
    .then(() => res.status(200).end())
    .catch(next)
})

router.post('/:boxUUID/tweets', auth, boxAuth, (req, res) => {
  let box = req.box
  if (req.is('multipart/form-data')) {
    // UPLOAD
    let form = new formidable.IncomingForm()
    form.hash = 'sha256'
    let sha256, comment, type, size, error, data
    let finished = false, formFinished = false, fileFinished = false

    const finalize = () => {
      if (finished) return
      if (formFinished && fileFinished) {
        finished = true
        if (error)
          return res.status(500).json({ code: error.code, message: error.message })
        else 
          return res.status(200).json(data)
      }
    }

    form.on('field', (name, value) => {
      if (finished) return

      if (name === 'comment') {
        if (typeof value === 'string') comment = value
      }

      if (name === 'type') {
        if (typeof value === 'string') type = value
      }

      if (name === 'size') {
        if ('' + parseInt(value) === value) size = parseInt(value)
      }

      if (name === 'sha256') {
        if (isSHA256(value)) sha256 = value 
      }
    })

    form.on('fileBegin', (name, file) => {
      if (finished) return

      if (!Number.isInteger(size) || sha256 === undefined)
        return finished = true && res.status(409).end()

      file.path = path.join(box.tmpDir, UUID.v4())
    })

    form.on('file', (name, file) => {
      if (finished) return

      if (!Number.isInteger(size) || size !== file.size) 
        return finished = true && res.status(409).end()

      if (file.hash !== sha256)
        return fs.unlink(file.path, () => res.status(409).end())

      fs.rename(file.path, path.join(boxData.repoDir, sha256), err => {
        if (err) return finished = true && res.status(500).json({ code: err.code, message: err.message})
        
        let global
        if (req.user) global = req.user.global
        else global = req.guest.global

        let props = { comment, type: 'blob', id: sha256, global}
        box.createTweetAsync(props)
          .then(tweet => {
            data = tweet
            fileFinished = true
            finalize()
          })
          .catch(err => {
            error = err
            fileFinished = true
            finalize()
          })
      })
    })

    form.on('error', err => {
      if (finished) return
      return finished = true && res.status(500).json({ code: err.code, message: err.message })
    })
    
    form.on('aborted', () => {
      if (finished) return
      finished = true
    })

    form.on('end', () => {
      formFinished = true
      finalize()
    })

  form.parse(req)

  } else if (req.is('application/json')) {
    // let type = req.body.type
    let global
    if(req.user) global = req.user.global
    else global = req.guest.global

    let props = Object.assign({}, req.body, { global })

    box.createTweetAsync(props)
    .then(tweet => res.status(200).json(tweet))
    .catch(err => res.status(500).json({ code: err.code, message: err.message }))
  }else
    return res.status(415).end()
})

router.get('/:boxUUID/tweets', auth, boxAuth, (req, res) => {
  let box = req.box
  let { first, last, count, segments } = req.query
  let props = { first, last, count, segments }

  box.getTweetsAsync(props)
    .then(data => res.status(200).json(data))
    .catch(err => res.status(500).json({ code: err.code, message: err.message }))
})

router.delete('/:boxUUID/tweets', auth, boxAuth, (req, res) => {
  let box = req.box
  let indexArr = req.body.indexArr

  box.deleteTweetAsync(indexArr)
    .then(() => res.status(200).end())
    .catch(err => res.status(500).json({ code: err.code, message: err.message }))
})

router.post('/:boxUUID/commits', auth, boxAuth, (req, res) => {
  let box = req.box
  let branchUUID = req.body.branch
  
})

module.exports = router
