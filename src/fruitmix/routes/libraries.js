import path from 'path'
import fs from 'fs'

import { Router } from 'express'
import UUID from 'node-uuid'

import formidable from 'formidable'

import auth from '../middleware/auth'
import Models from '../models/models'

const router = Router()

// this endpoint should return a list of libraries, which is
// acturally a list of folders inside the library drive
router.get('/', auth.jwt(), (req, res) => {

  const filer = Models.getModel('filer')

  let userUUID = req.user.uuid
  let folderUUID = req.user.library

  let list = filer.listFolder(userUUID, folderUUID)
              .filter(n => n.type === 'folder')
              .map(n => n.uuid)

  res.status(200).json(list)
})

// this endpoints should upload a file into given
// folder
router.post('/', auth.jwt(), (req, res) => {

  const filer = Models.getModel('filer')

  let folderUUID = req.user.library
  let node = filer.findNodeByUUID(folderUUID)

  filer.createFolder(req.user.uuid, node, UUID.v4(), (err, newNode) => {
    if (err) return res.status(500).json({
      code: err.code,
      message: err.message
    })

    res.status(200).json({
      uuid: newNode.uuid
    })
  })
})

router.post('/:libUUID', auth.jwt(), (req, res) => {

  // FIXME check content type, 'Content-Type: multipart/form-data'
  //                                          application/json

  let repo = Models.getModel('repo')

  const filer = Models.getModel('filer')
  const log = Models.getModel('log')
  let user = req.user
  let libUUID = req.params.libUUID

  let node = filer.findNodeByUUID(libUUID)

  // FIXME node parent must be users lib
  // node must be folder

  let sha256, abort = false
  
  let form = new formidable.IncomingForm()
  form.hash = 'sha256'

  form.on('field', (name, value) => {
    // console.log('field ' + name + ' ' + value)
    if (name === 'sha256') sha256 = value
  })

  form.on('fileBegin', (name, file) => {
    // console.log('fileBegin ' + name)
    file.path = path.join(repo.getTmpFolderForNode(node), UUID.v4()) 
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

    filer.createFile(user.uuid, file.path, node, `${sha256}`, (err, newNode) => {
      // check error code FIXME should return success if EEXIST
      if (err) return res.status(500).json({}) // TODO

      let entry = {
        digest: sha256,
        ctime: new Date().getTime()
      }    

      log.append(libUUID, JSON.stringify(entry), err => {
        res.status(200).json(entry)
      })
    })
  })

  form.on('error', err => {
    if (abort) return
    abort = true
    return res.status(500).json({})  // TODO
  })

  form.parse(req)
})

// this endpoint should return an upload log
router.get('/:libUUID/log', auth.jwt(), (req, res) => {

  let user = req.user
  let libUUID = req.params.libUUID 
 
  let log = Models.getModel('log') 
  let filer = Models.getModel('filer')
  let repo = Models.getModel('repo')

  let node = filer.findNodeByUUID(libUUID)
  
  if (!node) return res.status(404).json({}) 
  if (node.parent.uuid !== user.library) return res.status(404).json({}) // FIXME

  log.get(libUUID, (err, lines) => {

    if (err) return res.status(500).json({})

    let arr = []
    lines.forEach(l => {
      try {
        let obj = JSON.parse(l)
        arr.push(obj)
      }
      catch (e) {}
    })

    res.status(200).json(arr)
  })
})

export default router

