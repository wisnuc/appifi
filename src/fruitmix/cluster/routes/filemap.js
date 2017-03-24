import { Router } from 'express'
import formidable from 'formidable'
import auth from '../middleware/auth'
import config from '../config'
import { createFileMap, updateFileMap } from '../lib/filemap'

let router = Router()

router.post('/:nodeUUID', auth.jwt(), (req, res) => {
  let user = req.user
  let name = req.query.filename
  let args =  { userUUID:user.uuid, dirUUID: req.params.nodeUUID, name }
  config.ipc.call('createFileCheck', args, (err, node) => {
    if(err) return res.error(err, 400)
    if(!node.isDirectory()) return res.error(null, 400)
    if(!req.is('multipart/form-data')){
      //create fileMap
      let { size, segmentsize, sha256} = req.body
      let args = { size, segmentsize, nodeuuid: req.params.nodeUUID, sha256, name, userUUID: user.uuid }
      createFileMap(args, (e, attr) => {
        if(e) return res.error(e, 500)
        return res.success(attr, 200)
      })
    }
  })
})


export default router