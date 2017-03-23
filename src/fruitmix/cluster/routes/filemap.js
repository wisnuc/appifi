import { Router } from 'express'

import formidable from 'formidable'
import paths from '../lib/paths'
import config from '../config'
import auth from '../middleware/auth'
import { creatSegmentsFile, updateSegmentsFile } from '../lib/filemap'

const router = Router()
//segments for upload 

router.post('/', auth.jwt(), (req, res) => {
  //fields maybe size sha256 start
  if(req.is('multipart/form-data')){// upload a segment

  }else{//create new file segments 
    let { size, segmentsize, nodeuuid, sha256,  name } = req.body
    let args =  { userUUID:req.user.uuid, dirUUID: nodeuuid, name }
    
    config.ipc.call('createFileCheck', args, (e, node) => {
      if(e) return res.status(500).json({ code: 'ENOENT' })
      if (node.isDirectory()) {
        creatSegmentsFile({ size, segmentsize, nodeuuid, sha256,  name, useruuid: req.user.uuid }, err => {
          if(err) return res.status(500),json({})
          return res.status(200).json({})
        })
      }else // overwrite Forbidden
        return res.status(401).json({})
    })
    
  }
})