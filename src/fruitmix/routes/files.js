import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { Router } from 'express'

import formidable from 'formidable'
import UUID from 'node-uuid'
import validator from 'validator'
import sanitize from 'sanitize-filename'

import auth from '../middleware/auth'
import Models from '../models/models'

const router = Router()

// this may be either file or folder
// if it's a folder, return childrens
// if it's a file, download
// /files/xxxxxxx <- must be folder
router.get('/:nodeUUID', auth.jwt(), (req, res) => {

  let repo = Models.getModel('repo')
  let filer = Models.getModel('filer')
  let user = req.user

  let node = filer.findNodeByUUID(req.params.nodeUUID) 
  if (!node) {
    return res.status(500).json({
      code: 'ENOENT',
      message: 'node not found'
    })
  }

  if (node.isDirectory()) {
    let ret = filer.listFolder(user.uuid, node.uuid)
    if (ret instanceof Error) {
      res.status(500).json({
        code: ret.code,
        message: ret.message
      })
    }
    else {
      res.status(200).json(ret)
    }
  }
  else if (node.isFile()) {
    let filepath = filer.readFile(user.uuid, node.uuid)
    res.status(200).sendFile(filepath)
  }
  else {
    res.status(404).end() // TODO
  }
})

// this can only be folders
// create a subfolder or a file in folder
router.post('/:nodeUUID', auth.jwt(), (req, res) => {

  let repo = Models.getModel('repo')
  let filer = Models.getModel('filer')
  let user = req.user

  let node = filer.findNodeByUUID(req.params.nodeUUID)
  if (!node) {
    return res.status(500).json({ // TODO
      code: 'ENOENT'
    })
  }

  // this is going to create something in folder, either file or folder
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
        if (node.getChildren().find(child => child.name === file.name)) {
          abort = true
          return res.status(500).json({}) // TODO
        }
        file.path = path.join(repo.getTmpFolderForNode(node), UUID.v4())
      })

      form.on('file', (name, file) => {

        if (abort) return
        if (sha256 !== file.hash) {
          return fs.unlink(file.path, err => {
            res.status(500).json({})  // TODO
          })
        }
        
        filer.createFile(user.uuid, file.path, node, file.name, (err, newNode) => {
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

      filer.createFolder(user.uuid, node, name, (err, newNode) => {
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
        file.path = path.join(repo.getTmpFolderForNode(node), UUID.v4())
      })

      form.on('file', (name, file) => {
        if (abort) return
        if (sha256 !== file.hash) {
          return fs.unlink(file.path, err => {
            res.status(500).json({})  // TODO
          })
        }

        filer.overwriteFile(user.uuid, file.path, node, (err, newNode) => {
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
      //
      return res.status(404).end()
    }
  }
})

// rename file or folder inside a folder
// 
router.patch('/:folderUUID/:nodeUUID', auth.jwt(), (req, res) => {

  const isUUID = (uuid) => (typeof uuid === 'string' && validator.isUUID(uuid))
  const isUUIDArray = (arr) => (Array.isArray(arr) && arr.every(isUUID))
  const bothUUIDArray = (w, r) => isUUIDArray(w) && isUUIDArray(r)
  const oneUUIDArrayTheOtherUndefined = (w, r) => 
    (isUUIDArray(w) && r === undefined) || (w === undefined && isUUIDArray(r))
  const bothNull = (w, r) => w === null && r === null
 
  let repo = Models.getModel('repo')
  let filer = Models.getModel('filer')
  let user = req.user

  let folderUUID = req.params.folderUUID
  let nodeUUID = req.params.nodeUUID

  if (typeof folderUUID !== 'string'  ||
      !validator.isUUID(folderUUID)   ||
      typeof nodeUUID !== 'string'    ||
      !validator.isUUID(nodeUUID))
    return res.status(400).json({
      code: 'EINVAL',
      message: 'malformed folder uuid or node uuid'
    })

  let folder = filer.findNodeByUUID(folderUUID) 
  let node = filer.findNodeByUUID(nodeUUID)
  if (!folder || !node || node.parent !== folder)
    return res.stauts(404).json({
      code: 'ENOENT',
      message: 'either folder or child not found, or they are not parent-child' 
    })

  let obj = req.body
  if (typeof obj !== 'object')
    return res.status(400).json({
      code: 'EINVAL',
      message: 'request body is not an object'
    })

  if (obj.name) {

    if (typeof obj.name !== 'string' || obj.name !== sanitize(obj.name))
      return res.status(400).json({
        code: 'EINVAL',
        message: 'bad name property'
      })

    filer.rename(user.uuid, folder, node, obj.name, (err, newNode) => {

      if (err) return res.status(500).json({
        code: err.code,
        message: err.message
      })

      return res.status(200).json(Object.assign({}, newNode, {
        parent: undefined,
        children: undefined
      }))
    })
  }
  else if (
    bothUUIDArray(obj.writelist, obj.readlist) ||
    oneUUIDArrayTheOtherUndefined(obj.writelist, obj.readlist) ||
    bothNull(obj.writelist, obj.readlist)
  ) {

    if (obj.writelist) {
      if (!obj.readlist)
        obj.readlist = []  
    }    
    else if (obj.readlist) {
      if (!obj.writelist)
        obj.writelist = []
    }
    else {
      obj.writelist = undefined
      obj.readlist = undefined
    }

    filer.updatePermission(user.uuid, folder, node, obj, (err, newNode) => {

      if (err) return res.status(500).json({
        code: err.code,
        message: err.message
      })

      return res.status(200).json(Object.assign({}, newNode, {
        parent: undefined,
        children: undefined
      }))
    })
  }
  else {
    return res.status(400).json({
      code: 'EINVAL',
      message: 'no valid name or permission props found'
    })
  }
})

// this may be either file or folder
router.delete('/:folderUUID/:nodeUUID', auth.jwt(), (req, res) => {

  let repo = Models.getModel('repo')
  let filer = Models.getModel('filer')
  let user = req.user

  let folderUUID = req.params.folderUUID
  let nodeUUID = req.params.nodeUUID

  let folder = filer.findNodeByUUID(folderUUID)
  let node = filer.findNodeByUUID(nodeUUID)

  filer.deleteFileOrFolder(user.uuid, folder, node, err => {
    if (err) res.status(500).json(null)
    res.status(200).json(null)
  })
})

export default router

