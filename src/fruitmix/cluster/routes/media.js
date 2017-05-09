const path = require('path')
const fs = require('fs')
const UUID = require('node-uuid')
const formidable = require('formidable')
const router = require('express').Router()

import config from '../config'
import { DIR } from '../../lib/const'

// get mata data of all I can view
router.get('/', (req, res) => {

  let userUUID = req.user.uuid

  config.ipc.call('getMeta', userUUID, (err, data) => {
    if (err) return res.error(err)
    return res.success(data)
  })
})

router.get('/:digest/download', (req, res) => {

  let userUUID = req.user.uuid
  let digest = req.params.digest

  config.ipc.call('readMedia', { userUUID, digest }, (err, filepath) => {
    if (err) return res.error(err)
    return res.status(200).sendFile(filepath)
  })
})

/**
  use query string, possible options:

  width: 'integer',
  height: 'integer'
  modifier: 'caret',      // optional
  autoOrient: 'true',     // optional
  instant: 'true',        // optional
  nonblock: 'true'        // optional

  width and height, provide at least one
  modifier effectvie only if both width and height provided
**/

router.get('/:digest/thumbnail', (req, res) => {

  let requestId = UUID.v4()
  // let userUUID = req.user.uuid
  let digest = req.params.digest
  let query = req.query

  req.on('close', () => {
    config.ipc.call('abort', { requestId, digest, query }, () => {})
  })

  config.ipc.call('getThumb', { requestId, digest, query }, (err, ret) => {
    if (err) {
      return res.error(err)
    }

    if (typeof ret === 'object') {
      return res.status(202).json(ret)
    }
    else {
      return res.status(200).sendFile(ret)
    }
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
