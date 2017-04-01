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

// list, tree and nav a directory
router.get('/:type/:dirUUID/:rootUUID', (req, res) => {

  let userUUID = req.user.userUUID
  let { type, dirUUID, rootUUID } = req.params

  let typeArr = ['list', 'tree' ,'list-nav', 'tree-nav']
  if (typeArr.indexOf(type) === -1) return res.error(null, 400)

  let args = { userUUID, dirUUID, rootUUID }

  config.ipc.call(type, args, (err, data) => {
    if (err) return res.error(err)
    return res.success(data)
  })
})

// download a file
router.get('/download/:dirUUID/:fileUUID', (req, res) => {

  let userUUID = req.user.userUUID
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

  let userUUID = req.user.userUUID
  let { dirUUID, dirname } = req.params

  let args = { userUUID, dirUUID, dirname }

  config.ipc.call('createDirectory', args, (err, data) => {
    if (err) return res.error(err)
    return res.success(data)
  })
})

// upload a file
router.put('/upload/:dirUUID/:filename/:sha256', (req, res) => {
  let { dirUUID, filename, sha256 } = req.params
  let user = req.user
  let finished = false
  let tmpPath = path.join(paths.get('cluster_tmp'), UUID.v4())
  const error = err => {
    if(finished) return
    finished = true
    res.error(err, 400)
  }

  const finish = () => {
    if(finish) return 
    finished = true
    res.status(200)
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
      config.ipc('createFile', args, (e, newDode) => {
        if(e) return error(e)
        finish()
      })
    })

    req.pipe(hashTransform).pipe(writeStream)
  })

})

// overwrite a file
router.put('/overwrite/:dirUUID/:filename/:sha256', (req, res) => {
  let { dirUUID, filename, sha256 } = req.params
  let user = req.user
  let finished = false
  let tmpPath = path.join(paths.get('cluster_tmp'), UUID.v4())
  const error = err => {
    if(finished) return
    finished = true
    res.error(err, 400)
  }

  const finish = () => {
    if(finish) return 
    finished = true
    res.status(200)
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
        finish()
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

  let userUUID = req.user.userUUID
  let { dirUUID, nodeUUID } = req.params

  let args = { userUUID, dirUUID, nodeUUID }

  config.ipc.call('del', args, (err, filepath) => {
    if (err) return res.error(err)
    return res.status(200).sendFile(filepath)
  })
})

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

module.exports = router
