import fs from 'fs'
import path from 'path'

import xattr from 'fs-xattr'
import { Router } from 'express'
import formidable from 'formidable'

import auth from '../middleware/auth'
import config from '../config'
import { createFileMap, SegmentUpdater, FILEMAP, readFileMapList, readFileMap } from '../lib/filemap'
import paths from '../lib/paths'

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



//Maybe like /nodeuuid?filename=xxx&segmenthash=xxx&start=xx&taskid=xxx
router.put('/:nodeUUID', auth.jwt(), async (req, res) => {
  let user = req.user
  let nodeUUID = req.params.nodeUUID

  let segmentHash = req.query.segmenthash
  let start =  parseInt(req.query.start)
  let taskId = req.query.taskid
  // let checkArgs =  { userUUID:user.uuid, dirUUID: nodeUUID, name }
  let fpath = path.join(paths.get('filemap'), user.uuid, taskId)

  let attr = JSON.parse(await xattr.getAsync(fpath, FILEMAP))
  
  let segments = attr.segments
  if(segments.length < (start + 1))
    return res.status(400).json({ code: 'EINVAL', message:'start too large'})
  if(segments[start] === 1)
    return res.success(attr, 200)// already uploaded
  
  let segmentSize = attr.segmentsize
  let segmentLength = segments.length > start + 1 ? segmentSize : (attr.size - start * segmentSize)
  let position = attr.segmentsize * start

  let updater = new SegmentUpdater(fpath, req, position, segmentHash, segmentLength)
  
  try{
    await updater.startAsync()
    let attr = JSON.parse(await xattr.getAsync(fpath, FILEMAP))
    attr.segments[start] = 1
    xattr.setSync(fpath, FILEMAP, JSON.stringify(attr))
    return res.success(attr, 200)
  }catch(e){
    return res.error(null, 400)
  }
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

export default router