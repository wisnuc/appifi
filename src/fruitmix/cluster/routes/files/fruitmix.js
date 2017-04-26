const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const Transform = require('stream').Transform

const router = require('express').Router()
const formidable = require('formidable')
const UUID = require('node-uuid')
const validator = require('validator')
const sanitize = require('sanitize-filename')

import paths from '../../lib/paths'
import config from '../../config'
import { DIR } from '../../../lib/const'

// list, tree and nav a directory
router.get('/:type/:dirUUID/:rootUUID', (req, res) => {
  let userUUID = req.user.uuid
  let { type, dirUUID, rootUUID } = req.params

  let typeObj = {
    'list': 'list',
    'tree': 'tree',
    'list-nav': 'navList',
    'tree-nav': 'navTree'
  }
  if (Object.keys(typeObj).indexOf(type) === -1) 
    return res.error(null, 400)

  let args = { userUUID, dirUUID, rootUUID }

  config.ipc.call(typeObj[type], args, (err, data) => {
    if (err) return res.error(err)
    return res.success(data)
  })
})

// download a file
router.get('/download/:dirUUID/:fileUUID', (req, res) => {

  let userUUID = req.user.uuid
  let { dirUUID, fileUUID } = req.params

  let args = { userUUID, dirUUID, fileUUID }

  config.ipc.call('readFile', args, (err, filepath) => {
    if (err) return res.error(err)
    return res.status(200).sendFile(filepath)
  })
})

// mkdir 
// dirUUID cannot be a fileshare UUID
router.post('/mkdir/:dirUUID/:dirname', (req, res) => {

  let userUUID = req.user.uuid
  let { dirUUID, dirname } = req.params

  let args = { userUUID, dirUUID, dirname }

  config.ipc.call('createDirectory', args, (err, data) => {
    if (err) return res.error(err)
    return res.success(data)
  })
})

// upload a file
// query : filename=xxx
router.put('/upload/:dirUUID/:sha256', (req, res) => {
  let { dirUUID, sha256 } = req.params
  let filename = req.query.filename
  let user = req.user
  let finished = false
  let tmpPath = path.join(paths.get('cluster_tmp'), UUID.v4())
  const error = err => {
    if(finished) return
    finished = true
    res.error(err, 400)
  }

  const finish = (newNode) => {
    if(finished) return 
    finished = true
    res.success(newNode, 200)
  }
  // TODO check createFileCheck
  let args = { userUUID: user.uuid, src: tmpPath, dirUUID, name: filename , hash:sha256, check: true }
  config.ipc('createFile', args, e => {

    if(e) return error(e)

    let hash = crypto.createHash('sha256')

    let writeStream = fs.createWriteStream(tmpPath)

    let hashTransform = new Transform({
      transform: function (buf, enc, next) {
        hash.update(buf, enc)
        this.push(buf)
        next()
      }
    })
    
    req.on('close', () => finished || (finished = true))
    
    hashTransform.on('error', err => error(err))

    writeStream.on('error', err => error(err))

    writeStream.on('finish', () => {
      if(finished) return  
      if(hash.digest('hex') !== sha256)
        return error(new Error('hash mismatch'))

      let args = { userUUID: user.uuid, src: tmpPath, dirUUID, name: filename , hash:sha256, check: false }
      config.ipc('createFile', args, (e, newNode) => {
        if(e) return error(e)
        finish(newNode)
      })
    })

    req.pipe(hashTransform).pipe(writeStream)
  })

})

// overwrite a file     
// query string option ?filename=xxx
// TODO check need filename or fileUUID ? Jack
router.put('/overwrite/:dirUUID/:sha256', (req, res) => {
  let { dirUUID, sha256 } = req.params
  let filename = req.query.filename
  let user = req.user
  let finished = false
  let tmpPath = path.join(paths.get('cluster_tmp'), UUID.v4())
  const error = err => {
    if(finished) return
    finished = true
    res.error(err, 400)
  }

  const finish = (newNode) => {
    if(finished) return 
    finished = true
    res.success(newNode, 200)
  }
  // TODO check createFileCheck
  let args = { userUUID: user.uuid, src: tmpPath, dirUUID, name: filename , hash:sha256, check: true }
  config.ipc('createFile', args, e => {

    if(e) return error(e)

    let hash = crypto.createHash('sha256')

    let writeStream = fs.createWriteStream(tmpPath)

    let hashTransform = new Transform({
      transform: function (buf, enc, next) {
        hash.update(buf, enc)
        this.push(buf)
        next()
      }
    })
    
    req.on('close', () => finished || (finished = true))
    
    hashTransform.on('error', err => error(err))

    writeStream.on('error', err => error(err))

    writeStream.on('finish', () => {
      if(finished) return  
      if(hash.digest('hex') !== sha256)
        return error(new Error('hash mismatch'))

      let args = { userUUID: user.uuid, src: tmpPath, dirUUID, name: filename , hash:sha256, check: false }
      config.ipc.call('overwriteFile', args, (e, newNode) => {
        if (err) return error(err)
        finish(newNode)
      })
    })

    req.pipe(hashTransform).pipe(writeStream)
    
  })
})

// rename dir or file
router.patch('/rename/:dirUUID/:nodeUUID/:filename', (req, res) => {
  let { dirUUID, nodeUUID, filename } = req.params
  config.ipc.call('rename', { userUUI: req.user.uuid, targetUUID: dirUUID, name: filename }, (err, node) => {
    if (err) return res.error(err)
    return res.success(node,200)
  })
})

// delete dir or file
// dirUUID cannot be a fileshare UUID
router.delete('/:dirUUID/:nodeUUID', (req, res) => {

  let userUUID = req.user.uuid
  let { dirUUID, nodeUUID } = req.params

  let args = { userUUID, dirUUID, nodeUUID }

  config.ipc.call('del', args, (err, filepath) => {
    if (err) return res.error(err)
    return res.status(200).sendFile(filepath)
  })
})


// old libraries api
router.post('/:digest', (req, res) => {
  let userUUID = req.user.uuid
  let libraryUUID = req.user.library

  let sha256 = req.params.digest

  let args = { sha256, libraryUUID, src: '', check: true }

  config.ipc.call('createLibraryFile', args, err => {
    if(err){
      if(err.code === 'EEXIST')
        return res.success(null, 200)
      
      return res.error(err, 500)
    }
    let form = new formidable.IncomingForm()
    form.hash = 'sha256'
    let abort = false
    form.on('fileBegin', (name, file) => {
      file.path = path.join(config.path, DIR.TMP, UUID.v4()) 
    })

    form.on('file', (name, file) => {
      if (abort) return
      if (sha256 !== file.hash) {
        return fs.unlink(file.path, err => {
          res.status(500).json({
            code: 'EAGAIN',
            message: 'sha256 mismatch'
          })
        })
      }

      args = { sha256, libraryUUID, src: file.path, check: false }
      config.ipc.call('createLibraryFile', args, (err, data) => {
        if(err) return res.error(err)
        let entry = {
          digest: sha256,
          ctime: new Date().getTime()
        }
        return res.success(entry, 200)
      })

    })

    form.on('error', err => {
      if (abort) return
      abort = true
      return res.status(500).json({})  // TODO
    })

    form.parse(req)

  })
})

module.exports = router
