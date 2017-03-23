import { Router } from 'express'
import formidable from 'formidable'
import auth from '../middleware/auth'
import config from '../config'

let router = Router()

router.post('/:nodeUUID', auth.jwt(), (req, res) => {
  let user = req.user
  let name = req.query.filename
  let args =  { userUUID:user.uuid, dirUUID: req.params.nodeUUID, name }
  config.ipc.call('createFileCheck', args, (err, node) => {
    if(err) return res.error(err, 400)
    if(!node.isDirectory()) return res.error(null, 400)
    
  })
})


export default router