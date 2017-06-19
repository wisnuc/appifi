import fs from 'fs'
import path from 'path'

import xattr from 'fs-xattr'
import { Router } from 'express'
import formidable from 'formidable'

import config from '../config'
import { createFileMap, updateSegmentAsync, readFileMapList, readFileMap, deleteFileMap } from '../lib/filemap'
import paths from '../lib/paths'
import E from '../../lib/error'

let router = Router()

//create filemap
router.post('/:nodeUUID', (req, res) => {
  console.log(1233)
  let user = req.user
  let name = req.body.filename
  let dirUUID = req.params.nodeUUID
  // let args =  { userUUID:user.uuid, dirUUID, name }
  // config.ipc.call('createFileCheck', args, (err, node) => {
  //   if(err) return res.error(err, 400)
  //   if(!node.isDirectory()) return res.error(null, 400)
  if (!req.is('multipart/form-data')) {
    //create fileMap
    let { size, segmentsize, sha256 } = req.body
    let args = { size, segmentsize, dirUUID, sha256, name, userUUID: user.uuid }
    createFileMap(args, (e, attr) => {
      if (e) return res.error(e, 500)
      return res.success(attr, 200)
    })
  } else
    return res.error(null, 404)
  // })
})

//Maybe like /nodeuuid?filename=xxx&segmenthash=xxx&start=xx&taskid=xxx
router.put('/:nodeUUID', (req, res) => {
  let user = req.user
  let segmentHash = req.query.segmenthash
  let start = parseInt(req.query.start)
  let taskId = req.query.taskid

  updateSegmentAsync(user.uuid, req.params.nodeUUID, segmentHash, start, taskId, req).asCallback((err, data) => {
    if (err){
      console.log(err)
      return res.error(err, 400)
    }
    return res.success(null, 200)
  })
})

router.get('/', (req, res) => {
  readFileMapList(req.user.uuid, (e, list) => {
    if (e) return res.error(e, 500)
    return res.success(list, 200)
  })
})

router.get('/:taskId', (req, res) => {
  readFileMap(req.user.uuid, req.params.taskId, (e, attr) => {
    if (e) return res.error(e, 500)
    return res.success(attr, 200)
  })
})

router.delete('/:taskId', (req, res) => {
  deleteFileMap(req.user.uuid, req.params.taskId, err => {
    if (err) return res.error(err, 500)
    return res.success(null, 200)
  })
})

export default router
