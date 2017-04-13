import fs from 'fs'
import path from 'path'

import xattr from 'fs-xattr'
import { Router } from 'express'
import formidable from 'formidable'

import auth from '../middleware/auth'
import config from '../config'
import { createFileMap, SegmentUpdater, FILEMAP, readFileMapList, readFileMap, deleteFileMap } from '../lib/filemap'
import paths from '../lib/paths'
import E from '../../lib/error'

let router = Router()

//create filemap
router.post('/:nodeUUID', auth.jwt(), (req, res) => {
  console.log(1233)
  let user = req.user
  let name = req.body.filename
  let args =  { userUUID:user.uuid, dirUUID: req.params.nodeUUID, name }
   // config.ipc.call('createFileCheck', args, (err, node) => {
  //   if(err) return res.error(err, 400)
  //   if(!node.isDirectory()) return res.error(null, 400)
    if(!req.is('multipart/form-data')){
      //create fileMap
      let { size, segmentsize, sha256} = req.body
      let args = { size, segmentsize, nodeuuid: req.params.nodeUUID, sha256, name, userUUID: user.uuid }
      createFileMap(args, (e, attr) => {
        if(e) return res.error(e, 500)
        return res.success(attr, 200)
      })
    }else
        return res.error(null, 404)    
  // })
})


// 1. retrieve target async yes
// 2. validate segement arguments no
// 3. start worker async
// 4. update file xattr async

const updateSegmentAsync = async (userUUID, nodeUUID, segmentHash, start, taskId, req) => {
  let fpath = path.join(paths.get('filemap'), userUUID, taskId)
  let attr = JSON.parse(await xattr.getAsync(fpath, FILEMAP))
  let segments = attr.segments

  if(segments.length < (start + 1))
    throw new E.EINVAL()
  if(segments[start] === 1)
    throw new E.EEXISTS()
  
  let segmentSize = attr.segmentsize
  let segmentLength = segments.length > start + 1 ? segmentSize : (attr.size - start * segmentSize)
  let position = attr.segmentsize * start

  let updater = new SegmentUpdater(fpath, req, position, segmentHash, segmentLength)

  await updater.startAsync()

  attr = JSON.parse(await xattr.getAsync(fpath, FILEMAP))
  attr.segments[start] = 1
  return await xattr.setAsync(fpath, FILEMAP, JSON.stringify(attr))
}

//Maybe like /nodeuuid?filename=xxx&segmenthash=xxx&start=xx&taskid=xxx
router.put('/:nodeUUID', auth.jwt(), (req, res) => {
  let user = req.user
  let segmentHash = req.query.segmenthash
  let start =  parseInt(req.query.start)
  let taskId = req.query.taskid

  updateSegmentAsync(user.uuid, req.params.nodeUUID, segmentHash, start, taskId, req).asCallback((err, data) => {
    if(err) return res.error(err, 400)
    return res.success(data, 200)
  })
})

router.get('/', auth.jwt(), (req, res) => {
  readFileMapList(req.user.uuid, (e, list) => {
    if(e) return res.error(e, 500)
    return res.success(list, 200)
  })
})

router.get('/:taskId', auth.jwt(), (req, res) => {
  readFileMap(req.user.uuid, req.params.taskId, (e, attr) => {
    if(e) return res.error(e, 500)
    return res.success(attr, 200)
  })
})

router.delete('/:taskId', auth.jwt(), (req, res) => {
  deleteFileMap(req.user.uuid, req.params.taskId, err => {
    if(err) return res.error(err, 500)
    return res.success(null, 500)
  })
})

export default router