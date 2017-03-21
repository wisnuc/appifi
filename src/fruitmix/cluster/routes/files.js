import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { Router } from 'express'

import formidable from 'formidable'
import UUID from 'node-uuid'
import validator from 'validator'
import sanitize from 'sanitize-filename'

import paths from '../lib/paths'
import config from '../config'
// import auth from '../middleware/auth'
// import Models from '../models'

const router = Router()

// /:nodeUUID?filename=xxx
router.post('/:nodeUUID', (req, res) => {

  let name = req.query.filename
  let dirUUID = req.params.nodeUUID
  let user = req.user
  let args =  { userUUID:user.uuid, dirUUID, name }

  config.ipc.call('createFileCheck', args, (e, node) => {
    if(e) return res.status(500).json({ code: 'ENOENT' })
    if (node.isDirectory()) {
      if (req.is('multipart/form-data')) {  // uploading a new file into folder

        let sha256, abort = false

        let form = new formidable.IncomingForm()
        form.hash = 'sha256'

        form.on('field', (name, value) => {
          if (name === 'sha256') 
            sha256 = value
        })

        form.on('fileBegin', (name, file) => {
          if (sanitize(file.name) !== file.name) {
            abort = true
            return res.status(500).json({})  // TODO
          }
          file.path = path.join(paths.get('cluster_tmp'), UUID.v4())
        })

        form.on('file', (name, file) => {

          if (abort) return
          if (sha256 !== file.hash) {
            return fs.unlink(file.path, err => {
              res.status(500).json({})  // TODO
            })
          }
          
          let args = { userUUID: user.uuid, srcpath: file.path, dirUUID, name, sha256 }
          
          config.ipc('createFile', args, (e, newDode) => {
            return res.status(200).json(Object.assign({}, newNode, {
               parent: newNode.parent.uuid,
            }))
          })
        })
        // this may be fired after user abort, so response is not guaranteed to send
        form.on('error', err => {
          abort = true
          return res.status(500).json({
            code: err.code,
            message: err.message
          })
        })

        form.parse(req)
      }
      else { // creating a new sub-folder in folder

        let name = req.body.name
        if (typeof name !== 'string' || sanitize(name) !== name) {
          return res.status(500).json({}) // TODO
        }

        let args = { userUUID: user.uuid, dirUUID, name }

        config.ipc.call('createDirectory', args, (e, newNode) => {
          if (err) return res.status(500).json({}) // TODO
            res.status(200).json(Object.assign({}, newNode, {
            parent: newNode.parent.uuid
          }))
        })
      }
    }
    else if (node.isFile()) {     

      if (req.is('multipart/form-data')) { // overwriting an existing file

        let sha256, abort = false 
        let form = new formidable.IncomingForm()
        form.hash = 'sha256'

        form.on('field', (name, value) => {
          if (name === 'sha256')
           sha256 = value
        })

        form.on('fileBegin', (name, file) => {
         file.path = path.join(paths.get('cluster_tmp'), UUID.v4())
        })

        form.on('file', (name, file) => {
          if (abort) return
          if (sha256 !== file.hash) {
            return fs.unlink(file.path, err => {
             res.status(500).json({})  // TODO
            })
          }

          let args = { userUUID: user.uuid, srcpath: file.path, fileUUID: node.uuid }
          config.ipc.call('overwriteFile', args, (e, newNode) => {
            if (err) return res.status(500).json({}) // TODO
            res.status(200).json(Object.assign({}, newNode, {
              parent: newNode.parent.uuid
            }))
          })
        })

        form.on('error', err => {
          if (abort) return
            abort = true
          return res.status(500).json({
            code: err.code,
            message: err.message
          })
        })

        form.parse(req)
      }
      else {
      
        return res.status(404).end()
      }
    }
  })
})