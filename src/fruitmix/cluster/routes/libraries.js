import path from 'path'
import fs from 'fs'

import { Router } from 'express'
import UUID from 'node-uuid'

import formidable from 'formidable'

import auth from '../middleware/auth'
import config from '../config'
import { DIR } from '../../lib/const'


let router = Router()

//
router.get('/', auth.jwt(), (req, res) => {
  let userUUID = req.user.uuid
  let folderUUID = req.user.library


})

router.post('/:sha256', auth.jwt(), (req, res) => {

  let userUUID = req.user.uuid
  let libraryUUID = req.user.library

  let sha256 = req.params.sha256

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
      file.path = path.join(process.cwd, DIR.TMP, UUID.v4()) 
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