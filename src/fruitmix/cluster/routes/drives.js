
import { Router } from 'express'

import auth from '../middleware/auth'
import config from '../config'

let router = Router()

router.get('/:driveUUID', auth.jwt(), (req, res) => {
  let driveUUID = req.params.driveUUID
  config.ipc.call('getDriveInfo', driveUUID, (err, drive) => {
    if (err) return res.status(500).json({})
    res.status(200).json(Object.assign({}, drive))
  })
})

export default router